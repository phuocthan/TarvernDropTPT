import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend } from "../server/proposal-backend.ts";
import { win79k, zeroWin } from "./browser/fixtures/m2-rounds.ts";
import type { Board } from "../src/framework/domain/contracts.ts";
import { tavern } from "../src/games/tavern/definition.ts";

function fixture(t: { after: (fn: () => void) => void }, baseBoard?: Board) {
  const dir = mkdtempSync(join(tmpdir(), "tavern-proposal-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "state.json");
  let now = 1000000;
  const options = { now: () => now, rng: () => 0.5, baseBoard };
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
  assert.equal(result.canStartPaidRound, false);
  assert.equal(result.playToken, undefined);
  assert.equal(result.wallet.confirmedBalanceMinor, info.wallet.confirmedBalanceMinor - 1000);
  assert.ok(result.winLines.every((line: any) => line.lineId >= 1 && line.winSym.every((pos: number) => pos >= 1 && pos <= 25)));
  f.restart();
  assert.deepEqual(f.call("POST", "/spin", { chanceMode: "normal", betMinor: 1000, isFreespin: 0 }), result);
  assert.throws(() => f.call("POST", "/spin", { ...body, betMinor: 500 }), /REQUEST_CONFLICT/);
  assert.equal(f.call("POST", "/rounds/status").wallet.walletVersion, result.wallet.walletVersion);
  assert.throws(() => f.call("POST", "/spin", { ...body, wallet: 10000 }), /INVALID_FIELDS/);
});
test("local bonus QA plays only selected chests and settles the requested win tier", () => {
  for (const { chests, opened, spins, winTier, payout } of [
    { chests: [false, false, false, false, false], opened: [], spins: 1, winTier: "big", payout: 20_000 },
    { chests: [true, false, true, false, false], opened: [1, 3], spins: 2, winTier: "mega", payout: 75_000 },
    { chests: [true, true, true, true, true], opened: [1, 2, 3, 4, 5], spins: 1, winTier: "max", payout: 10_000_000 },
  ]) {
    const backend = new ProposalBackend([tavern], null, { enableMockBonus: true });
    const login = backend.login({ userId: "qa-bonus" });
    const auth = { sessionId: login.sessionId, token: login.token, playToken: "" };
    const call = (path: string, body = {}): any => backend.handle("POST", path, body, auth);
    const info = call("/game-info");
    assert.equal(info.settings.mockBonusEnabled, true);
    auth.playToken = info.playToken;
    const buy = { betMinor: 1000, featureMode: "drop", mockBonus: { chests, spins, winTier } };
    assert.throws(() => call("/buy-feature", { ...buy, mockBonus: { ...buy.mockBonus, spins: 0 } }), /INVALID_MOCK_BONUS/);
    let result = call("/buy-feature", buy);
    const balanceAfterBuy = result.wallet.confirmedBalanceMinor;
    assert.deepEqual(call("/buy-feature", buy), result);
    assert.equal(result.freegame.remainSpin, spins);
    const reveals: number[] = [];
    let count = 0;
    while (result.step) {
      const step = result.step;
      if (step.curStep === "freespin") count++;
      if (step.curStep === "show-chest") assert.deepEqual(step.eligibleReels, opened);
      if (step.curStep === "open-chest") reveals.push(step.reel);
      if (step.curStep === "free-end") assert.equal(step.finalRoundAwardMinor, payout);
      assert.equal(result.wallet.confirmedBalanceMinor, balanceAfterBuy);
      const ack = { isFreespin: 1, curStep: step.curStep, stepId: step.stepId };
      result = call("/spin", ack);
      assert.deepEqual(call("/spin", ack), result);
    }
    assert.deepEqual(reveals, opened);
    assert.equal(count, spins);
    assert.equal(result.canStartPaidRound, true);
    assert.equal(result.wallet.confirmedBalanceMinor, balanceAfterBuy + payout);
  }
  const normal = new ProposalBackend([tavern], null);
  const login = normal.login({ userId: "normal-player" });
  const auth = { sessionId: login.sessionId, token: login.token, playToken: "" };
  const info = normal.handle("POST", "/game-info", {}, auth);
  auth.playToken = info.playToken as string;
  assert.throws(() => normal.handle("POST", "/buy-feature", { betMinor: 1000, featureMode: "drop", mockBonus: {} }, auth), /INVALID_FIELDS/);
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


test("proposal lists the exact ordered KRW stakes and uses the original stake in each mode", (t) => {
  const approved = [
    200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000,
    4000, 5000, 6000, 8000, 10000, 15000, 20000, 30000, 40000,
    50000, 60000, 80000, 100000, 150000, 200000,
  ];
  assert.deepEqual(tavern.bets, approved);
  const modes = [
    ["/spin", { isFreespin: 0, chanceMode: "normal" }, 1],
    ["/spin", { isFreespin: 0, chanceMode: "extra" }, 3],
    ["/spin", { isFreespin: 0, chanceMode: "super" }, 6],
    ["/buy-feature", { featureMode: "tavern" }, 125],
    ["/buy-feature", { featureMode: "drop" }, 300],
  ] as const;
  for (const [path, mode, price] of modes) {
    const f = fixture(t);
    const info = f.call("POST", "/game-info");
    assert.deepEqual(info.settings.allowedBetMinor, approved);
    f.auth.playToken = info.playToken;
    assert.throws(() => f.call("POST", path, { ...mode, betMinor: 12000 }), /INVALID_BET/);
    const result = f.call("POST", path, { ...mode, betMinor: 20_000 });
    assert.equal(result.originalBaseBetMinor, 20_000);
    assert.equal(result.chargedMinor, 20_000 * price);
    assert.equal(result.roundCapMinor, 200_000_000);
  }
});

for (const [expected, board] of [[79_000, win79k], [0, zeroWin]] as const) {
  test(`base completion restores the stored KRW ${expected} and settles only once`, (t) => {
    const f = fixture(t, board);
    f.auth.playToken = f.call("POST", "/game-info").playToken;
    const body = { isFreespin: 0, betMinor: 20_000, chanceMode: "normal" };
    const paid = f.call("POST", "/spin", body);
    assert.equal(paid.totalwin_amt, expected);
    assert.equal(paid.wallet.confirmedBalanceMinor, 9_980_000);
    assert.equal(paid.presentedThrough, 0);
    assert.equal(paid.canStartPaidRound, false);
    f.restart();
    f.relogin();
    assert.deepEqual(f.call("POST", "/spin", body), paid);
    const resumed = f.call("POST", "/game-info");
    assert.equal(resumed.resume.mode, "show_stored_result");
    assert.equal(resumed.resume.roundId, paid.roundId);
    assert.deepEqual(resumed.resume.step, paid.step);
    const ack = { isFreespin: 1, curStep: "base", stepId: paid.stepId };
    const final = f.call("POST", "/spin", ack);
    assert.equal(final.finalRoundAwardMinor, expected);
    assert.equal(final.wallet.confirmedBalanceMinor, 9_980_000 + expected);
    assert.equal(final.settlement.status, expected ? "paid" : "no_payout");
    assert.equal(final.canStartPaidRound, true);
    assert.ok(final.playToken);
    assert.deepEqual(f.call("POST", "/spin", { ...ack, kind: "shown_as_result" }), final);
    assert.equal(f.call("POST", "/rounds/status").wallet.walletVersion, final.wallet.walletVersion);
  });
}
