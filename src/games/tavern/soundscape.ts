import type { AudioBus } from "../../framework/audio/howler-bus.ts";

/**
 * Reference v13 sound director: ambience and three music layers per mode, ducking for the
 * big screens, and the per-event cue rules (pitch rise per win line, turbo volumes, …).
 */
const layers = {
  ambBase: "td_amb_base",
  baseL0: "td_bgm_base_l0-01",
  baseL1: "td_bgm_base_l1",
  baseL2: "td_bgm_base_l2",
  ambBonus: "td_amb_bonus",
  bonusL0: "td_bgm_bonus_l0",
  bonusL1: "td_bgm_bonus_l1",
  bonusL2: "td_bgm_bonus_l2",
} as const;
type Layer = keyof typeof layers;
const baseLayers: Layer[] = ["ambBase", "baseL0", "baseL1", "baseL2"];
const bonusLayers: Layer[] = ["ambBonus", "bonusL0", "bonusL1", "bonusL2"];
/** Reference `G()`: every audible layer drops to this level while a big screen plays. */
const duckLevel = 0.05;
/** Round-start cues under a still-playing coin cue. */
const coinMaskGain = 0.35;

export function createTavernSoundscape(audio: AudioBus<string>) {
  const target: Record<Layer, number> = {
    ambBase: 1, baseL0: 1, baseL1: 0, baseL2: 0, ambBonus: 0, bonusL0: 0, bonusL1: 0, bonusL2: 0,
  };
  let started = false;
  let bonus = false;
  let layerTimer = 0;
  let lineCount = 0;
  let scatterCount = 0;
  let chestActivations = 0;
  let chestOpens = 0;
  let multiplierAdds = 0;
  const set = (layer: Layer, value: number, fadeMs = 500) => {
    target[layer] = value;
    audio.setGain(layers[layer], value, fadeMs);
  };
  const playLoop = (layer: Layer, fadeInMs: number) => {
    audio.cue(layers[layer], true, "music", { gain: target[layer], fadeInMs: target[layer] ? fadeInMs : 0 });
  };
  return {
    /** Reference startGame: entry sting, ambience and base L0 fade in over 4 s. */
    start(inBonus: boolean) {
      if (audio.muted) return;
      if (started) {
        // Unmuted again: restart the loops at their current mix.
        for (const layer of Object.keys(layers) as Layer[])
          if (!audio.isPlaying(layers[layer])) playLoop(layer, 500);
        return;
      }
      started = true;
      bonus = inBonus;
      for (const layer of baseLayers) target[layer] = 0;
      for (const layer of bonusLayers) target[layer] = 0;
      target[inBonus ? "ambBonus" : "ambBase"] = 1;
      target[inBonus ? "bonusL0" : "baseL0"] = 1;
      audio.cue("td_game_enter", false, "effects", { fadeInMs: 1500 });
      for (const layer of Object.keys(layers) as Layer[]) playLoop(layer, 4000);
    },
    /** Reference bonusOutro: crossfade to the other mode's ambience and L0; L1/L2 reset. */
    mode(inBonus: boolean) {
      if (!started || audio.muted) return this.start(inBonus);
      this.start(inBonus);
      if (bonus === inBonus) {
        // Back from a duck (bonus intro or total win) in the same mode.
        for (const layer of inBonus ? bonusLayers : baseLayers)
          if (target[layer] === duckLevel) set(layer, layer.endsWith("L1") || layer.endsWith("L2") ? 0 : 1);
        return;
      }
      bonus = inBonus;
      window.clearTimeout(layerTimer);
      const [leaving, entering] = inBonus ? [baseLayers, bonusLayers] : [bonusLayers, baseLayers];
      for (const layer of leaving) set(layer, 0);
      for (const layer of entering) audio.restart(layers[layer]);
      set(entering[0], 1);
      set(entering[1], 1);
      set(entering[2], 0, 0);
      set(entering[3], 0, 0);
    },
    /** Reference `G()` on bonusIntro and totalWinIntro. */
    duck() {
      for (const layer of Object.keys(layers) as Layer[])
        if (target[layer] > duckLevel) set(layer, duckLevel);
    },
    /**
     * Gain for cues that start a new round. While the previous credit's coin cue still plays
     * (an immediate next spin or held Space), they step back so the coins stay audible.
     */
    roundStartGain() {
      return audio.isPlaying("shared_totalwin_coins") ? coinMaskGain : 1;
    },
    betStart() {
      lineCount = 0;
      scatterCount = 0;
      audio.cue("shared_click", false, "effects", { gain: this.roundStartGain() });
    },
    reveal() {
      lineCount = 0;
    },
    bonusIntro() {
      scatterCount = 0;
      this.duck();
    },
    bonusEnter() {
      chestActivations = 0;
    },
    reelStop(reel: number, turbo: boolean) {
      audio.cue(`pc_shared_reel_stop_${reel}`, false, "effects", { gain: turbo ? 0.5 : 1 });
    },
    anticipation(active: boolean) {
      if (active) audio.cue("pc_anticipation", true, "effects", { fadeInMs: 500 });
      else audio.fade("pc_anticipation", 400);
    },
    anticipationSymbolReveal() {
      audio.cue(`pc_shared_reel_stop_${Math.floor(Math.random() * 5)}`, false, "effects", { gain: 0.3 });
    },
    scatterLand(fast: boolean) {
      scatterCount++;
      audio.cue(`tb_fs_land_${Math.min(scatterCount - 1, 3)}`, false, "effects", { gain: fast ? 0.42 : 1 });
    },
    /** Reference symbolWin for one pay line; `multiplier` is the line win in bets. */
    lineWin(multiplier: number, turbo: boolean) {
      lineCount++;
      const rate = 0.95 + lineCount * 0.02;
      const gain = turbo ? 0.5 : 1;
      audio.cue(multiplier >= 10 ? "tb_win_big" : "tb_win_small", false, "effects", { gain, rate });
      audio.cue(`pc_shared_win_line_${Math.floor(Math.random() * 4)}`, false, "effects", { gain, rate });
      if (!started) return;
      if (!bonus) {
        if (target.baseL1 === 0) set("baseL1", 1);
        if (multiplier >= 10 && target.baseL2 === 0) set("baseL2", 1);
        window.clearTimeout(layerTimer);
        layerTimer = window.setTimeout(() => {
          set("baseL1", 0);
          set("baseL2", 0);
        }, 8000);
      } else if (target.bonusL1 === 0) set("bonusL1", 1);
    },
    /** Reference symbolWin for the Bonus (Scatter) symbols. */
    scatterWin() {
      audio.cue("tb_fs_win");
    },
    chestActivate() {
      audio.cue(`td_mult_activate_${Math.min(chestActivations++, 4)}`);
      if (started && bonus && target.bonusL2 === 0) set("bonusL2", 1);
    },
    chestFinalWinIntro() {
      chestOpens = 0;
      multiplierAdds = 0;
      audio.cue("td_mult_boart_intro");
    },
    chestOpen() {
      audio.cue(`td_mult_win_chest_open_${Math.min(chestOpens++, 3)}`);
    },
    multiplierAdd() {
      audio.cue(`td_mult_win_adds_${Math.min(multiplierAdds++, 4)}`);
    },
    reelhouseEvent(name: string) {
      if (name === "key_spawn") audio.cue("td_fs_start_keys");
      else if (name === "chest_spawn") audio.cue("td_fs_start_chests");
    },
    /**
     * The balance credit: one coin cue for every positive round total (the reference only
     * plays it above 1×). Small credits get a quieter cue; zero stays silent. Callers must not
     * use it for an already settled round shown after a reload.
     */
    finalWin(multiplier: number) {
      if (!(multiplier > 0)) return;
      if (multiplier > 50) {
        audio.cue("shared_totalwin_big");
        audio.cue("shared_totalwin_coins");
      } else if (multiplier > 1) {
        audio.cue("shared_totalwin");
        audio.cue("shared_totalwin_coins");
      } else audio.cue("shared_totalwin_coins", false, "effects", { gain: 0.6 });
    },
    totalWinIntro() {
      this.duck();
      audio.cue("tb_totalwin_intro");
      audio.cue("td_fanfare");
    },
    /** Reference bet change: shared_betlevel pitched 0.8 → 2.0 along the bet ladder. */
    betLevel(index: number, count: number) {
      audio.cue("shared_betlevel", false, "effects", { rate: 0.8 + (count > 1 ? index / (count - 1) : 0) * 1.2 });
    },
    buttonClick(special = false) {
      audio.cue(special ? "shared_buy_click" : "shared_click");
    },
  };
}
export type TavernSoundscape = ReturnType<typeof createTavernSoundscape>;
