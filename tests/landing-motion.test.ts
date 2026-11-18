import { test } from "node:test";
import assert from "node:assert/strict";
import { landingDuration, landingScale, landingOffset } from "../src/framework/presentation/landing-motion.ts";
import { reuse } from "../src/games/reuse/definition.ts";
import { loadGameConfig } from "../src/framework/game-config.ts";
const config = reuse.presentation.landing!;
test("landing preserves rest size before motion, after completion, and when skipped", () => {
  assert.equal(landingDuration(config), 280);
  for (const time of [-80, 0, 280, 1000, Infinity]) assert.deepEqual(landingScale(time, config), { x: 1, y: 1 });
  assert.deepEqual(landingScale(50), { x: 1, y: 1 });
});
test("landing compresses, counter-stretches and settles without changing the base symbol scale", () => {
  assert.deepEqual(landingScale(70, config), { x: 1.1, y: 0.88 });
  assert.deepEqual(landingScale(160, config), { x: 0.94, y: 1.06 });
  const settle = landingScale(220, config);
  assert.ok(settle.x > 0.94 && settle.x < 1); assert.ok(settle.y > 1 && settle.y < 1.06);
  assert.ok(landingOffset(0.25, 14) > 0); assert.ok(landingOffset(0.75, 14) < 0);
  assert.equal(landingOffset(1, 14), 0);
});
test("config rejects broken landing timing and extreme deformation", () => {
  const game = structuredClone(reuse); game.presentation.landing!.settleMs = 0;
  assert.throws(() => loadGameConfig(game), /presentation.landing/);
  game.presentation.landing!.settleMs = 120; game.presentation.landing!.squashY = 0;
  assert.throws(() => loadGameConfig(game), /presentation.landing/);
});
test("framework policies validate force stop and foreground symbol configuration", () => {
  const game = structuredClone(reuse);
  game.presentation.foregroundWinSymbols = ["not-a-symbol"];
  assert.throws(() => loadGameConfig(game), /foregroundWinSymbols/);
  game.presentation.foregroundWinSymbols = ["A"];
  game.presentation.allowForceStop = "false" as unknown as boolean;
  assert.throws(() => loadGameConfig(game), /allowForceStop/);
  game.presentation.allowForceStop = false;
  game.presentation.winOverflowPaddingPx = 10000;
  assert.throws(() => loadGameConfig(game), /winOverflowPaddingPx/);
});
