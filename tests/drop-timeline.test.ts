import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dropEnterStartUnits, dropExitUnits, planDropEnter, planDropExit, type DropTimelineConfig,
} from "../src/framework/presentation/drop-timeline.ts";
import { resolveEase } from "../src/framework/presentation/custom-ease.ts";

// Tavern Drop v13 reference values (jn in the reference bundle).
const config: DropTimelineConfig = {
  unitsPerRow: 564,
  exit: {
    durationMs: 340, turboDurationMs: 90, distance: 3400, ease: "power3.in",
    rowStaggerMs: 40, turboRowStaggerMs: 10, reelStaggerMs: 0, turboReelStaggerMs: 15,
    cutoffMs: 220, cutoffDurationMs: 50,
  },
  enter: {
    durationMs: 290, turboDurationMs: 120, startY: -2200, rowStartStep: 100,
    ease: "M0,0 C0.566,0.382 0.689,1.015 0.689,1.015 0.689,1.015 0.749,0.989 0.855,0.989 0.945,0.989 0.931,0.989 1,1",
    rowStaggerMs: 40, turboRowStaggerMs: 15, reelStaggerMs: 70, turboReelStaggerMs: 15,
    waitMs: 350, turboWaitMs: 50, landLeadMs: 250,
  },
  anticipation: { minCount: 2, maxCount: 3, rowStaggerMs: 100, pauseMs: 800 },
};
const blank = (reels = 5, rows = 5) => Array.from({ length: reels }, () => Array<string>(rows).fill("a"));
const at = (plan: { tiles: { reel: number; row: number; startMs: number }[] }, reel: number, row: number) =>
  plan.tiles.find((t) => t.reel === reel && t.row === row)!.startMs;

test("exit: all reels together, bottom row first, cut at 220 ms", () => {
  const plan = planDropExit(5, 5, config, false);
  assert.equal(at(plan, 3, 4), 0);
  assert.equal(at(plan, 0, 0), 160);
  assert.equal(plan.tiles[0].durationMs, 270);
  assert.equal(plan.endMs, 430);
  const turbo = planDropExit(5, 5, config, true);
  assert.equal(at(turbo, 4, 4), 60);
  assert.equal(at(turbo, 4, 0), 100);
  assert.equal(turbo.endMs, 190);
});

test("exit offset follows power3.in, then finishes from the cut point", () => {
  const ease = resolveEase("power3.in");
  assert.equal(dropExitUnits(170, config, false, ease), 3400 * 0.5 ** 4);
  const atCut = 3400 * (220 / 340) ** 4;
  assert.ok(Math.abs(dropExitUnits(220, config, false, ease) - atCut) < 1e-9);
  assert.equal(dropExitUnits(270, config, false, ease), 3400);
  assert.equal(dropExitUnits(90, config, true, ease), 3400);
});

test("enter: reels 70 ms apart, rows 40 ms apart from the bottom", () => {
  const plan = planDropEnter(blank(), 5, config, false, "bonus");
  assert.equal(at(plan, 0, 4), 0);
  assert.equal(at(plan, 0, 0), 160);
  assert.equal(at(plan, 2, 4), 140);
  assert.equal(plan.reelStops[1], 70 + 40);
  assert.equal(plan.endMs, 280 + 160 + 290);
  assert.deepEqual(plan.anticipation, []);
  const turbo = planDropEnter(blank(), 5, config, true, "bonus");
  assert.equal(at(turbo, 1, 3), 15 + 15);
  assert.equal(turbo.endMs, 60 + 60 + 120);
});

test("enter: two scatters slow the reels until the last one and pause 800 ms", () => {
  const board = blank();
  board[0][2] = "bonus";
  board[1][0] = "bonus";
  const plan = planDropEnter(board, 5, config, false, "bonus");
  // Reel 1 brings the count to 2: it drops slowly (100 ms rows) and is waited for.
  assert.deepEqual(plan.anticipation.map((a) => a.reel), [1, 2, 3]);
  assert.equal(at(plan, 1, 0), 70 + 400);
  assert.equal(at(plan, 2, 4), 70 + 500 + 800 + 70);
  // The last reel is never anticipated: anticipation ends when it starts.
  const reel4 = at(plan, 4, 4);
  assert.equal(plan.anticipationEndMs, reel4);
  assert.equal(reel4, 70 + 3 * (500 + 800 + 70));
  // Turbo never anticipates.
  assert.deepEqual(planDropEnter(board, 5, config, true, "bonus").anticipation, []);
});

test("enter start height matches the reference reset position", () => {
  assert.equal(dropEnterStartUnits(0, 564, config), -2200);
  assert.equal(dropEnterStartUnits(4, 564, config), -2200 + 400 - 4 * 564);
});
