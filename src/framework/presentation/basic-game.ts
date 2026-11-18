import "./basic-game.css";
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { createSlotSession } from "../session.ts";
import { createGameTransport } from "../transport/proposal.ts";
import { formatMoney } from "./money.ts";
import type { GameDefinition } from "../domain/contracts.ts";
import type { BrandLoader } from "./brand-loading.ts";
import { loadTextures } from "./assets.ts";
import { gameRuntime } from "../app/game-runtime.ts";

export async function mountBasicGame(
  root: HTMLElement,
  game: GameDefinition,
  loader?: BrandLoader,
  navigation?: { href: string; label: string },
) {
  root.innerHTML = `
    <main class="reuse-example">
      <h1></h1>
      <p class="board-details"></p>
      <div class="reel-host" id="reuse-board"></div>
      <div class="reuse-controls"><button type="button" id="reuse-spin" disabled>Spin</button>
      <span id="reuse-balance"></span></div>
      <p id="reuse-status" role="status">Connecting to demo server…</p>
    </main>`;
  if (navigation) {
    const link = document.createElement("a");
    link.href = navigation.href;
    link.textContent = navigation.label;
    root.querySelector("main")!.prepend(link);
  }
  root.querySelector("h1")!.textContent = game.title;
  root.querySelector(".board-details")!.textContent =
    `${game.reels} × ${game.rows} reels · ${game.lines.length} paylines · ${game.presentation.spinType} spin`;
  const symbols = new Map(game.symbols.map((symbol) => [symbol.id, symbol]));
  const images = Object.fromEntries(game.symbols.flatMap(({ id, image }) => image ? [[id, image]] : []));
  let textures = new Map<string, Texture>();

  const { controller, board, mount, waitAfterReels } = createSlotSession(
    game,
    createGameTransport(game, localStorage),
    (cellSizePx) => {
      const view = new Container();
      const scale = cellSizePx / 102;
      const text = new Text({
        style: { fontSize: 48 * scale, fontWeight: "bold" },
      });
      text.anchor.set(0.5);
      text.position.set(cellSizePx / 2);
      const sprite = textures.size ? new Sprite() : undefined;
      if (sprite) {
        sprite.anchor.set(0.5);
        sprite.position.copyFrom(text.position);
      }
      view.addChild(
        new Graphics()
          .roundRect(2 * scale, 2 * scale, 98 * scale, 98 * scale, 10 * scale)
          .fill(0x352735),
        text,
      );
      if (sprite) view.addChild(sprite);
      return {
        view,
        set(id) {
          const symbol = symbols.get(id)!;
          const texture = textures.get(id);
          text.visible = !texture;
          if (sprite) {
            sprite.visible = !!texture;
            if (texture && sprite.texture !== texture) {
              sprite.texture = texture;
              sprite.scale.set(cellSizePx * 0.82 / Math.max(texture.width, texture.height));
            }
          }
          if (!texture) {
            text.text = symbol.glyph;
            text.style.fill = symbol.color;
          }
        },
      };
    },
    localStorage,
  );

  const button = root.querySelector<HTMLButtonElement>("#reuse-spin")!;
  const status = root.querySelector<HTMLElement>("#reuse-status")!;
  const balance = root.querySelector<HTMLElement>("#reuse-balance")!;
  function sync() {
    balance.textContent = `Balance ${formatMoney(game, controller.state!.balance)}`;
    button.textContent =
      controller.phase === "recovery" ? "Recover result" : "Spin";
    button.disabled = false;
  }
  try {
    const host = root.querySelector<HTMLElement>("#reuse-board")!;
    const runtime = gameRuntime(game);
    await runtime.prepare(loader);
    textures = await loadTextures(images, runtime.resources);
    await mount(host);
    host.style.aspectRatio = `${board.contentWidth} / ${board.contentHeight}`;
    sync();
    status.textContent = "";
    loader?.ready();
  } catch {
    status.textContent = "Could not start the game. Reload to retry.";
    loader?.fail();
    return;
  }

  button.onclick = async () => {
    if (controller.phase === "pending" || controller.phase === "presenting") {
      board.skip();
      return;
    }
    button.disabled = !board.allowForceStop;
    button.textContent = board.allowForceStop ? "Stop" : "Spinning";
    board.start(false);
    try {
      const outcome = await (controller.phase === "recovery"
        ? controller.recover()
        : controller.execute({
            action: "spin",
            bet: game.defaultBet,
            chance: "standard",
          }));
      await board.stop(outcome.state.board);
      await waitAfterReels(false);
      board.highlight(outcome.wins);
      await controller.completePresentation();
      status.textContent = outcome.wins.length
        ? `Win ${formatMoney(game, outcome.spinWin)}`
        : "No line win";
    } catch {
      board.setBoard(controller.state!.board);
      status.textContent =
        controller.phase === "recovery"
          ? "Connection interrupted. Recover the saved result."
          : "Spin declined. Try again.";
    }
    sync();
  };
}
