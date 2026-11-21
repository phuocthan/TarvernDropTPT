import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockGame } from "../server/mock-game.ts";
import { ProposalBackend } from "../server/proposal-backend.ts";
import { tavern } from "../src/games/tavern/definition.ts";
import policy from "../server/demo-check.config.json" with { type: "json" };
const singleScatter = (board: string[][]) => {
 for (const reel of board) assert.ok(reel.filter(id => id === "bonus").length <= 1);
};
test("temporary checking policy keeps one Scatter per reel and disables natural entry for all base Chance modes", () => {
 const game = structuredClone(tavern);
 game.demo.scatterRates = { standard: 1, extra: 1, super: 1 };
 for (const chance of ["standard", "extra", "super"] as const) {
  const mock = new MockGame(game, () => 0, policy);
  const outcome = mock.execute({ requestId: chance, expectedVersion: 0, action: "spin", bet: game.defaultBet, chance });
  singleScatter(outcome.state.board);
  assert.equal(outcome.state.board.flat().filter(id => id === "bonus").length, game.reels);
  assert.equal(outcome.entry, null);
  assert.equal(outcome.state.feature, null);
  assert.equal(outcome.state.round, null);
  assert.equal(outcome.retrigger, 0);
 }
});
test("temporary policy preserves bought features, exact trigger counts and free-spin retriggers with one Scatter per reel", () => {
 for (const [action, count] of [["buy-tavern", 3], ["buy-drop", 4]] as const) {
  const mock = new MockGame(tavern, () => 0, policy);
  const entry = mock.execute({ requestId: action, expectedVersion: 0, action, bet: tavern.defaultBet, chance: "standard" });
  assert.equal(entry.entry, action === "buy-drop" ? "drop" : "tavern");
  singleScatter(entry.state.board);
  assert.equal(entry.state.board.flat().filter(id => id === "bonus").length, count);
  const free = mock.execute({ requestId: "free", expectedVersion: 1, action: "spin", bet: tavern.defaultBet, chance: "standard" });
  singleScatter(free.state.board);
  assert.ok(free.retrigger > 0);
 }
});
test("v1 served policy settles a many-Scatter base spin without feature and retains exactly-once retry", t => {
 const dir = mkdtempSync(join(tmpdir(), "tavern-check-policy-"));
 t.after(() => rmSync(dir, { recursive: true, force: true }));
 const backend = new ProposalBackend([tavern], join(dir, "backend.json"), { rng: () => 0, mockGamePolicy: policy });
 const login = backend.login({ userId: "policy-test" });
 const auth = { sessionId: login.sessionId, token: login.token, playToken: "" };
 const call = (path: string, body: Record<string, unknown> = {}) => backend.handle("POST", path, { gameCode: "tavern-drop", ...body }, auth) as any;
 auth.playToken = call("/game-info").playToken;
 const request = { isFreespin: 0, betMinor: 1000, chanceMode: "normal" };
 const result = call("/spin", request);
 const board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 5 }, (_, row) => result.reels[row * 5 + reel]));
 assert.ok(board.every(reel => reel.filter(id => id === 11).length <= 1));
 assert.equal(result.freegame, null);
 assert.equal(result.step.curStep, "base");
 assert.equal(result.presentationStatus, "pending");
 assert.equal(result.canStartPaidRound, false);
 assert.deepEqual(call("/spin", request), result);
 assert.equal(call("/spin", { isFreespin: 1, curStep: "base", stepId: result.stepId }).canStartPaidRound, true);
});
