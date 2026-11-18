import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend } from "../server/proposal-backend.ts";
import { tavern } from "../src/games/tavern/definition.ts";

function fixture(t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), "tavern-proposal-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "state.json");
  let now = 1000000;
  const options = { now: () => now, rng: () => 0.5 };
  let backend = new ProposalBackend([tavern], file, options);
  const login = backend.login({ userId: "review-player" });
  const auth = { sessionId: login.sessionId, token: login.token, playToken: "" };
  const call = (method: string, path: string, body = {}): any => backend.handle(method, path, body, auth);
  return {
    call, auth,
    restart: () => { backend = new ProposalBackend([tavern], file, options); },
    relogin: () => Object.assign(auth, backend.login({ userId: "review-player" })),
    advanceDays: (days: number) => { now += days * 86400000; },
    sweep: () => backend.sweepExpired(),
  };
}
test("proposal KRW wager is durable and duplicate token never creates another debit", (t) => {
  const f = fixture(t);
  const info = f.call("POST", "/game-info");
  assert.equal(info.currencyExponent, 0);
  assert.equal(info.settings.symbolIds[1], "wild");
  assert.equal(info.settings.symbolIds[11], "bonus");
  assert.equal(info.lastReels.length, 25);
  f.auth.playToken = info.playToken;
  const body = { isFreespin: 0, betMinor: 1000, chanceMode: "normal" };
  const result = f.call("POST", "/spin", body);
  assert.equal(result.chargedMinor, 1000);
  assert.equal(result.canStartPaidRound, true);
  assert.equal(result.wallet.confirmedBalanceMinor, info.wallet.confirmedBalanceMinor - 1000 + result.settlement.creditedMinor);
  assert.ok(result.winLines.every((line: any) => line.lineId >= 1 && line.winSym.every((pos: number) => pos >= 1 && pos <= 25)));
  f.restart();
  assert.deepEqual(f.call("POST", "/spin", { chanceMode: "normal", betMinor: 1000, isFreespin: 0 }), result);
  assert.throws(() => f.call("POST", "/spin", { ...body, betMinor: 500 }), /REQUEST_CONFLICT/);
  assert.equal(f.call("POST", "/rounds/status").wallet.walletVersion, result.wallet.walletVersion);
  assert.throws(() => f.call("POST", "/spin", { ...body, wallet: 10000 }), /INVALID_FIELDS/);
});
test("proposal bonus releases one step, resumes after-result state, and settles once", (t) => {
  const f = fixture(t);
  const info = f.call("POST", "/game-info");
  f.auth.playToken = info.playToken;
  let result = f.call("POST", "/buy-feature", { betMinor: 1000, featureMode: "drop" });
  assert.equal(result.freegame.curStep, "intro");
  assert.equal(result.freegame.remainSpin, 10);
  const pendingBalance = result.wallet.confirmedBalanceMinor;
  assert.equal(result.settlement.status, "pending");
  let lastRequest = {};
  let previousAmount = 0;
  let chestCount = 0;
  for (let guard = 0; result.freegame && guard < 100; guard++) {
    const step = result.step;
    f.restart();
    f.relogin();
    const resumed = f.call("POST", "/game-info");
    assert.equal(resumed.resume.step.stepId, step.stepId);
    assert.equal(resumed.wallet.confirmedBalanceMinor, pendingBalance);
    if (step.curStep === "freespin") {
      assert.equal(resumed.resume.mode, "show_stored_result");
      assert.deepEqual(resumed.resume.snapshot, step);
      assert.equal(step.freegame.curSpin + step.freegame.remainSpin, step.freegame.totalSpins);
    }
    if (step.curStep === "open-chest") {
      chestCount++;
      assert.equal(step.openedChests.length, chestCount);
      assert.equal(resumed.resume.snapshot.openedChests.length, chestCount - 1);
      assert.ok(step.displayWinAfterMinor >= previousAmount);
    }
    previousAmount = step.displayWinMinor;
    lastRequest = { isFreespin: 1, curStep: step.curStep, stepId: step.stepId };
    result = f.call("POST", "/spin", lastRequest);
    assert.deepEqual(f.call("POST", "/spin", lastRequest), result);
  }
  assert.ok(chestCount > 0);
  assert.equal(result.freegame, null);
  assert.equal(result.presentationStatus, "completed");
  assert.equal(result.wallet.confirmedBalanceMinor, pendingBalance + result.settlement.creditedMinor);
  assert.ok(result.settlement.creditedMinor <= 1000 * 10000);
  assert.equal(f.call("POST", "/game-info").resume, null);
  f.restart();
  assert.deepEqual(f.call("POST", "/spin", lastRequest), result);
});
test("proposal inactive rounds settle without browser ACK and require summary dismissal", (t) => {
  const f = fixture(t);
  f.auth.playToken = f.call("POST", "/game-info").playToken;
  const body = { betMinor: 1000, featureMode: "tavern" };
  const initial = f.call("POST", "/buy-feature", body);
  f.advanceDays(29);
  f.call("POST", "/game-info");
  assert.deepEqual(f.call("POST", "/buy-feature", body), initial);
  f.advanceDays(2);
  f.sweep();
  f.restart();
  const resumed = f.call("POST", "/game-info");
  assert.equal(resumed.presentationStatus, "auto_closed");
  assert.equal(resumed.resume.mode, "final_summary");
  assert.equal(resumed.canStartPaidRound, false);
  assert.equal(resumed.wallet.walletVersion, 2);
  assert.throws(() => f.call("POST", "/spin", { isFreespin: 1, curStep: "intro", stepId: initial.stepId }), /STALE_STEP/);
  const ack = { isFreespin: 0, curStep: "final-summary", summaryId: resumed.resume.summaryId };
  const completed = f.call("POST", "/spin", ack);
  assert.equal(completed.canStartPaidRound, true);
  assert.deepEqual(f.call("POST", "/spin", ack), completed);
  f.sweep();
  assert.deepEqual(f.call("POST", "/rounds/status").wallet, completed.wallet);
});
