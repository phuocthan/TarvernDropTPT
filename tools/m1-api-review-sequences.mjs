import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

// Review fixtures layered on the existing v1 wire vocabulary. They are not
// live responses, a new mock server, or a change to the fixture consumed by FE.
const source = JSON.parse(readFileSync(new URL("../docs/milestone-1-v1-examples.json", import.meta.url)));
const oldSettings = source.examples.find(({ name }) => name === "game.info").response.body.settings;
const gameCode = "tavern-drop";
const contractVersion = "than-m1-krw-review-1";
const configId = "tavern-5x5-review-1";
const now = "2026-11-19T02:00:00.000Z";
const due = "2026-12-19T02:00:00.000Z";
const infoBody = { gameCode };
const settings = {
  configId, cols: oldSettings.cols, rows: oldSettings.rows, lineCount: oldSettings.lineCount,
  currency: "KRW", currencyExponent: 0,
  betRange: { minMinor: "200", maxMinor: "200000" },
  roundCapMultiplier: 10000, symbolIds: oldSettings.symbolIds, paylines: oldSettings.paylines,
  chancePrices: { normal: 1, extra: 3, super: 6 }, buyPrices: { tavern: 125, drop: 300 },
};

const money = String;
const wallet = (amount, version, confirmedAt = now) =>
  ({ confirmedBalanceMinor: money(amount), walletVersion: version, confirmedAt });
const paid = (id, amount) => ({
  status: amount ? "paid" : "no_payout",
  creditedMinor: money(amount),
  settlementId: `fixture-settlement-${id}`,
});
const pending = { status: "pending", creditedMinor: null, settlementId: null };
const startWallet = wallet(1000000, 1);
const ready = (view, token) => ({ wallet: view, canStartPaidRound: true, playToken: `fixture-play-${token}` });
const locked = (view) => ({ wallet: view, canStartPaidRound: false });
const login = (steps, player, session) => {
  steps.push({
    label: `Mock login as ${session}`,
    request: { method: "POST", path: "/api/v1/login", headers: {}, body: { gameCode, userId: `fixture-player-${player}` } },
    response: { status: 200, body: { code: 0, contractVersion, sessionId: `fixture-session-${session}`, token: `fixture-bearer-${session}`, userId: `fixture-player-${player}` } },
  });
};
function call(steps, label, session, path, body, result, options = {}) {
  const headers = { "Session-Id": `fixture-session-${session}`, Authorization: `Bearer fixture-bearer-${session}` };
  if (options.playToken) headers["Play-Token"] = `fixture-play-${options.playToken}`;
  steps.push({
    label,
    request: { method: "POST", path: `/api/v1${path}`, headers, body: { gameCode, ...body } },
    response: {
      status: options.status ?? 200,
      ...(options.lost ? { receivedByFE: false } : {}),
      body: { code: options.status === 409 ? 409 : 0, contractVersion, ...result },
    },
  });
}
const spin = (betMinor = "1000", chanceMode = "normal") => ({ isFreespin: 0, betMinor, chanceMode });
const geometry = (row = -1, withScatter = false) => {
  const reels = Array.from({ length: 25 }, (_, i) => 6 + i % 5);
  if (row >= 0) reels.fill(6, row * 5, row * 5 + 3);
  if (withScatter) for (const pos of [11, 17, 23, 24]) reels[pos - 1] = 11;
  return reels;
};
const line = (row, award) => ({
  type: "N", lineId: row + 1, winSym: Array.from({ length: 3 }, (_, i) => row * 5 + i + 1), win_amt: money(award),
});
const boardWin = geometry(0);
boardWin.fill(7, 5, 8);
const lineWin = [line(0, 200), line(1, 300)];
function meta(id, charge) {
  return { roundId: `fixture-round-${id}`, configId, originalBaseBetMinor: "1000", chargedMinor: money(charge), roundCapMinor: "10000000" };
}
const normalResult = (id, charge, win, previous, version, token) => ({
  ...meta(id, charge), releasedThrough: 1, presentedThrough: 0,
  presentationStatus: "completed", settlement: paid(id, win), finalRoundAwardMinor: money(win),
  freegame: null, reels: win ? boardWin : geometry(), winLines: win ? lineWin : [], totalwin_amt: money(win),
  ...ready(wallet(previous - charge + win, version), token),
});
const info = (view, state = {}) => ({ settings, lastReels: geometry(), freegame: null, resume: null, ...view, ...state });
const normalResume = (round) => ({
  mode: "show_stored_result", roundId: round.roundId,
  step: { curStep: "base", reels: round.reels, winLines: round.winLines, totalwin_amt: round.totalwin_amt, finalRoundAwardMinor: round.finalRoundAwardMinor },
});
const normal = [];
login(normal, "normal", "n1");
call(normal, "Get game settings", "n1", "/game-info", infoBody, info(ready(startWallet, "n-win")));
const win = normalResult("n-win", 1000, 500, 1000000, 3, "n-loss");
const loss = normalResult("n-loss", 1000, 0, 999500, 4, "n-next");
call(normal, "Normal win; present the board once", "n1", "/spin", spin(), win, { playToken: "n-win" });
call(normal, "Normal loss; zero-win closure", "n1", "/spin", spin(), loss, { playToken: "n-loss" });
login(normal, "normal", "n2");
call(normal, "Interrupted presentation of settled loss; display stored zero and allow Spin", "n2", "/game-info", infoBody,
  info(loss, { lastReels: loss.reels, resume: normalResume(loss) }));

const lost = [];
login(lost, "lost", "l1");
call(lost, "Get entitlement before wager", "l1", "/game-info", infoBody, info(ready(startWallet, "l-play")));
const original = normalResult("lost", 3000, 500, 1000000, 3, "l-next");
call(lost, "Extra spin accepted; debit and award saved, reply lost", "l1", "/spin", spin("1000", "extra"), original, { playToken: "l-play", lost: true });
login(lost, "lost", "l2");
call(lost, "Fresh session on same account finds original paid round without replay", "l2", "/game-info", infoBody,
  info(original, { lastReels: original.reels, resume: normalResume(original) }));
call(lost, "Retry exact original request under the fresh session", "l2", "/spin", spin("1000", "extra"), original, { playToken: "l-play" });
for (const [label, body] of [["Changed amount", spin("2000", "extra")], ["Changed mode", spin("1000", "super")]]) {
  call(lost, `${label} on consumed token is rejected`, "l2", "/spin", body, { error: "REQUEST_CONFLICT" }, { status: 409, playToken: "l-play" });
}

const feature = [];
login(feature, "feature", "f1");
call(feature, "Get game settings", "f1", "/game-info", infoBody, info(ready(startWallet, "f-play")));
const featureWallet = wallet(999000, 2);
const featureRound = { ...meta("feature", 1000), ...locked(featureWallet), settlement: pending, presentationStatus: "pending" };
const g = (curSpin, totalSpins, total, keyPositions, curStep) =>
  ({ featureMode: "drop", totalSpins, curSpin, remainSpin: totalSpins - curSpin, totalWinMinor: money(total), curStep, keyPositions });
const triggerPositions = [11, 17, 23, 24];
const triggerBoard = [...boardWin];
for (const position of triggerPositions) triggerBoard[position - 1] = 11;
const intro = {
  stepId: "fixture-step-f-intro", curStep: "intro", freegame: g(0, 10, 500, [], "intro"),
  reels: triggerBoard, winLines: lineWin, totalwin_amt: "500",
  bonusEntry: { featureMode: "drop", triggerPositions }, displayWinMinor: "500",
};
const expose = (step, released) => ({
  ...featureRound, releasedThrough: released, presentedThrough: released - 1,
  stepId: step.stepId, step, freegame: step.freegame, reels: step.reels,
  winLines: step.winLines ?? [], totalwin_amt: step.totalwin_amt ?? "0",
});
call(feature, "Normal spin hits Scatter trigger; the two lines pay 200 + 300", "f1", "/spin", spin(), expose(intro, 2), { playToken: "f-play" });
const ack = ({ curStep, stepId }) => ({ isFreespin: 1, curStep, stepId });
let keys = [];
const freeSpins = Array.from({ length: 15 }, (_, index) => {
  const row = index < 5 ? index : -1;
  const wins = row >= 0 ? [line(row, 200)] : [];
  keys = [...keys, ...wins.flatMap((win) => win.winSym)];
  const step = {
    stepId: `fixture-step-f-spin-${index + 1}`, curStep: "freespin",
    reels: geometry(row, index === 0), winLines: wins, totalwin_amt: wins.length ? "200" : "0",
    freegame: g(index + 1, 15, 500 + Math.min(index + 1, 5) * 200, keys, "freespin"),
  };
  if (index === 0) {
    step.retriggerSpins = 5;
    step.retriggerPositions = triggerPositions;
  }
  return step;
});
call(feature, "Complete intro and release spin 1", "f1", "/spin", ack(intro), expose(freeSpins[0], 3));
login(feature, "feature", "f2");
const showSpin = expose(freeSpins[0], 3);
call(feature, "Interrupted spin 1 returns after-result counters, keys, win and retrigger", "f2", "/game-info", infoBody,
  info(featureRound, { releasedThrough: 3, presentedThrough: 2, lastReels: showSpin.reels, freegame: showSpin.freegame,
    resume: { mode: "show_stored_result", roundId: featureRound.roundId, step: showSpin.step, snapshot: showSpin.step } }));
const showSecond = expose(freeSpins[1], 4);
call(feature, "Tab B confirms static result and gets spin 2", "f2", "/spin",
  { ...ack(freeSpins[0]), kind: "shown_as_result" }, showSecond);
call(feature, "Tab A confirms same step after its animation; return same spin 2", "f1", "/spin", ack(freeSpins[0]), showSecond);
for (let i = 1; i < freeSpins.length - 1; i++) {
  call(feature, `Complete free spin ${i + 1} to release spin ${i + 2}`, "f2", "/spin", ack(freeSpins[i]), expose(freeSpins[i + 1], i + 4));
}
const preview = {
  stepId: "fixture-step-f-preview", curStep: "show-chest", eligibleReels: [1, 2, 3],
  reels: geometry(), freegame: g(15, 15, 1500, keys, "show-chest"), displayWinMinor: "1500", openedChests: [],
};
call(feature, "Last free spin completes; release chest summary without values", "f2", "/spin", ack(freeSpins.at(-1)), expose(preview, 18));
const chest = (reel, multiplier, total, previouslyOpened) => ({
  stepId: `fixture-step-f-chest-${reel}`, curStep: "open-chest", reel, multiplier,
  reels: geometry(), freegame: g(15, 15, total, keys, "open-chest"),
  displayWinAfterMinor: money(total), openedChests: [...previouslyOpened, { reel, multiplier }],
});
const first = chest(1, 5, 5500, []);
const second = chest(2, 2, 10500, first.openedChests);
const third = chest(3, 3, 30500, second.openedChests);
call(feature, "Chest summary completes; release only chest 1", "f2", "/spin", ack(preview), expose(first, 19));
call(feature, "Chest 1 animation and amount both shown; release only chest 2", "f2", "/spin", ack(first), expose(second, 20));
login(feature, "feature", "f3");
call(feature, "Interrupt chest 2; restore chest 1 at 5500 then replay chest 2", "f3", "/game-info", infoBody,
  info(featureRound, { releasedThrough: 20, presentedThrough: 19, freegame: second.freegame,
    resume: { mode: "play_step", roundId: featureRound.roundId, snapshot: first, step: second } }));
for (const tab of ["f3", "f2"]) {
  call(feature, `Tab ${tab} confirms chest 2; reply contains same chest 3`, tab, "/spin", ack(second), expose(third, 21));
}
const final = { ...third, stepId: "fixture-step-f-final", curStep: "free-end", freegame: g(15, 15, 30500, keys, "free-end"), displayWinMinor: "30500", finalRoundAwardMinor: "30500" };
delete final.multiplier;
delete final.reel;
delete final.displayWinAfterMinor;
call(feature, "Release Total Win with payment still pending", "f3", "/spin", ack(third), expose(final, 22));
const featureDone = { ...featureRound, presentationStatus: "completed", releasedThrough: 22, presentedThrough: 22,
  settlement: paid("feature", 30500), finalRoundAwardMinor: "30500", freegame: null, resume: null,
  ...ready(wallet(1029500, 3), "f-next") };
for (const tab of ["f3", "f2"]) {
  call(feature, `Tab ${tab} confirms Total Win; return the same settlement`, tab, "/spin", ack(final), featureDone);
}

const expiry = [];
login(expiry, "expiry", "e1");
call(expiry, "Get Drop Buy entitlement", "e1", "/game-info", infoBody, info(ready(startWallet, "e-play")));
const expiryWallet = wallet(700000, 2);
const expiryRound = {
  ...meta("expiry", 300000), ...locked(expiryWallet), inactivityDeadlineAt: due,
  releasedThrough: 2, presentedThrough: 1, presentationStatus: "pending", settlement: pending,
};
const expiryIntro = { ...intro, stepId: "fixture-step-e-intro", freegame: g(0, 10, 0, [], "intro"), winLines: [], totalwin_amt: "0", displayWinMinor: "0" };
call(expiry, "Drop Buy at 300x base; cap still uses original 1000", "e1", "/buy-feature",
  { betMinor: "1000", featureMode: "drop" }, { ...expiryRound, step: expiryIntro, stepId: expiryIntro.stepId, freegame: expiryIntro.freegame },
  { playToken: "e-play" });
call(expiry, "Background read before deadline does not extend it", "e1", "/game-info", infoBody,
  info(expiryRound, { lastReels: expiryIntro.reels, freegame: expiryIntro.freegame,
    resume: { mode: "play_step", roundId: expiryRound.roundId, step: expiryIntro } }));
expiry.at(-1).at = "2026-12-18T12:00:00.000Z";
expiry.push({ label: "Server closes after 30 days; wallet settlement still uncertain", at: due, serverEvent: "AUTO_CLOSE" });
login(expiry, "expiry", "e2");
const uncertain = { ...expiryRound, presentationStatus: "auto_closed",
  settlement: { ...pending, status: "uncertain" }, finalRoundAwardMinor: null, resume: null };
call(expiry, "Wallet uncertain: no final amount or summary and Spin remains disabled", "e2", "/game-info", infoBody, info(uncertain));
expiry.push({ label: "Server reconciles the original settlement", at: "2026-12-19T02:03:00.000Z", serverEvent: "WALLET_CONFIRMED" });
const summary = { mode: "final_summary", roundId: expiryRound.roundId, summaryId: "fixture-summary-e", finalRoundAwardMinor: "60400" };
const confirmed = { ...uncertain, wallet: wallet(760400, 3, "2026-12-19T02:03:00.000Z"),
  settlement: paid("expiry", 60400), finalRoundAwardMinor: "60400", resume: summary };
call(expiry, "Wallet confirmed: display only final Total Win; keep Spin disabled until dismiss", "e2", "/game-info", infoBody, info(confirmed));
const dismiss = { isFreespin: 0, curStep: "final-summary", summaryId: summary.summaryId };
const dismissed = { ...confirmed, resume: null, ...ready(confirmed.wallet, "e-next") };
call(expiry, "Dismiss summary; next bet allowed, reply lost", "e2", "/spin", dismiss, dismissed, { lost: true });
call(expiry, "Retry lost dismissal response; keep the same receipt and balance", "e2", "/spin", dismiss, dismissed);
call(expiry, "Read now shows no pending summary", "e2", "/game-info", infoBody, info(dismissed));

const sequences = [
  { id: "01-normal-win-loss", steps: normal },
  { id: "02-lost-paid-response", steps: lost },
  { id: "03-feature-resume-two-tabs", steps: feature },
  { id: "04-inactivity-expiry-summary", steps: expiry },
];

const moneyField = /Minor$|^(win_amt|totalwin_amt)$/;
function verify(value, key = "") {
  if (moneyField.test(key) && value !== null) assert.match(value, /^(0|[1-9][0-9]*)$/, key);
  if (Array.isArray(value)) return value.forEach((item) => verify(item));
  if (!value || typeof value !== "object") return;
  if (value.reels) assert.equal(value.reels.length, 25);
  if (value.winLines) {
    for (const win of value.winLines) {
      assert.equal(win.type, "N");
      const positions = settings.paylines.find((line) => line.lineId === win.lineId).positions;
      assert.deepEqual(win.winSym, positions.slice(0, win.winSym.length));
      if (value.reels) assert.equal(new Set(win.winSym.map((pos) => value.reels[pos - 1])).size, 1);
    }
    assert.equal(value.totalwin_amt, money(value.winLines.reduce((sum, line) => sum + BigInt(line.win_amt), 0n)));
  }
  if (value.totalSpins !== undefined) assert.equal(value.totalSpins - value.curSpin, value.remainSpin);
  if (value.presentedThrough !== undefined) assert.ok(value.presentedThrough <= value.releasedThrough);
  if (value.originalBaseBetMinor) {
    assert.equal(BigInt(value.roundCapMinor), 10000n * BigInt(value.originalBaseBetMinor));
    if (value.finalRoundAwardMinor) assert.ok(BigInt(value.finalRoundAwardMinor) <= BigInt(value.roundCapMinor));
  }
  for (const [name, item] of Object.entries(value)) verify(item, name);
}
sequences.forEach((entry) => verify(entry));
assert.deepEqual(lost[2].response.body, lost[5].response.body);
for (const stepId of [freeSpins[0].stepId, second.stepId, final.stepId]) {
  const receipts = feature.filter(({ request }) => request.body.stepId === stepId);
  assert.equal(receipts.length, 2);
  assert.notEqual(receipts[0].request.headers["Session-Id"], receipts[1].request.headers["Session-Id"]);
  assert.deepEqual(receipts[0].response.body, receipts[1].response.body);
}
assert.deepEqual(expiry.at(-3).response.body, expiry.at(-2).response.body);
assert.equal(expiry[3].response.body.inactivityDeadlineAt, expiry[2].response.body.inactivityDeadlineAt);
assert.equal(expiry[3].response.body.inactivityDeadlineAt, uncertain.inactivityDeadlineAt);
assert.equal(uncertain.canStartPaidRound, false);
assert.equal(uncertain.finalRoundAwardMinor, null);
assert.equal(uncertain.resume, null);
assert.equal(confirmed.canStartPaidRound, false);
assert.equal(dismissed.canStartPaidRound, true);
assert.equal(confirmed.wallet.confirmedBalanceMinor, money(1000000 - 300000 + 60400));
assert.equal(featureDone.wallet.confirmedBalanceMinor, money(1000000 - 1000 + 30500));
assert.equal(loss.settlement.status, "no_payout");
assert.equal(original.wallet.confirmedBalanceMinor, money(1000000 - 3000 + 500));
assert.ok(triggerPositions.every((pos) => intro.reels[pos - 1] === 11 && freeSpins[0].reels[pos - 1] === 11));
assert.equal(preview.multiplier, undefined);
assert.equal(first.openedChests.length, 1);
assert.equal(second.openedChests.length, 2);
assert.equal(third.openedChests.length, 3);

const output = {
  contractVersion, synthetic: true, currency: "KRW", currencyExponent: 0,
  source: "Uses existing local mock route/field vocabulary and verified geometry. Amounts and transitions are scripted for review; neither live server output nor approved math.",
  sequences,
};
writeFileSync(new URL("../docs/m1-api-review-sequences.json", import.meta.url), JSON.stringify(output, null, 2) + "\n");
console.log(`Validated ${sequences.length} sequences and ${sequences.flatMap(({ steps }) => steps).filter(({ request }) => request).length} request/response pairs.`);
