import { test } from "node:test";
import assert from "node:assert/strict";
import { tavern } from "../src/games/tavern/definition.ts";
import {
  evaluate,
  collect,
  settleFeature,
  validateDefinition,
} from "../src/framework/domain/rules.ts";
import { MockGame } from "../server/mock-game.ts";
const board = () => Array.from({ length: 5 }, () => ["A", "K", "Q", "J", "10"]);
const command = (
  state: MockGame,
  requestId: string,
  action: "spin" | "buy-tavern" | "buy-drop" = "spin",
) => ({
  requestId,
  expectedVersion: state.state.version,
  action,
  bet: 100,
  chance: "standard" as const,
});
test("definition and all 15 line paths stay inside the board", () => {
  validateDefinition(tavern);
  assert.equal(tavern.lines.length, 15);
  assert.equal(tavern.symbols.length, 11);
});
test("Wild prefix selects best valid symbol without paying duplicate substitutions", () => {
  const b = board();
  b[0][0] = "wild";
  b[1][0] = "wild";
  b[2][0] = "crown";
  b[3][0] = "crown";
  b[4][0] = "crown";
  const wins = evaluate(tavern, b, 100).filter((w) => w.line === 0);
  assert.equal(wins.length, 1);
  assert.equal(wins[0].symbol, "crown");
  assert.equal(wins[0].amount, 500);
});
test("chest collects distinct winning rows across lines and spins", () => {
  const chests = Array.from({ length: 5 }, () => ({
    rows: [] as number[],
    unlocked: false,
    multiplier: null,
  }));
  const wins = evaluate(tavern, board(), 100);
  collect(chests, wins, 5);
  const before = chests[0].rows.length;
  assert.equal(collect(chests, wins, 5).length, 0);
  assert.equal(chests[0].rows.length, before);
  assert.equal(chests[0].unlocked, true);
});
test("settlement multiplies all chest multipliers and caps entire paid round", () => {
  const result = settleFeature(100, [2, 3, 1, 1, 1], 200, 700);
  assert.equal(result.product, 6);
  assert.equal(result.featureAward, 500);
  assert.equal(result.roundAward, 700);
  assert.equal(result.capped, true);
});
test("retrying a command returns same result without another debit", () => {
  const server = new MockGame(tavern, () => 0.5),
    c = command(server, "same");
  const a = server.execute(c, board()),
    balance = server.state.balance;
  assert.deepEqual(server.execute(c), a);
  assert.equal(server.state.balance, balance);
  assert.throws(() => server.execute({ ...c, bet: 200 }), /REQUEST_CONFLICT/);
});
test("paid and free spin wallet accounting, locked bet and bonus buy", () => {
  const server = new MockGame(tavern, () => 0.5);
  server.execute(command(server, "buy", "buy-tavern"));
  assert.equal(server.state.balance, 95000);
  assert.equal(server.state.feature?.remaining, 8);
  const balance = server.state.balance;
  server.execute(command(server, "free"), board());
  assert.equal(server.state.balance, balance);
  assert.equal(server.state.feature?.remaining, 7);
  assert.throws(
    () => server.execute({ ...command(server, "bad"), bet: 200 }),
    /FEATURE_LOCKED/,
  );
});
test("naturally triggered feature keeps its paid round and retriggers stay bounded", () => {
  const server = new MockGame(tavern, () => 0.5),
    b = board();
  b[0][0] = "bonus";
  b[1][1] = "bonus";
  b[2][2] = "bonus";
  const result = server.execute(command(server, "entry"), b);
  assert.equal(result.entry, "tavern");
  for (let n = 0; n < 60 && server.state.feature; n++)
    server.execute(command(server, "f" + n), b);
  assert.equal(server.state.feature, null);
});
test("buy Drop has a distinct mode and completion credits feature once", () => {
  const server = new MockGame(tavern, () => 0.5);
  server.execute(command(server, "buy", "buy-drop"));
  assert.equal(server.state.feature?.mode, "drop");
  let completion;
  while (server.state.feature) {
    completion = server.execute(
      command(server, "spin" + server.state.version),
      board(),
    );
  }
  assert.ok(completion?.completion);
  const balance = server.state.balance;
  assert.equal(balance, 90000 + completion!.completion!.featureAward);
  assert.equal(completion!.completion!.product, 3 ** 5);
});
test("losing and single-line boards remain distinct", () => {
  const b = Array.from({ length: 5 }, (_, c) =>
    Array(5).fill(["A", "K", "Q", "J", "10"][c]),
  );
  assert.equal(evaluate(tavern, b, 100).length, 0);
  for (let c = 0; c < 5; c++) b[c][2] = "A";
  const wins = evaluate(tavern, b, 100);
  assert.equal(wins.length, 1);
  assert.equal(wins[0].line, 2);
});
test("feature termination caps award across the full round and never double-credits base", () => {
  const game = structuredClone(tavern);
  game.demo.capMultiplier = 5;
  const server = new MockGame(game, () => 0.5);
  server.execute(command(server, "buy", "buy-tavern"));
  server.state.round!.baseWin = 200;
  server.state.balance += 200;
  const before = server.state.balance;
  const result = server.execute(command(server, "cap"), board());
  assert.equal(result.completion?.roundAward, 500);
  assert.equal(result.completion?.featureAward, 300);
  assert.equal(server.state.balance, before + 300);
  assert.equal(server.state.feature, null);
});
test("base round cap is reflected in the returned amount and wallet", () => {
  const game = structuredClone(tavern);
  game.demo.capMultiplier = 1;
  const server = new MockGame(game, () => 0.5);
  const result = server.execute(command(server, "base-cap"), board());
  assert.equal(result.capped, true);
  assert.equal(result.spinWin, 100);
  assert.equal(result.paidAward, 100);
  assert.equal(server.state.balance, game.demo.initialBalance);
});
