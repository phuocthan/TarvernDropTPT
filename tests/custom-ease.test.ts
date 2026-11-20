import { test } from "node:test";
import assert from "node:assert/strict";
import { isEaseSpec, resolveEase } from "../src/framework/presentation/custom-ease.ts";

const REVEAL = "M0,0 C0.566,0.382 0.689,1.015 0.689,1.015 0.689,1.015 0.749,0.989 0.855,0.989 0.945,0.989 0.931,0.989 1,1";

test("GSAP named eases use GSAP powers", () => {
  assert.equal(resolveEase("power3.in")(0.5), 0.5 ** 4);
  assert.equal(resolveEase("power2.out")(0.5), 1 - 0.5 ** 3);
  assert.equal(resolveEase("power2.inOut")(0.25), (0.5 ** 3) / 2);
  assert.equal(resolveEase("none")(0.3), 0.3);
});

test("the reference reveal path overshoots, settles and ends at rest", () => {
  const ease = resolveEase(REVEAL);
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.ok(Math.abs(ease(0.689) - 1.015) < 1e-6, "peak overshoot at x = 0.689");
  assert.ok(Math.abs(ease(0.855) - 0.989) < 1e-6, "rebound dip at x = 0.855");
  for (let x = 0; x <= 0.6; x += 0.05) assert.ok(ease(x + 0.05) >= ease(x), "rising before the peak");
});

test("ease specs are validated", () => {
  assert.ok(isEaseSpec(REVEAL));
  assert.ok(isEaseSpec("power4.out"));
  assert.ok(!isEaseSpec("bounce.whatever"));
  assert.ok(!isEaseSpec(42));
});
