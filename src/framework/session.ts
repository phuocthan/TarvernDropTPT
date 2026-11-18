import { GameController } from "./controller.ts";
import type { GameDefinition, GameTransport, Snapshot } from "./domain/contracts.ts";
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
    game.id + (game.routing.contract ? ".proposal-v1.pending" : ".pending"),
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
    async waitAfterReels(turbo: boolean) {
      const timing = game.presentation.checkWinDelayMs;
      const ms = timing ? (turbo ? timing.turbo : timing.normal) : 0;
      if (ms) await new Promise<void>((resolve) => setTimeout(resolve, ms));
    },
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
    async mount(host: HTMLElement, options?: { autoStart?: boolean; initialState?: Snapshot }) {
      await Promise.all([board.mount(host, options), controller.boot(options?.initialState)]);
      board.setBoard(controller.state!.board);
      if (controller.state!.feature?.played === 0) prepareFeatureEntry();
    },
  };
}
