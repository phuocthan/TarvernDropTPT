import { reuse } from "./reuse/definition.ts";
import { tavern } from "./tavern/definition.ts";

export const defaultGame = tavern;
export const games = [defaultGame, reuse];

for (const values of [
  games.map((game) => game.id),
  games.map((game) => game.routing.query),
  games.map((game) => game.routing.apiBase),
]) {
  if (new Set(values).size !== values.length)
    throw Error("Duplicate game ID, query or API path");
}
