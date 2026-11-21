import type { GameDefinition } from "../domain/contracts.ts";

interface CatalogEntry {
  game: GameDefinition;
  mount?: string;
  assets?: string[];
}

export function createGameCatalog(first: CatalogEntry, ...others: CatalogEntry[]) {
  const entries = [first, ...others];
  const games = entries.map(({ game }) => game);
  const skins = new Map<string, { mount: string; assets: string[] }>([
    ["basic", { mount: "/src/games/basic-entry.ts", assets: [] }],
  ]);
  for (const key of [games.map((game) => game.id), games.map((game) => game.routing.query), games.map((game) => game.routing.apiBase)]) {
    if (new Set(key).size !== key.length) throw Error("Duplicate game ID, query or API path");
  }
  for (const { game, mount, assets = [] } of entries) {
    if (!mount) continue;
    const { skin } = game.routing;
    if (skins.has(skin)) throw Error(`Duplicate presentation for skin "${skin}".`);
    skins.set(skin, { mount, assets });
  }

  return {
    defaultGame: first.game,
    games,
    gamePresentation(skin: string) {
      const presentation = skins.get(skin);
      if (!presentation) throw Error(`No presentation registered for skin "${skin}".`);
      return presentation;
    },
  };
}
