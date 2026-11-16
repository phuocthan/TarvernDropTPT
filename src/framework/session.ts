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
  const timing = game.presentation.feature;
  function prepareFeatureEntry() {
    if (timing?.hideSymbolsUntilFirstSpin) board.hideSymbols();
  }
  return {
    controller,
    board,
    prepareFeatureEntry,
    nextSpinDelay(baseDelayMs: number) {
      const feature = controller.state?.feature;
      return baseDelayMs +
        (feature?.played === 0 && feature.remaining > 0
          ? (timing?.startDelayMs ?? 0)
          : 0);
    },
    async waitBeforeFeatureResult() {
      if (timing?.endDelayMs)
        await new Promise<void>((resolve) => setTimeout(resolve, timing.endDelayMs));
    },
    async mount(host: HTMLElement) {
      await Promise.all([board.mount(host), controller.boot()]);
      board.setBoard(controller.state!.board);
      if (controller.state!.feature?.played === 0) prepareFeatureEntry();
    },
  };
}
