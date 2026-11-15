import { GameController } from "./controller.ts";
import type { GameDefinition, GameTransport } from "./domain/contracts.ts";
import { BoardView, type SymbolFactory } from "./presentation/board.ts";

export function createSlotSession(
  game: GameDefinition,
  transport: GameTransport,
  symbols: SymbolFactory,
  storage: Storage,
) {
  const controller = new GameController(
    transport,
    storage,
    game.id + ".pending",
  );
  const board = new BoardView(game, symbols);
  return {
    controller,
    board,
    async mount(host: HTMLElement) {
      await Promise.all([board.mount(host), controller.boot()]);
      board.setBoard(controller.state!.board);
    },
  };
}
