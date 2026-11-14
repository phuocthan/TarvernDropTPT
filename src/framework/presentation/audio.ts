/** Procedural placeholder cues. Replace through this adapter when licensed audio arrives. */
export class AudioBus {
  muted = true;
  private context: AudioContext | null = null;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  cue(type: "stop" | "win" | "entry") {
    if (this.muted || !this.context) return;
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.frequency.value = type === "stop" ? 160 : type === "win" ? 660 : 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
}
