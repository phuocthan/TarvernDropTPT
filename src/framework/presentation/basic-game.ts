import "./basic-game.css";
import { Container, Graphics, Text } from "pixi.js";
import { createSlotSession } from "../session.ts";
import { HttpTransport } from "../transport/http.ts";
import type { GameDefinition } from "../domain/contracts.ts";
import type { BrandLoader } from "./brand-loading.ts";

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

  const { controller, board, mount } = createSlotSession(
    game,
    new HttpTransport(game.routing.apiBase),
    (cellSizePx) => {
      const view = new Container();
      const scale = cellSizePx / 102;
      const text = new Text({
        style: { fontSize: 48 * scale, fontWeight: "bold" },
      });
      text.anchor.set(0.5);
      text.position.set(cellSizePx / 2);
      view.addChild(
        new Graphics()
          .roundRect(2 * scale, 2 * scale, 98 * scale, 98 * scale, 10 * scale)
          .fill(0x352735),
        text,
      );
      return {
        view,
        set(id) {
          const symbol = symbols.get(id)!;
          text.text = symbol.glyph;
          text.style.fill = symbol.color;
        },
      };
    },
    localStorage,
  );

  const button = root.querySelector<HTMLButtonElement>("#reuse-spin")!;
  const status = root.querySelector<HTMLElement>("#reuse-status")!;
  const balance = root.querySelector<HTMLElement>("#reuse-balance")!;
  function sync() {
    balance.textContent = `Balance ${(controller.state!.balance / 100).toFixed(2)}`;
    button.textContent =
      controller.phase === "recovery" ? "Recover result" : "Spin";
    button.disabled = false;
  }
  try {
    const host = root.querySelector<HTMLElement>("#reuse-board")!;
    await mount(host);
    host.style.aspectRatio = `${board.app.screen.width} / ${board.app.screen.height}`;
    sync();
    status.textContent = "";
    loader?.ready();
  } catch {
    status.textContent = "Could not start the game. Reload to retry.";
    loader?.fail();
    return;
  }

  button.onclick = async () => {
    button.disabled = true;
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
      board.highlight(outcome.wins);
      controller.completePresentation();
      status.textContent = outcome.wins.length
        ? `Win ${(outcome.spinWin / 100).toFixed(2)}`
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
