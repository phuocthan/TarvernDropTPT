export type AudioCue = string | {
  sources: readonly string[];
  offsetMs: number;
  durationMs: number;
  loop?: boolean;
};
export type AudioChannel = "effects" | "music";

export function audioSpriteCues(
  manifest: { src: string[]; sprite: Record<string, [number, number, (boolean | number)?]> },
  base: string,
): Record<string, AudioCue> {
  const sources = manifest.src.map((file) => new URL(file, base).href);
  const cues: Record<string, AudioCue> = {};
  for (const [name, [offsetMs, durationMs, loop]] of Object.entries(manifest.sprite)) {
    if (!Number.isFinite(offsetMs) || offsetMs < 0 ||
      !Number.isFinite(durationMs) || durationMs <= 0) continue;
    cues[name] = { sources, offsetMs, durationMs, loop: Boolean(loop) };
  }
  return cues;
}

interface Playback {
  source?: AudioBufferSourceNode;
}

export class AudioBus<Cue extends string> {
  private context: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private playing = new Map<Cue, Set<Playback>>();
  private gains = new Map<AudioChannel, GainNode>();
  private volumes: Record<AudioChannel, number> = { effects: 0.55, music: 0.55 };
  private isMuted = true;
  private files: Record<Cue, AudioCue>;

  constructor(files: Record<Cue, AudioCue>) {
    this.files = files;
  }

  get muted() {
    return this.isMuted;
  }
  set muted(value: boolean) {
    this.isMuted = value;
    for (const [channel, gain] of this.gains) gain.gain.value = value ? 0 : this.volumes[channel];
    if (value) {
      for (const name of this.playing.keys()) this.stop(name);
    }
  }

  level(channel: AudioChannel) {
    return this.volumes[channel];
  }

  setLevel(channel: AudioChannel, value: number) {
    if (!Number.isFinite(value)) return;
    this.volumes[channel] = Math.min(1, Math.max(0, value));
    const gain = this.gains.get(channel);
    if (gain) gain.gain.value = this.muted ? 0 : this.volumes[channel];
  }

  unlock() {
    if (!this.context) {
      if (typeof AudioContext === "undefined") return;
      this.context = new AudioContext();
      for (const channel of ["effects", "music"] as const) {
        const gain = this.context.createGain();
        gain.gain.value = this.muted ? 0 : this.volumes[channel];
        gain.connect(this.context.destination);
        this.gains.set(channel, gain);
      }
    }
    void this.context.resume().catch(() => undefined);
  }

  private async load(context: AudioContext, sources: readonly string[]) {
    for (const file of sources) {
      let buffer = this.buffers.get(file);
      if (!buffer) {
        buffer = fetch(file).then(async (response) => {
          if (!response.ok) throw Error("Audio cue unavailable");
          return context.decodeAudioData(await response.arrayBuffer());
        });
        this.buffers.set(file, buffer);
      }
      try {
        return await buffer;
      } catch {
        if (this.buffers.get(file) === buffer) this.buffers.delete(file);
      }
    }
  }

  cue(name: Cue, loop = false, channel: AudioChannel = "effects") {
    const context = this.context;
    const gain = this.gains.get(channel);
    const cue: AudioCue | undefined = this.files[name];
    if (this.muted || !context || !gain || !cue) return;
    const sprite = typeof cue === "string" ? undefined : cue;
    const sounds = sprite?.sources ?? [cue as string];
    const active = this.playing.get(name) ?? new Set<Playback>();
    const play: Playback = {};
    active.add(play);
    this.playing.set(name, active);
    const ended = () => {
      play.source?.disconnect();
      active.delete(play);
      if (active.size === 0 && this.playing.get(name) === active) this.playing.delete(name);
    };
    void this.load(context, sounds).then((buffer) => {
      if (!buffer || !active.has(play)) { ended(); return; }
      const offset = (sprite?.offsetMs ?? 0) / 1000;
      const duration = Math.min(buffer.duration - offset, (sprite?.durationMs ?? Infinity) / 1000);
      if (duration <= 0) { ended(); return; }
      const source = context.createBufferSource();
      play.source = source;
      source.buffer = buffer;
      source.loop = loop || !!sprite?.loop;
      source.loopStart = offset;
      source.loopEnd = offset + duration;
      source.connect(gain);
      source.onended = ended;
      if (source.loop) source.start(0, offset);
      else source.start(0, offset, duration);
    }).catch(ended);
  }

  stop(name: Cue) {
    const active = this.playing.get(name);
    this.playing.delete(name);
    if (!active) return;
    for (const play of active) play.source?.stop();
    active.clear();
  }
}
