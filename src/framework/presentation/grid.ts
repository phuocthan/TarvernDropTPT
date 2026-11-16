import type { Position, ReelPresentation } from "../domain/contracts.ts";

type CellLayout = Pick<ReelPresentation, "cellSizePx" | "gapPx">;

export interface VerticalBounds {
  top: number;
  bottom: number;
}

export function keepWithinVerticalViewport(
  bounds: VerticalBounds,
  height: number,
  inset: number,
) {
  const min = inset - bounds.top;
  const max = height - inset - bounds.bottom;
  return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, 0));
}

export function reelCellCenter({ reel, row }: Position, layout: CellLayout) {
  const { cellSizePx, gapPx } = layout;
  const pitch = cellSizePx + gapPx;
  return { x: reel * pitch + cellSizePx / 2, y: row * pitch + cellSizePx / 2 };
}

/** Align an authored overlay to the center of the first cell and each grid pitch. */
export function alignReelGrid(
  layout: CellLayout,
  source: { x: number; y: number; reelPitch: number; rowPitch: number },
) {
  const pitch = layout.cellSizePx + layout.gapPx;
  const scaleX = pitch / source.reelPitch;
  const scaleY = pitch / source.rowPitch;
  const first = reelCellCenter({ reel: 0, row: 0 }, layout);
  return {
    x: first.x - source.x * scaleX,
    y: first.y - source.y * scaleY,
    scaleX,
    scaleY,
  };
}
