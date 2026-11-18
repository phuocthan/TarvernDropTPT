import { AudioBus, audioSpriteCues, type AudioCue } from "../../framework/presentation/audio.ts";
import { assetUrl } from "../../framework/presentation/asset-url.ts";
import config from "./audio.config.json";
import type { ResourceManager } from "../../framework/resources/resource-manager.ts";

export async function loadTavernAudio(resources: ResourceManager) {
  const files: Record<string, AudioCue> = Object.fromEntries(
    ["start", "stop", "win", "entry", "chest"].map((name) => [
      name, assetUrl(`tavern-assets/cues/${name}.mp3`),
    ]),
  );
  try {
    const manifest = await resources.load<Parameters<typeof audioSpriteCues>[0] | undefined>("audio.manifest");
    if (!manifest) throw Error("Sound manifest unavailable");
    const sprite = audioSpriteCues(manifest, assetUrl(config.base));
    Object.assign(files, sprite);
    for (const [event, clip] of Object.entries({ ...config.cues, ...config.tiers }))
      if (sprite[clip]) files[event] = sprite[clip];
    for (const [event, clips] of Object.entries(config.sequences))
      clips.forEach((clip, index) => {
        if (sprite[clip]) files[event + index] = sprite[clip];
      });
  } catch (error) {
    console.warn("Tavern sound sprite unavailable", error);
  }
  return new AudioBus<string>(files);
}
