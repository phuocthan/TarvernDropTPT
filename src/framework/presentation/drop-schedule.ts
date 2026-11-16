import type { Board, DropAnticipation } from "../domain/contracts.ts";

export function planDropColumns(
  board: Board,
  staggerMs: number,
  reelLandMs: number,
  anticipation?: DropAnticipation,
) {
  let count = 0;
  let startMs = 0;
  let anticipationAt: number | undefined;
  const starts = board.map((column, reel) => {
    if (reel > 0) {
      if (anticipation && count >= anticipation.count) {
        anticipationAt ??= startMs + reelLandMs;
        startMs += reelLandMs + anticipation.reelPauseMs;
      } else startMs = reel * staggerMs;
    }
    if (anticipation)
      count += column.filter((id) => id === anticipation.symbolId).length;
    return startMs;
  });
  return { starts, anticipationAt };
}
