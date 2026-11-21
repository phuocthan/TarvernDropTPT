import { Howl, Howler } from "howler";
import type { AudioChannel, AudioCue } from "../presentation/audio.ts";

interface Playback { howl: Howl; id: number; channel: AudioChannel; gain: number }
export interface CueOptions {
  /** Volume relative to the channel level (default 1). */
  gain?: number;
  /** Playback rate (default 1). */
  rate?: number;
  /** Fade in from silence over this many milliseconds. */
  fadeInMs?: number;
}
/** One Howl per source pack; aliases and sprite offsets do not decode the same file twice. */
export class AudioBus<Cue extends string> {
  private files: Record<Cue, AudioCue>;
  private packs = new Map<string, Howl>();
  private playing = new Map<Cue, Set<Playback>>();
  private volumes: Record<AudioChannel, number> = { effects: 0.55, music: 0.55 };
  private isMuted = true;
  private closed = false;
  constructor(files: Record<Cue, AudioCue>) { this.files = files; }
  get muted() { return this.isMuted; }
  set muted(value: boolean) {
    this.isMuted = value;
    if (value) for (const name of [...this.playing.keys()]) this.stop(name);
  }
  level(channel: AudioChannel) { return this.volumes[channel]; }
  setLevel(channel: AudioChannel, value: number) {
    if (!Number.isFinite(value)) return;
    this.volumes[channel] = Math.max(0, Math.min(1, value));
    for (const active of this.playing.values()) for (const play of active)
      if (play.channel === channel) play.howl.volume(this.volumes[channel] * play.gain, play.id);
  }
  unlock() {
    if (this.closed) return;
    // Construct without loading to let Howler install its mobile unlock handler in the gesture.
    const first = Object.keys(this.files)[0] as Cue | undefined;
    if (first) this.pack(first);
    if (Howler.ctx?.state === "suspended") void Howler.ctx.resume().catch(() => undefined);
  }
  /**
   * Tries to start audio without a gesture. Resolves true only when the browser allows audible
   * playback now; otherwise the context stays suspended until the next unlock() in a gesture.
   */
  async tryAutoplay(timeoutMs = 300): Promise<boolean> {
    if (this.closed) return false;
    this.unlock();
    const context = Howler.ctx;
    if (!context) return false;
    if (context.state === "running") return true;
    await Promise.race([
      context.resume().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
    return (context.state as string) === "running";
  }
  private pack(name: Cue) {
    const cue = this.files[name];
    const sources = typeof cue === "string" ? [cue] : [...cue.sources];
    const key = JSON.stringify(sources);
    let howl = this.packs.get(key);
    if (!howl) {
      const sprite: Record<string, [number, number, boolean]> = {};
      for (const [alias, definition] of Object.entries<AudioCue>(this.files))
        if (typeof definition !== "string" && JSON.stringify(definition.sources) === key)
          sprite[alias] = [definition.offsetMs, definition.durationMs, !!definition.loop];
      howl = new Howl({ src: sources, sprite, preload: false, volume: 0.55 });
      this.packs.set(key, howl);
    }
    return howl;
  }
  has(name: Cue) { return !!this.files[name]; }
  isPlaying(name: Cue) { return !!this.playing.get(name)?.size; }
  cue(name: Cue, loop = false, channel: AudioChannel = "effects", options: CueOptions = {}) {
    if (this.closed || this.muted || !this.files[name]) return;
    const howl = this.pack(name);
    const id = typeof this.files[name] === "string" ? howl.play() : howl.play(name);
    if (id == null) return;
    const gain = Math.max(0, options.gain ?? 1);
    const volume = this.volumes[channel] * gain;
    if (options.fadeInMs) {
      howl.volume(0, id);
      howl.fade(0, volume, options.fadeInMs, id);
    } else howl.volume(volume, id);
    if (options.rate && options.rate !== 1) howl.rate(options.rate, id);
    howl.loop(loop || (typeof this.files[name] !== "string" && !!this.files[name].loop), id);
    const active = this.playing.get(name) ?? new Set<Playback>();
    const play = { howl, id, channel, gain };
    active.add(play); this.playing.set(name, active);
    const remove = () => {
      active.delete(play);
      if (!active.size && this.playing.get(name) === active) this.playing.delete(name);
      howl.off("end", ended, id); howl.off("stop", remove, id); howl.off("playerror", remove, id); howl.off("loaderror", failed);
    };
    const ended = () => { if (!howl.loop(id)) remove(); };
    const failed = () => {
      remove();
      const key = JSON.stringify(typeof this.files[name] === "string" ? [this.files[name]] : this.files[name].sources);
      if (this.packs.get(key) === howl) { this.packs.delete(key); howl.unload(); }
    };
    howl.on("end", ended, id); howl.once("stop", remove, id); howl.once("playerror", remove, id); howl.once("loaderror", failed);
    if (howl.state() === "unloaded") howl.load();
  }
  /** Fades every playing instance of a cue to a new gain and keeps it playing (music layers). */
  setGain(name: Cue, gain: number, durationMs = 500) {
    for (const play of this.playing.get(name) ?? []) {
      play.gain = Math.max(0, gain);
      const target = this.volumes[play.channel] * play.gain;
      if (durationMs > 0) play.howl.fade(Number(play.howl.volume(play.id)), target, durationMs, play.id);
      else play.howl.volume(target, play.id);
    }
  }
  gain(name: Cue) {
    const [play] = this.playing.get(name) ?? [];
    return play?.gain ?? 0;
  }
  /** Restarts every playing instance of a cue from its beginning. */
  restart(name: Cue) {
    for (const { howl, id } of this.playing.get(name) ?? []) howl.seek(0, id);
  }
  stop(name: Cue) {
    const active = this.playing.get(name); this.playing.delete(name);
    if (active) for (const { howl, id } of [...active]) howl.stop(id);
    active?.clear();
  }
  /** Fades every playing instance of a cue (including loops) to silence, then stops it. */
  fade(name: Cue, durationMs: number) {
    const active = this.playing.get(name); this.playing.delete(name);
    if (!active) return;
    for (const { howl, id } of [...active]) {
      if (durationMs <= 0) { howl.stop(id); continue; }
      howl.once("fade", () => howl.stop(id), id);
      howl.fade(Number(howl.volume(id)), 0, durationMs, id);
    }
    active.clear();
  }
  dispose() {
    this.closed = true;
    for (const name of [...this.playing.keys()]) this.stop(name);
    for (const howl of this.packs.values()) howl.unload();
    this.packs.clear();
  }
}
