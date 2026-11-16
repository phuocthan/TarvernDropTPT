import "./style.css";
import { defaultGame, games } from "./games/catalog.ts";
import { mountBrandLoader } from "./framework/presentation/brand-loading.ts";

const root = document.querySelector<HTMLElement>("#app")!;
const requested = new URLSearchParams(location.search).get("game")?.toLowerCase();

if (requested === "viewer") {
  document.title = "Tavern Drop · Animation Viewer";
  const viewer = document.createElement("iframe");
  viewer.title = "Tavern Drop animation viewer";
  const response = await fetch("./asset-viewer/index.html", { method: "HEAD" }).catch(() => null);
  if (response?.ok) {
    viewer.src = "./asset-viewer/index.html";
    viewer.className = "animation-viewer-frame";
    root.append(viewer);
  } else root.textContent = "Animation viewer is available in the local build.";
} else {
  const query = requested === "tarvern" ? "tavern" : requested === "default" ? "reuse" : requested;
  const game = games.find(({ routing }) => routing.query === query) ?? defaultGame;
  document.title = game.title;
  const loader = game.presentation.loadingScreen
    ? mountBrandLoader(root, game.presentation.loadingScreen, game.title)
    : undefined;
  try {
    if (game.routing.skin === "tavern") {
      const { mountTavern } = await import("./games/tavern/app.ts");
      loader?.update(1, 4);
      await mountTavern(root, game, loader);
    } else {
      const { mountBasicGame } = await import("./framework/presentation/basic-game.ts");
      loader?.update(1, 2);
      await mountBasicGame(root, game, loader, { href: "./?game=tarvern", label: `← ${defaultGame.title}` });
    }
  } catch (error) {
    if (!loader) throw error;
    loader.fail();
    console.error(error);
  }
}
