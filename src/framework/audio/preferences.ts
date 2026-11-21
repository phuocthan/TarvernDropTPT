import type { AudioChannel } from "../presentation/audio.ts";

/** The player's sound choices, kept per game in the same browser. */
export interface AudioPreferences {
  /** The HUD speaker: false means every channel is silent. */
  muted: boolean;
  levels: Record<AudioChannel, number>;
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
type Saved = Partial<AudioPreferences> & { restore?: Partial<Record<AudioChannel, number>> };
const channels = ["effects", "music"] as const;

/** The page's localStorage, or undefined where reading it throws (blocked site data). */
export function browserStorage(): PreferenceStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const clampLevel = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

/**
 * Loads and saves the player's sound settings. A first visit gets the game's defaults (sound on);
 * an explicit choice, on or off, survives reloads and later visits. Each channel also keeps the
 * last audible level the player set, so unmuting a channel returns to it, also after a reload.
 * Storage failures (private windows, blocked site data) fall back to the defaults for this page.
 */
export function createAudioPreferences(
  gameId: string,
  defaults: AudioPreferences,
  storage: PreferenceStorage | undefined,
) {
  const key = `fw-pixi:${gameId}:audio`;
  let saved: Saved | undefined;
  try {
    const raw = storage?.getItem(key);
    saved = raw ? JSON.parse(raw) as Saved : undefined;
  } catch {
    saved = undefined;
  }
  const levels = {
    effects: clampLevel(saved?.levels?.effects, defaults.levels.effects),
    music: clampLevel(saved?.levels?.music, defaults.levels.music),
  };
  const audible = (channel: AudioChannel) => {
    const stored = clampLevel(saved?.restore?.[channel], 0);
    return stored || levels[channel] || defaults.levels[channel] || 1;
  };
  const current = {
    muted: typeof saved?.muted === "boolean" ? saved.muted : defaults.muted,
    levels,
    restore: { effects: audible("effects"), music: audible("music") },
  };
  return {
    /** True when this browser already holds a choice for this game. */
    stored: !!saved,
    get muted() { return current.muted; },
    level(channel: AudioChannel) { return current.levels[channel]; },
    /** The last audible level of a channel: what unmuting it returns to. */
    restoreLevel(channel: AudioChannel) { return current.restore[channel]; },
    /** `remember: false` (a slider still being dragged) keeps the last audible level untouched. */
    save(update: { muted?: boolean; levels?: Partial<Record<AudioChannel, number>>; remember?: boolean }) {
      if (typeof update.muted === "boolean") current.muted = update.muted;
      for (const channel of channels) {
        const value = update.levels?.[channel];
        if (value === undefined) continue;
        current.levels[channel] = clampLevel(value, current.levels[channel]);
        if (current.levels[channel] > 0 && update.remember !== false) current.restore[channel] = current.levels[channel];
      }
      try {
        storage?.setItem(key, JSON.stringify(current));
      } catch {
        // Unavailable storage keeps the choice for this page only.
      }
    },
  };
}
