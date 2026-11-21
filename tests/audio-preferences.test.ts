import { test } from "node:test";
import assert from "node:assert/strict";
import { createAudioPreferences } from "../src/framework/audio/preferences.ts";

const defaults = { muted: false, levels: { effects: 0.5, music: 0.5 } };
const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
  };
};

test("a first visit gets sound on at the default levels", () => {
  const prefs = createAudioPreferences("tavern", defaults, memory());
  assert.equal(prefs.stored, false);
  assert.equal(prefs.muted, false);
  assert.equal(prefs.level("effects"), 0.5);
  assert.equal(prefs.level("music"), 0.5);
});

test("sound off and channel levels survive a reload; turning sound back on is remembered too", () => {
  const storage = memory();
  const first = createAudioPreferences("tavern", defaults, storage);
  first.save({ levels: { music: 0, effects: 0 } });
  first.save({ muted: true });
  const reload = createAudioPreferences("tavern", defaults, storage);
  assert.equal(reload.muted, true);
  assert.equal(reload.level("music"), 0);
  assert.equal(reload.level("effects"), 0);
  reload.save({ muted: false, levels: { effects: 0.8 } });
  const later = createAudioPreferences("tavern", defaults, storage);
  assert.equal(later.muted, false);
  assert.equal(later.level("effects"), 0.8);
  assert.equal(later.level("music"), 0);
  assert.equal(createAudioPreferences("other", defaults, storage).stored, false);
});

test("unmuting a channel returns to the level set before, also after a reload", () => {
  const storage = memory();
  const first = createAudioPreferences("tavern", defaults, storage);
  assert.equal(first.restoreLevel("music"), 0.5);
  first.save({ levels: { music: 0.8 } });
  // Dragging the slider down to 0 passes small values without replacing the remembered level.
  first.save({ levels: { music: 0.03 }, remember: false });
  first.save({ levels: { music: 0 }, remember: false });
  first.save({ levels: { music: 0 } });
  first.save({ levels: { effects: 0.3 } });
  first.save({ levels: { effects: 0 } });
  const reload = createAudioPreferences("tavern", defaults, storage);
  assert.equal(reload.level("music"), 0);
  assert.equal(reload.restoreLevel("music"), 0.8);
  assert.equal(reload.restoreLevel("effects"), 0.3);
  reload.save({ levels: { music: reload.restoreLevel("music") } });
  assert.equal(createAudioPreferences("tavern", defaults, storage).level("music"), 0.8);
});

test("broken or unavailable storage falls back to the defaults", () => {
  const broken = { getItem: () => "{not json", setItem: () => { throw new Error("blocked"); } };
  const prefs = createAudioPreferences("tavern", defaults, broken);
  assert.equal(prefs.muted, false);
  prefs.save({ muted: true });
  assert.equal(prefs.muted, true);
  const out = createAudioPreferences("tavern", defaults, memory());
  out.save({ levels: { music: 7 } });
  assert.equal(out.level("music"), 1);
});
