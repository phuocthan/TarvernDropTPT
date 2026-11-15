import "./style.css";
import { defaultGame, games } from "./games/catalog.ts";

const root = document.querySelector<HTMLElement>("#app")!;
const requested = new URLSearchParams(location.search).get("game");
const game =
  games.find(({ routing }) => routing.query === requested) ?? defaultGame;
if (game.routing.skin === "tavern") {
  const { mountTavern } = await import("./games/tavern/app.ts");
  await mountTavern(root, game);
} else {
  const { mountBasicGame } =
    await import("./framework/presentation/basic-game.ts");
  await mountBasicGame(root, game);
}
