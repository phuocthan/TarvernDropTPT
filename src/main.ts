import "./style.css";
import { defaultGame, games } from "./games/catalog.ts";
import { launchGame } from "./framework/presentation/launch-game.ts";

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
  } else root.textContent = "Animation viewer is unavailable on this host.";
} else {
  const query = requested === "tarvern" ? "tavern" : requested === "default" ? "reuse" : requested;
  const game = games.find(({ routing }) => routing.query === query) ?? defaultGame;
  await launchGame(root, game, async (loader) => {
    if (game.routing.skin === "tavern") {
      const { mountTavern } = await import("./games/tavern/app.ts");
      await mountTavern(root, game, loader);
    } else {
      const { mountBasicGame } = await import("./framework/presentation/basic-game.ts");
      await mountBasicGame(root, game, loader, { href: "./?game=tarvern", label: `← ${defaultGame.title}` });
    }
  });
}
