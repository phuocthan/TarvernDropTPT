import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutModeFor } from "../src/framework/presentation/layout-mode.ts";

const reference = { mobileWidth: 661, mobileHeight: 449 };

/** The reference client's rule, copied from the v13 bundle, as the oracle. */
function referenceMode(width: number, height: number) {
  return width === 0 && height === 0
    ? "desktop"
    : (height < 449 || (width < 661 && width > height)) && width > height
      ? "landscape"
      : width < 661 ? "portrait" : "desktop";
}

test("layout mode matches the reference examples", () => {
  const cases: [number, number, string][] = [
    [0, 0, "desktop"],
    [1280, 720, "desktop"],
    [1920, 1080, "desktop"],
    [800, 1200, "desktop"],
    [661, 900, "desktop"],
    [660, 900, "portrait"],
    [390, 844, "portrait"],
    [600, 600, "portrait"],
    [600, 599, "landscape"],
    [844, 390, "landscape"],
    [1000, 448, "landscape"],
    [1000, 449, "desktop"],
    [700, 449, "desktop"],
    [660, 500, "landscape"],
    [448, 448, "portrait"],
  ];
  for (const [width, height, mode] of cases)
    assert.equal(layoutModeFor(width, height, reference), mode, `${width}x${height}`);
});

test("layout mode equals the reference rule on a dense size grid", () => {
  for (let width = 0; width <= 1400; width += 7)
    for (let height = 0; height <= 1400; height += 7)
      assert.equal(layoutModeFor(width, height, reference), referenceMode(width, height), `${width}x${height}`);
  for (const width of [659.5, 660, 660.9, 661, 661.1])
    for (const height of [448, 448.9, 449, 449.1, 660, 661, 662])
      assert.equal(layoutModeFor(width, height, reference), referenceMode(width, height), `${width}x${height}`);
});
