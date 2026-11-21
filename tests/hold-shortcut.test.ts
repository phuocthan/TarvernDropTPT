import { test } from "node:test";
import assert from "node:assert/strict";
import { bindHoldShortcut } from "../src/framework/ui/hold-shortcut.ts";

test("Space repeat, early release, blur and cleanup never place a second wager", () => {
  const target = new EventTarget();
  let timer: (() => void) | undefined;
  let wagers = 0;
  let turbo = false;
  const timers = {
    setTimeout(callback: () => void, delay: number) {
      assert.equal(delay, 400);
      timer = callback;
      return 1;
    },
    clearTimeout() { timer = undefined; },
  };
  const cleanup = bindHoldShortcut(Object.assign(target, timers) as unknown as Window, {
    code: "Space", holdMs: 400, enabled: () => true,
    press: () => { wagers++; },
    hold: (active) => { turbo = active; },
  });
  const fire = (type: string, repeat = false) => target.dispatchEvent(
    Object.assign(new Event(type, { cancelable: true }), { code: "Space", repeat }),
  );

  fire("keydown");
  fire("keydown", true);
  assert.equal(wagers, 1);
  fire("keyup");
  assert.equal(timer, undefined);
  assert.equal(turbo, false);
  fire("keydown");
  timer!();
  assert.equal(turbo, true);
  target.dispatchEvent(new Event("blur"));
  assert.equal(turbo, false);
  fire("keyup");
  cleanup();
  fire("keydown");
  assert.equal(wagers, 2);
});
