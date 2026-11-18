import test from "node:test";
import assert from "node:assert/strict";
import { slotContentScale } from "../src/framework/presentation/slot-content-fit.ts";
const screen = { x: 200, y: 300, scaleX: 1, scaleY: 1 };
const viewport = { width: 400, height: 600 };
const bone = { a: 1, b: 0, c: 0, d: 1, worldX: 0, worldY: 0 };
test("slot content fits long amounts and animated poses without enlarging short amounts", () => {
  assert.equal(slotContentScale({ width: 100, height: 40 }, bone, screen, viewport, 16), 1);
  assert.equal(slotContentScale({ width: 800, height: 40 }, bone, screen, viewport, 16), 368 / 800);
  assert.equal(slotContentScale({ width: 100, height: 100 }, { ...bone, worldY: 260 }, screen, viewport, 16), 48 / 100);
  assert.equal(slotContentScale({ width: 100, height: 800 }, { ...bone, a: 0, b: -1, c: 1, d: 0 }, screen, viewport, 16), 368 / 800);
});
