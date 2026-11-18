import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend, ProposalError } from "../server/proposal-backend.ts";
import { ProposalTransport } from "../src/framework/transport/proposal.ts";
import { GameController } from "../src/framework/controller.ts";
import { tavern } from "../src/games/tavern/definition.ts";
import { reuse } from "../src/games/reuse/definition.ts";
import { formatMoney } from "../src/framework/presentation/money.ts";
import { resolveSessionEntry } from "../src/framework/app/session-entry.ts";

function storage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, clear: () => data.clear(), key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null, removeItem: (key) => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } };
}
function setup(t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), "proposal-fe-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const backend = new ProposalBackend([tavern, reuse], join(dir, "state.json"), { rng: () => 0.5 });
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  let loseNext = false;
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    assert.equal(init?.method, "POST");
    assert.equal(url.search, "");
    assert.equal(typeof body.gameCode, "string");
    requests.push({ path: url.pathname, body });
    try {
      const response = backend.handle(init?.method ?? "GET", url.pathname.slice(7), body, {
        sessionId: headers.get("Session-Id") ?? "", token: (headers.get("Authorization") ?? "").slice(7), playToken: headers.get("Play-Token") ?? "",
      });
      if (loseNext) { loseNext = false; throw Error("NETWORK_LOST_AFTER_COMMIT"); }
      return Response.json(response);
    } catch (error) {
      if (error instanceof ProposalError) return Response.json({ error: error.message }, { status: error.status });
      throw error;
    }
  }) as typeof fetch;
  const local = storage();
  const game = structuredClone(tavern);
  const create = () => new GameController(new ProposalTransport(game, local, fetcher), local, "v1.pending");
  return { create, requests, game, local, fetcher, loseResponse: () => { loseNext = true; } };
}

test("FE adapter drives checkpoints, resumes an issued spin, and credits only final ACK", async (t) => {
  const f = setup(t);
  let controller = f.create();
  await controller.boot();
  assert.equal(formatMoney(f.game, 1234567), "₩1,234,567");
  let result = await controller.execute({ action: "buy-drop", bet: 1000, chance: "standard" });
  assert.equal(result.entry, "drop");
  const balance = result.state.balance;
  const initialRequests = f.requests.length;
  assert.equal(controller.nextPresentation(), null);
  assert.equal(f.requests.length, initialRequests);
  await controller.completePresentation(); // releases first free spin, without displaying it
  assert.equal(controller.state!.feature!.played, 0);
  controller = f.create(); // refresh between response and animation
  await controller.boot();
  assert.equal(controller.phase, "recovery");
  result = await controller.recover();
  assert.equal(result.checkpoint!.staticResult, true);
  assert.equal(result.state.feature!.played, 1);
  const seen = new Set<string>();
  let chestCount = 0;
  while (true) {
    assert.ok(!seen.has(result.requestId)); seen.add(result.requestId);
    assert.equal(controller.state!.balance, balance);
    if (result.checkpoint!.curStep === "open-chest") {
      chestCount++;
      assert.ok(result.checkpoint!.displayWinMinor >= result.checkpoint!.beforeWinMinor);
      if (chestCount === 2) {
        controller = f.create(); await controller.boot(); result = await controller.recover();
        assert.equal(result.state.feature!.chests.filter((chest) => chest.multiplier != null).length, 2);
        assert.ok(result.checkpoint!.beforeWinMinor <= result.checkpoint!.displayWinMinor);
      }
    }
    const final = result.checkpoint!.curStep === "free-end";
    await controller.completePresentation();
    if (final) break;
    const internal = controller.nextPresentation();
    result = internal ?? await controller.execute({ action: "spin", bet: 1000, chance: "standard" });
  }
  assert.ok(chestCount > 0);
  assert.equal(controller.state!.feature, null);
  assert.equal(controller.state!.balance, balance + result.completion!.roundAward);
  assert.equal(f.requests.filter((req) => req.path.endsWith("buy-feature")).length, 1);
});

test("boot reuses the prepared session without another game-info request", async (t) => {
  const f = setup(t);
  const transport = new ProposalTransport(f.game, f.local, f.fetcher);
  const initialState = await transport.session();
  const requests = f.requests.length;
  const controller = new GameController(transport, f.local, "v1.pending");
  await controller.boot(initialState);
  assert.equal(f.requests.length, requests);
  assert.equal(controller.phase, "ready");
  assert.deepEqual(controller.state, initialState);
  const outcome = await controller.execute({ action: "spin", bet: f.game.defaultBet, chance: "standard" });
  assert.equal(outcome.state.board.length, f.game.reels);
});

test("landing keeps a pending bonus intro in base while retaining prepared resume intent", async (t) => {
  const f = setup(t); const first = f.create(); await first.boot();
  const entry = await first.execute({ action: "buy-drop", bet: 1000, chance: "standard" });
  const transport = new ProposalTransport(f.game, f.local, f.fetcher);
  const prepared = await transport.session();
  assert.equal(prepared.feature, null);
  assert.deepEqual(resolveSessionEntry(prepared), { scene: "base", featureMode: "drop", resumeStep: "intro", requiresResume: true });
  // A lost paid response may leave a pending command. The BE's recorded feature takes precedence.
  f.local.setItem("startup.pending", JSON.stringify({ requestId: entry.requestId, action: "buy-drop", bet: 1000, chance: "standard", expectedVersion: 0 }));
  const controller = new GameController(transport, f.local, "startup.pending");
  await controller.boot(prepared);
  const count = f.requests.length;
  const outcome = await controller.recover(false);
  assert.equal(f.requests.length, count);
  assert.equal(outcome.checkpoint!.resumed, true);
  assert.equal(outcome.entry, "drop");
  assert.equal(outcome.requestId, entry.requestId);
  assert.equal(controller.pending, null);
  assert.equal(f.local.getItem("startup.pending"), null);
});

test("landing reuses the prepared free-spin result and preserves its completed-spin counts", async (t) => {
  const f = setup(t); const first = f.create(); await first.boot();
  await first.execute({ action: "buy-tavern", bet: 1000, chance: "standard" });
  await first.completePresentation();
  const transport = new ProposalTransport(f.game, f.local, f.fetcher);
  const prepared = await transport.session();
  assert.equal(resolveSessionEntry(prepared).scene, "feature");
  assert.equal(prepared.feature!.played, 1);
  const controller = new GameController(transport, f.local); await controller.boot(prepared);
  const count = f.requests.length;
  const outcome = await controller.recover(false);
  assert.equal(f.requests.length, count);
  assert.equal(outcome.state.feature!.played, 1);
  assert.equal(outcome.checkpoint!.staticResult, true);
  assert.equal(outcome.entry, null);
});

test("FE retries a lost paid response with the original Play-Token after reload", async (t) => {
  const f = setup(t);
  let controller = f.create(); await controller.boot();
  f.loseResponse();
  await assert.rejects(controller.execute({ action: "spin", bet: 1000, chance: "standard" }), /NETWORK_LOST/);
  controller = f.create(); await controller.boot();
  const result = await controller.recover();
  assert.equal(result.state.balance, 10000000 - 1000 + result.paidAward);
  await controller.completePresentation();
  const again = f.create(); await again.boot();
  assert.equal(again.state!.balance, result.state.balance);
  assert.equal(again.phase, "ready");
});

test("FE lost ACK resumes the next released result instead of replaying the completed spin", async (t) => {
  const f = setup(t); let controller = f.create(); await controller.boot();
  await controller.execute({ action: "buy-drop", bet: 1000, chance: "standard" });
  await controller.completePresentation();
  const first = await controller.execute({ action: "spin", bet: 1000, chance: "standard" });
  f.loseResponse();
  await assert.rejects(controller.completePresentation(), /NETWORK_LOST/);
  assert.equal(controller.phase, "recovery");
  controller = f.create(); await controller.boot();
  const next = await controller.recover();
  assert.notEqual(next.requestId, first.requestId);
  assert.equal(next.state.feature!.played, first.state.feature!.played + 1);
});

test("same reusable adapter runs 3x3 config with KRW", async (t) => {
  const f = setup(t); const game = structuredClone(reuse);
  const controller = new GameController(new ProposalTransport(game, storage(), f.fetcher), storage());
  await controller.boot();
  const result = await controller.execute({ action: "spin", bet: game.defaultBet, chance: "standard" });
  assert.equal(result.state.board.length, 3); assert.equal(result.state.board[0].length, 3);
  await controller.completePresentation();
  assert.equal(controller.phase, "ready"); assert.equal(game.currency!.exponent, 0);
});

test("lost final ACK response reconciles the settled wallet without reopening a finished feature", async (t) => {
  const f = setup(t); const controller = f.create(); await controller.boot();
  let outcome = await controller.execute({ action: "buy-drop", bet: 1000, chance: "standard" });
  const balance = controller.state!.balance;
  while (outcome.checkpoint!.curStep !== "free-end") {
    await controller.completePresentation();
    outcome = controller.nextPresentation() ?? await controller.execute({ action: "spin", bet: 1000, chance: "standard" });
  }
  f.loseResponse();
  await assert.rejects(controller.completePresentation(), /NETWORK_LOST/);
  const reconciled = await controller.recover();
  assert.equal(reconciled.checkpoint!.curStep, "settled");
  assert.equal(reconciled.state.balance, balance + outcome.completion!.roundAward);
  await controller.completePresentation();
  assert.equal(controller.phase, "ready");
  assert.equal(controller.state!.feature, null);
});
