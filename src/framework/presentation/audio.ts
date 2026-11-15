export class AudioBus<Cue extends string> {
  private context: AudioContext | null = null;
  private clips = new Map<Cue, Promise<AudioBuffer>>();
  private gain: GainNode | null = null;

  constructor(private files: Record<Cue, string>) {}

  get muted() {
    return !this.gain || this.gain.gain.value === 0;
  }
  set muted(value: boolean) {
    if (this.gain) this.gain.gain.value = value ? 0 : 0.55;
  }

  unlock() {
    if (!this.context) {
      if (typeof AudioContext === "undefined") return;
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
    }
    void this.context.resume().catch(() => undefined);
  }

  cue(name: Cue) {
    if (this.muted || !this.context || !this.gain) return;
    const context = this.context;
    const gain = this.gain;
    let clip = this.clips.get(name);
    if (!clip) {
      clip = fetch(this.files[name])
        .then((response) => {
          if (!response.ok) throw Error("Audio cue unavailable");
          return response.arrayBuffer();
        })
        .then((data) => context.decodeAudioData(data));
      this.clips.set(name, clip);
    }
    void clip
      .then((buffer) => {
        if (this.muted) return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.onended = () => source.disconnect();
        source.start();
      })
      .catch(() => this.clips.delete(name));
  }
}
