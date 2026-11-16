import { loadGameConfig } from "../framework/game-config.ts";
import tavernConfig from "./tavern/game.config.json" with { type: "json" };
import { reuse } from "./reuse/definition.ts";

const { loadingScreen: _referenceLoading, ...presentation } = tavernConfig.presentation;
export const defaultGame = loadGameConfig({
  ...tavernConfig,
  title: "Tavern Drop — Framework Preview",
  routing: { ...tavernConfig.routing, skin: "basic" },
  presentation,
});
export const games = [defaultGame, reuse];
