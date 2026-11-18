import { loadGameConfig } from "../framework/game-config.ts";
import tavernConfig from "./tavern/game.config.json" with { type: "json" };
import { reuse } from "./reuse/definition.ts";

const presentation = tavernConfig.presentation;
export const defaultGame = loadGameConfig({
  ...tavernConfig,
  title: "Tavern Drop — Framework Preview",
  routing: { ...tavernConfig.routing, skin: "basic" },
  presentation,
  // This milestone demonstrates the base round. Feature checkpoints are exercised by API tests/examples.
  demo: { ...tavernConfig.demo, scatterRates: { standard: 0, extra: 0, super: 0 } },
});
export const games = [defaultGame, reuse];
