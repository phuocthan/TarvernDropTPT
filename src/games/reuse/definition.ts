import config from "./game.config.json" with { type: "json" };
import { loadGameConfig } from "../../framework/game-config.ts";

export const reuse = loadGameConfig(config);
