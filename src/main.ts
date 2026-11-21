import "./style.css";
import { defaultGame, gamePresentation, games } from "./games/catalog.ts";
import { launchGame } from "./framework/presentation/launch-game.ts";

const presentations = import.meta.glob<typeof import("./games/basic-entry.ts")>([
  "/src/games/basic-entry.ts", "/src/games/*/entry.ts",
]);

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
    const load = presentations[gamePresentation(game.routing.skin).mount];
    if (!load) throw Error(`Missing presentation entry for "${game.routing.skin}".`);
    const { mount } = await load();
    await mount(root, game, loader, game === defaultGame ? undefined : {
      href: `./?game=${defaultGame.routing.query}`, label: `← ${defaultGame.title}`,
    });
  });
}
