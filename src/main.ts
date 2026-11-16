import "./style.css";
import { defaultGame, games } from "./games/catalog.ts";
import { mountBrandLoader } from "./framework/presentation/brand-loading.ts";

const root = document.querySelector<HTMLElement>("#app")!;
const requested = new URLSearchParams(location.search).get("game");
const game =
  games.find(({ routing }) => routing.query === requested) ?? defaultGame;
const loader = game.presentation.loadingScreen
  ? mountBrandLoader(root, game.presentation.loadingScreen, game.title)
  : undefined;
try {
  if (game.routing.skin === "tavern") {
    const { mountTavern } = await import("./games/tavern/app.ts");
    loader?.update(1, 4);
    await mountTavern(root, game, loader);
  } else {
    const { mountBasicGame } =
      await import("./framework/presentation/basic-game.ts");
    loader?.update(1, 2);
    await mountBasicGame(root, game, loader, { href: "./", label: `← ${defaultGame.title}` });
  }
} catch (error) {
  if (!loader) throw error;
  loader.fail();
  console.error(error);
}
