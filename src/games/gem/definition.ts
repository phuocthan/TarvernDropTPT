import config from "./game.config.json" with { type: "json" };
import { loadGameConfig } from "../../framework/game-config.ts";

export const gem = loadGameConfig(config);

export const registration = { game: gem, mount: "/src/games/gem/entry.ts" };
