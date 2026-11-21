import type { Board } from "../domain/contracts.ts";

/**
 * Data-driven drop timeline, modelled on the Tavern Drop v13 reference reels
 * (`prespinReels` / `revealReels` / `revealReel` / symbol `prespin` and `reveal`).
 * Distances are authored in reference units and scaled by `rowPitchPx / unitsPerRow`.
 */
export interface DropTimelineConfig {
  /** Reference distance between two rows (Tavern v13: 564). */
  unitsPerRow: number;
  exit: {
    durationMs: number;
    turboDurationMs: number;
    /** Distance each symbol falls past its rest position, in reference units. */
    distance: number;
    ease: string;
    rowStaggerMs: number;
    turboRowStaggerMs: number;
    reelStaggerMs: number;
    turboReelStaggerMs: number;
    /**
     * Optional, normal speed only: at this time the fall is restarted from its current point...
     * (Reference v13 does this only when the player skips, so Tavern leaves it unset.)
     */
    cutoffMs?: number;
    /** ...and finished within this time, with the same ease. */
    cutoffDurationMs?: number;
  };
  enter: {
    durationMs: number;
    turboDurationMs: number;
    /** Start height of the top row in reference units (negative is above the board). */
    startY: number;
    /** Extra start height per row in reference units. */
    rowStartStep: number;
    ease: string;
    rowStaggerMs: number;
    turboRowStaggerMs: number;
    reelStaggerMs: number;
    turboReelStaggerMs: number;
    /** Wait between the result arriving and the first reel dropping in. */
    waitMs: number;
    turboWaitMs: number;
    /** The land state (animation, cue) starts this long before the symbol reaches rest. */
    landLeadMs: number;
    /** Index of the row whose drop marks the reel stop (reference: the second from the bottom). */
    reelStopRow?: number;
    /**
     * Reference: the reveal ends one fixed reel offset (reelStaggerMs) after the last reel's
     * own offset, then waits this long before the round may continue (normal / turbo).
     */
    settleWaitMs?: number;
    turboSettleWaitMs?: number;
    /** Skip before the drop starts: wait this long, then drop with the turbo values (reference 90). */
    skipWaitMs?: number;
    /** Skip while symbols move: the rest of the drop finishes within this time (keeps it visible). */
    skipRemainderMs?: number;
  };
  anticipation?: {
    /** Anticipate a reel while the scatter count up to and including it is within [min, max]. */
    minCount: number;
    maxCount: number;
    rowStaggerMs: number;
    pauseMs: number;
    /** The reference never anticipates the last reel. */
    includeLastReel?: boolean;
  };
}

export interface TileMotion {
  reel: number;
  row: number;
  startMs: number;
  durationMs: number;
}

export interface EnterPlan {
  tiles: TileMotion[];
  /** Reel stop markers (sound), relative to the start of the enter timeline. */
  reelStops: number[];
  /** Anticipated reels and when their anticipation starts. */
  anticipation: { reel: number; atMs: number }[];
  /** Time at which anticipation ends (a later reel drops normally), if any. */
  anticipationEndMs?: number;
  /** Time at which every symbol has reached rest. */
  endMs: number;
  /** Time at which the reference reveal (and its settle wait) completes. */
  revealEndMs: number;
}

/** Exit (spin out) schedule: every reel together (turbo: 15 ms apart), bottom row first. */
export function planDropExit(reels: number, rows: number, config: DropTimelineConfig, turbo: boolean) {
  const { exit } = config;
  const reelStagger = turbo ? exit.turboReelStaggerMs : exit.reelStaggerMs;
  const rowStagger = turbo ? exit.turboRowStaggerMs : exit.rowStaggerMs;
  const cut = !turbo && exit.cutoffMs !== undefined && exit.cutoffDurationMs !== undefined;
  const durationMs = turbo
    ? exit.turboDurationMs
    : cut ? Math.min(exit.durationMs, exit.cutoffMs! + exit.cutoffDurationMs!) : exit.durationMs;
  const tiles: TileMotion[] = [];
  for (let reel = 0; reel < reels; reel++)
    for (let row = 0; row < rows; row++)
      tiles.push({ reel, row, startMs: reel * reelStagger + (rows - 1 - row) * rowStagger, durationMs });
  return { tiles, endMs: Math.max(...tiles.map((t) => t.startMs + t.durationMs)) };
}

/** Exit offset (reference units below rest) after `elapsedMs` of one symbol's fall. */
export function dropExitUnits(elapsedMs: number, config: DropTimelineConfig, turbo: boolean, ease: (t: number) => number) {
  const { exit } = config;
  if (elapsedMs <= 0) return 0;
  if (turbo) return exit.distance * ease(Math.min(1, elapsedMs / exit.turboDurationMs));
  const cutoff = exit.cutoffMs, finish = exit.cutoffDurationMs;
  if (cutoff === undefined || finish === undefined || elapsedMs < cutoff)
    return exit.distance * ease(Math.min(1, elapsedMs / exit.durationMs));
  const from = exit.distance * ease(Math.min(1, cutoff / exit.durationMs));
  return from + (exit.distance - from) * ease(Math.min(1, (elapsedMs - cutoff) / finish));
}

/**
 * Enter (reveal) schedule. Reels drop left to right `reelStaggerMs` apart without waiting for
 * each other; inside a reel the bottom row drops first. An anticipated reel drops slowly, is
 * waited for, and is followed by `pauseMs` before the next reel (normal speed only).
 */
export function planDropEnter(
  board: Board,
  rows: number,
  config: DropTimelineConfig,
  turbo: boolean,
  scatterId?: string,
): EnterPlan {
  const { enter, anticipation } = config;
  const reelStagger = turbo ? enter.turboReelStaggerMs : enter.reelStaggerMs;
  const rowStagger = turbo ? enter.turboRowStaggerMs : enter.rowStaggerMs;
  const durationMs = turbo ? enter.turboDurationMs : enter.durationMs;
  const reelStopRow = enter.reelStopRow ?? rows - 2;
  const tiles: TileMotion[] = [];
  const reelStops: number[] = [];
  const anticipated: EnterPlan["anticipation"] = [];
  let anticipationEndMs: number | undefined;
  let count = 0;
  let time = 0;
  board.forEach((column, reel) => {
    if (scatterId !== undefined) count += column.filter((id) => id === scatterId).length;
    const slow = !!anticipation && !turbo && scatterId !== undefined &&
      count >= anticipation.minCount && count <= anticipation.maxCount &&
      (anticipation.includeLastReel || reel < board.length - 1);
    const stagger = slow ? anticipation!.rowStaggerMs : rowStagger;
    if (slow) anticipated.push({ reel, atMs: time });
    else if (anticipated.length && anticipationEndMs === undefined) anticipationEndMs = time;
    for (let row = rows - 1; row >= 0; row--) {
      const order = rows - 1 - row;
      tiles.push({ reel, row, startMs: time + order * stagger, durationMs });
      if (row === reelStopRow) reelStops[reel] = time + order * stagger;
    }
    time += slow ? rows * stagger + anticipation!.pauseMs + reelStagger : reelStagger;
  });
  return {
    tiles,
    reelStops,
    anticipation: anticipated,
    anticipationEndMs,
    endMs: Math.max(...tiles.map((t) => t.startMs + t.durationMs)),
    revealEndMs: time + enter.reelStaggerMs + ((turbo ? enter.turboSettleWaitMs : enter.settleWaitMs) ?? 0),
  };
}

/** Enter start offset (reference units, negative = above rest) for a row. */
export const dropEnterStartUnits = (row: number, rowPitchUnits: number, config: DropTimelineConfig) =>
  config.enter.startY + row * config.enter.rowStartStep - row * rowPitchUnits;
