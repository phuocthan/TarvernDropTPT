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
import { loadGameConfig } from "../src/framework/game-config.ts";
import { reuse } from "../src/games/reuse/definition.ts";
import { planDropColumns } from "../src/framework/presentation/drop-schedule.ts";
import { audioSpriteCues } from "../src/framework/presentation/audio.ts";
import { alignReelGrid, keepWithinVerticalViewport, reelCellCenter } from "../src/framework/presentation/grid.ts";
const board = () => Array.from({ length: 5 }, () => ["A", "K", "Q", "J", "10"]);
test("Drop anticipation serializes remaining reels after two Scatters land", () => {
  const result = [["bonus"], ["bonus"], ["A"], ["A"], ["A"]];
  assert.deepEqual(planDropColumns(result, 76, 390, {
    symbolId: "bonus", count: 2, reelPauseMs: 800,
  }), { starts: [0, 76, 1266, 2456, 3646], anticipationAt: 466 });
  assert.deepEqual(planDropColumns(result, 76, 390), {
    starts: [0, 76, 152, 228, 304], anticipationAt: undefined,
  });
});
test("audio sprite cues share fallback files and use millisecond ranges", () => {
  const cues = audioSpriteCues({
    src: ["./media/sounds.ogg", "./media/sounds.mp3"],
    sprite: { music: [120, 2400, true], invalid: [-10, 15] },
  }, "https://example.test/game/");
  assert.deepEqual(cues, { music: {
    sources: ["https://example.test/game/media/sounds.ogg", "https://example.test/game/media/sounds.mp3"],
    offsetMs: 120, durationMs: 2400, loop: true,
  } });
});
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
  assert.deepEqual(tavern.lines.map((line) => line.join("")), [
    "00000", "11111", "22222", "33333", "44444",
    "01010", "12121", "23232", "34343", "10101",
    "21212", "32323", "43434", "01234", "43210",
  ]);
  assert.equal(tavern.symbols.length, 11);
});
test("the authored payline grid aligns unequal source pitches with the reel cells", () => {
  const layout = tavern.presentation;
  const { reelPitch, rowPitch } = layout.animationGrid!;
  const origin = { x: -1147.22, y: -1199.99 };
  const aligned = alignReelGrid(layout, { ...origin, reelPitch, rowPitch });
  for (const position of [{ reel: 0, row: 0 }, { reel: 4, row: 4 }]) {
    const { x, y } = reelCellCenter(position, layout);
    assert.ok(Math.abs(aligned.x + (origin.x + position.reel * reelPitch) * aligned.scaleX - x) < 0.001);
    assert.ok(Math.abs(aligned.y + (origin.y + position.row * rowPitch) * aligned.scaleY - y) < 0.001);
  }
});
test("reel edge correction translates only the outlines crossing its vertical safe area", () => {
  assert.equal(keepWithinVerticalViewport({ top: -20, bottom: 110 }, 542, 4), 24);
  assert.equal(keepWithinVerticalViewport({ top: 448, bottom: 561 }, 542, 4), -23);
  assert.equal(keepWithinVerticalViewport({ top: 4, bottom: 538 }, 542, 4), 0);
  assert.equal(loadGameConfig(tavern).presentation.symbolEdgeInsetPx, undefined);
  const game = structuredClone(tavern);
  game.presentation.symbolEdgeInsetPx = 271;
  assert.throws(() => loadGameConfig(game), /presentation.symbolEdgeInsetPx/);
});
test("config validation rejects invalid board geometry, symbol IDs and timing", () => {
  const game = structuredClone(reuse);
  game.initialBoard[0][0] = "missing";
  assert.throws(() => loadGameConfig(game), /initialBoard/);
  game.initialBoard = structuredClone(reuse.initialBoard);
  game.lines[0][0] = 0.5;
  assert.throws(() => loadGameConfig(game), /Invalid paylines/);
  game.lines = structuredClone(reuse.lines);
  game.presentation.normal.speedPxPerSecond = 0;
  assert.throws(() => loadGameConfig(game), /presentation.normal/);
  game.presentation.normal.speedPxPerSecond = reuse.presentation.normal.speedPxPerSecond;
  game.presentation.drop.turboMultiplier = 3.2;
  assert.equal(loadGameConfig(game).presentation.drop.turboMultiplier, 3.2);
  game.presentation.drop.turboMultiplier = 0.9;
  assert.throws(() => loadGameConfig(game), /presentation.drop/);
  game.presentation.drop.turboMultiplier = reuse.presentation.drop.turboMultiplier;
  assert.equal(loadGameConfig(game).presentation.feature, undefined);
  game.presentation.feature = { startDelayMs: 2000, endDelayMs: 2000 };
  assert.deepEqual(loadGameConfig(game).presentation.feature, {
    startDelayMs: 2000,
    endDelayMs: 2000,
  });
  game.presentation.feature.endDelayMs = -1;
  assert.throws(() => loadGameConfig(game), /presentation.feature/);
});
test("config validates the win dimmer and scene effects for known symbols", () => {
  const game = structuredClone(tavern);
  assert.equal(loadGameConfig(game).presentation.winDimmerOpacity, 0.5);
  game.presentation.winDimmerOpacity = 1.1;
  assert.throws(() => loadGameConfig(game), /presentation.winDimmerOpacity/);
  game.presentation.winDimmerOpacity = 0;
  game.presentation.symbolLandingEffects = { missing: { scene: "land" } };
  assert.throws(() => loadGameConfig(game), /presentation.symbolLandingEffects/);
  game.presentation.symbolLandingEffects = { A: { scene: " " } };
  assert.throws(() => loadGameConfig(game), /presentation.symbolLandingEffects/);
  game.presentation.symbolLandingEffects = { A: { scene: "land" } };
  assert.equal(loadGameConfig(game).presentation.symbolLandingEffects?.A.scene, "land");
});
test("the 3 by 3 config disables bonus purchases and higher chances", () => {
  const server = new MockGame(reuse);
  assert.throws(() => server.execute(command(server, "buy", "buy-tavern")), /INVALID_COMMAND/);
  assert.throws(() => server.execute({ ...command(server, "chance"), chance: "extra" }), /INVALID_COMMAND/);
  assert.equal(server.state.version, 0);
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
  assert.equal(server.state.feature?.remaining, 10);
  const balance = server.state.balance;
  server.execute(command(server, "free"), board());
  assert.equal(server.state.balance, balance);
  assert.equal(server.state.feature?.remaining, 9);
  assert.throws(
    () => server.execute({ ...command(server, "bad"), bet: 200 }),
    /FEATURE_LOCKED/,
  );
});
test("Tavern retrigger adds five free spins", () => {
  const server = new MockGame(tavern, () => 0.5);
  server.execute(command(server, "buy-retrigger", "buy-tavern"));
  const b = board();
  for (let reel = 0; reel < 3; reel++) b[reel][0] = "bonus";
  const outcome = server.execute(command(server, "retrigger"), b);
  assert.equal(outcome.retrigger, 5);
  assert.equal(outcome.state.feature?.remaining, tavern.demo.featureSpins.tavern - 1 + 5);
});
test("bonus purchases land the exact number of Scatters on distinct reels", () => {
  for (const [action, mode, count] of [
    ["buy-tavern", "tavern", 3],
    ["buy-drop", "drop", 4],
  ] as const) {
    const server = new MockGame(tavern, () => 0);
    const buy = command(server, "buy", action);
    const result = server.execute(buy);
    const scatterCounts = result.state.board.map(
      (reel) => reel.filter((id) => id === "bonus").length,
    );
    assert.equal(result.entry, mode);
    assert.equal(result.state.feature?.played, 0);
    assert.equal(scatterCounts.filter((scatters) => scatters === 1).length, count);
    assert.equal(scatterCounts.reduce((sum, scatters) => sum + scatters, 0), count);
    assert.deepEqual(server.execute(buy), result);
  }
});
test("free spins favor first-chest progress using the sampled Scatter positions", () => {
  let draws: number[] = [];
  const server = new MockGame(tavern, () => draws.shift() ?? 0.5);
  server.execute(command(server, "buy", "buy-tavern"));
  const symbols = tavern.symbols.filter((symbol) => symbol.kind !== "bonus");
  const sample = (id: string) =>
    (symbols.findIndex((symbol) => symbol.id === id) + 0.5) / symbols.length;
  const losingColumns = ["A", "K", "Q", "J", "10"];
  draws = losingColumns.flatMap((id, reel) =>
    Array.from({ length: 5 }, (_, row) =>
      reel === 4 && row === 4 ? [0] : [0.5, sample(id)],
    ).flat(),
  );
  draws.push(...board().flat().map(sample));
  const result = server.execute(command(server, "free"));
  assert.equal(result.state.board[4][4], "bonus");
  assert.equal(result.state.feature?.chests[0].unlocked, true);
  assert.equal(result.retrigger, 0);
  assert.equal(draws.length, 0);
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
  const server = new MockGame(tavern, () => 0);
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
  assert.equal(completion!.completion!.product, 5 ** 5);
});
test("three and four Scatters trigger the correct chest multiplier minimums", () => {
  for (const [scatters, mode, minimum] of [
    [3, "tavern", 2],
    [4, "drop", 5],
  ] as const) {
    const game = structuredClone(tavern);
    game.demo.featureSpins[mode] = 1;
    const server = new MockGame(game, () => 0);
    const trigger = board();
    for (let reel = 0; reel < scatters; reel++) trigger[reel][0] = "bonus";
    assert.equal(server.execute(command(server, "entry"), trigger).entry, mode);
    const result = server.execute(command(server, "free"), board());
    assert.deepEqual(result.completion?.multipliers, Array(5).fill(minimum));
  }
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
