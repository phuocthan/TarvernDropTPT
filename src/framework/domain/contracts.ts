import type { ResourceManifest } from "../resources/contracts.ts";
import type { LandingMotion } from "../presentation/landing-motion.ts";
/** Money is always an integer in demo minor units. Boards are column-major. */
export type Mode = "base" | "tavern" | "drop";
export type Chance = "standard" | "extra" | "super";
export type Board = string[][];
export type Position = { reel: number; row: number };
export interface LineWin {
  line: number;
  symbol: string;
  positions: Position[];
  amount: number;
}
export interface Chest {
  rows: number[];
  unlocked: boolean;
  multiplier: number | null;
}
export interface FeatureState {
  mode: Exclude<Mode, "base">;
  remaining: number;
  played: number;
  accumulated: number;
  chests: Chest[];
}
export interface RoundState {
  id: string;
  bet: number;
  baseWin: number;
  cap: number;
}
export interface Snapshot {
  resume?: { curStep: string; featureMode: FeatureState["mode"] | null; kind: string };
  version: number;
  balance: number;
  board: Board;
  feature: FeatureState | null;
  round: RoundState | null;
}
export interface Command {
  requestId: string;
  expectedVersion: number;
  action: "spin" | "buy-tavern" | "buy-drop";
  bet: number;
  chance: Chance;
}
export interface Completion {
  accumulated: number;
  multipliers: number[];
  product: number;
  featureAward: number;
  roundAward: number;
  capped: boolean;
}
export interface Outcome {
  checkpoint?: {
    curStep: string;
    staticResult?: boolean;
    resumed?: boolean;
    reel?: number;
    multiplier?: number;
    displayWinMinor: number;
    beforeWinMinor: number;
  };
  requestId: string;
  bet: number;
  state: Snapshot;
  wins: LineWin[];
  spinWin: number;
  scatterPositions?: Position[];
  entry: Mode | null;
  retrigger: number;
  collected: Position[];
  completion: Completion | null;
  finalFeature: FeatureState | null;
  paidAward: number;
  capped: boolean;
}
export interface SymbolDefinition {
  id: string;
  label: string;
  kind: "royal" | "premium" | "wild" | "bonus";
  color: string;
  glyph: string;
  image?: string;
  pays: Record<number, number>;
}
export type ReelMotion = "normal" | "drop";
export type SymbolLandingEffects = Record<string, string>;
export interface BrandLoadingConfig {
  background: string;
  brandLogo: string;
  brandName: string;
  gameLogo: string;
  brandIntro?: { src: string; durationMs: number; holdUntilReady?: boolean };
}
export interface DropTiming {
  fallMs: number;
  reelStaggerMs: number;
  rowStaggerMs: number;
  holdMs: number;
}
export interface DropAnticipation {
  symbolId: string;
  count: number;
  reelPauseMs: number;
}
export interface ReelPresentation {
  allowForceStop?: boolean;
  foregroundWinSymbols?: string[];
  winOverflowPaddingPx?: number;
  landing?: LandingMotion;
  spinType: ReelMotion;
  cellSizePx: number;
  gapPx: number;
  symbolEdgeInsetPx?: number;
  reelMaskPaddingPx?: number;
  winDimmerOpacity?: number;
  symbolLandingEffects?: Record<string, SymbolLandingEffects>;
  loadingScreen?: BrandLoadingConfig;
  controls?: { menu: boolean; autoRounds: number[]; autoUnlimited?: boolean; autoTopUp?: number; betMenuCloseDelayMs?: number };
  checkWinDelayMs?: { normal: number; turbo: number };
  animationGrid?: { originSlot: string; reelPitch: number; rowPitch: number };
  scene?: {
    layers: Record<string, number>;
    slots: Record<string, string>;
    openingDimmerOpacity?: number;
    openingReveal?: { durationMs: number; symbolDelayMs: number; mascotDelayMs: number; playbackRate?: number };
    winScreen?: { centerY: number; paddingPx: number; landscapeFit: number; portraitFit: number };
    chestCamera?: { scale: number; originY: number; durationMs: number };
    sideLogo?: { referenceAspect: number; leftFactor: number; upFactor: number };
    backgroundCamera?: {
      width: number;
      top: number;
      landscapeBottom: number;
      portraitBottom: number;
      centerOffsetX: number;
    };
  };
  feature?: {
    startDelayMs: number;
    endDelayMs: number;
    hideSymbolsUntilFirstSpin?: boolean;
  };
  normal: {
    speedPxPerSecond: number;
    turboSpeedPxPerSecond: number;
    stopDelayMs: number;
    turboStopDelayMs: number;
    bounceMs: number;
    bouncePx: number;
  };
  drop: {
    exit: DropTiming;
    enter: DropTiming;
    bounceMs: number;
    bouncePx: number;
    turboMultiplier: number;
    anticipation?: DropAnticipation;
  };
}
export interface GameDefinition {
  resources?: ResourceManifest;
  schemaVersion: 1;
  id: string;
  title: string;
  routing: { query: string; apiBase: string; skin: "basic" | "tavern"; contract?: "proposal-v1" };
  currency?: { code: string; exponent: number; locale?: string };
  presentation: ReelPresentation;
  reels: number;
  rows: number;
  lines: number[][];
  symbols: SymbolDefinition[];
  bets: number[];
  defaultBet: number;
  initialBoard: Board;
  demo: {
    initialBalance: number;
    capMultiplier: number;
    buyPrices: Record<"tavern" | "drop", number>;
    chancePrices: Record<Chance, number>;
    scatterRates: Record<Chance, number>;
    featureSpins: Record<"tavern" | "drop", number>;
    retriggerSpins: number;
    maxFeatureSpins: number;
    chestMultipliers: Record<FeatureState["mode"], number[]>;
    winTiers: { label: string; multiplier: number }[];
  };
}
export interface GameTransport {
  hasResume?: boolean;
  resume?(refresh?: boolean): Promise<Outcome>;
  completePresentation?(): Promise<Snapshot>;
  nextPresentation?(): Outcome | null;
  session(): Promise<Snapshot>;
  execute(command: Command): Promise<Outcome>;
}
