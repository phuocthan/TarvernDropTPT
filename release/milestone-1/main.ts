import "./style.css";
import { games, defaultGame } from "./games/catalog.ts";
import { mountBasicGame } from "./framework/presentation/basic-game.ts";

const root = document.querySelector<HTMLElement>("#app")!;
const query = new URLSearchParams(location.search).get("game");
const game = query === "default" || query === "reuse" ? games[1] : defaultGame;
document.title = game.title;
const other = games.find(({ id }) => id !== game.id)!;
await mountBasicGame(root, game, undefined, {
  href: other === defaultGame ? "./" : `?game=${other.routing.query}`,
  label: other.title,
});
