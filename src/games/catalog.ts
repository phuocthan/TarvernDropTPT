import { createGameCatalog } from "../framework/app/game-catalog.ts";
import { registration as gem } from "./gem/definition.ts";
import { reuse } from "./reuse/definition.ts";
import { tavern } from "./tavern/definition.ts";

export const { defaultGame, games, gamePresentation } = createGameCatalog(
  { game: tavern, mount: "/src/games/tavern/entry.ts", assets: ["tavern-assets"] },
  { game: reuse },
  gem,
);
