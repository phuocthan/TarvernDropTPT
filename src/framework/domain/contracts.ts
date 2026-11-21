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
export interface MockBonusScenario {
  spins: number;
  chests: boolean[];
  winTier: "normal" | "big" | "super" | "mega" | "epic" | "max";
}
export interface Command {
  requestId: string;
  expectedVersion: number;
  action: "spin" | "buy-tavern" | "buy-drop";
  bet: number;
  chance: Chance;
  mockBonus?: MockBonusScenario;
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
  controls?: {
    menu: boolean; autoRounds: number[]; autoUnlimited?: boolean; autoTopUp?: number; betMenuCloseDelayMs?: number;
    /**
     * Milestone gating: when set, confirming a Bonus Buy shows this notice instead of buying
     * (no charge, no bonus). The buy screen, prices and confirmation stay available.
     */
  };
  checkWinDelayMs?: { normal: number; turbo: number };
  animationGrid?: { originSlot: string; reelPitch: number; rowPitch: number };
  /** Opt-in layout mode (desktop / landscape / portrait) published as `data-layout`. */
  layout?: import("../presentation/layout-mode.ts").LayoutModeConfig;
  scene?: {
    layers: Record<string, number>;
    slots: Record<string, string>;
    openingDimmerOpacity?: number;
    openingReveal?: { durationMs: number; symbolDelayMs: number; mascotDelayMs: number; playbackRate?: number };
    bonusSceneVeil?: import("../presentation/scene.ts").SceneVeil;
    winScreen?: {
      centerY: number; paddingPx: number; landscapeFit: number; portraitFit: number;
      /** Win counter duration in seconds per final win clip; the count runs continuously across tiers. */
      countSeconds?: Record<string, number>;
    };
    shockwave?: import("../presentation/shockwave.ts").ShockwaveConfig;
    /** Milliseconds after the Total Win click: background base entry and chest text clear, then reel entry. */
    totalWinOutro?: { continueFadeMs: number; backgroundEnterMs: number; reelEnterMs: number };
    chestCamera?: {
      scale: number;
      originY: number;
      durationMs: number;
      /** Zoom used by the portrait layout; defaults to `scale`. */
      portraitScale?: number;
      /** Upward camera lift in CSS px: portrait, then the first `[maxWidthExclusive, px]` step, else `default`. */
      liftPx?: { portrait: number; steps: [number, number][]; default: number };
    };
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
    enterSpawnClearancePx?: number;
    bounceMs: number;
    bouncePx: number;
    turboMultiplier: number;
    anticipation?: DropAnticipation;
    /**
     * Opt-in reference timeline (eases, staggers and turbo values per phase). When present it
     * replaces exit/enter/bounce/turboMultiplier timing; `anticipation.symbolId` still names
     * the scatter. See presentation/drop-timeline.ts.
     */
    timeline?: import("../presentation/drop-timeline.ts").DropTimelineConfig;
  };
}
export interface GameDefinition {
  resources?: ResourceManifest;
  schemaVersion: 1;
  id: string;
  title: string;
  routing: { query: string; apiBase: string; skin: string; contract?: "proposal-v1" };
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
  mockBonusEnabled?: boolean;
  /** Mock review only: break the next paid request once (see ProposalTransport). */
  debugFault?: "fail-request" | "drop-response" | null;
  /** Mock review only: set the synthetic wallet balance. */
  debugSetBalance?(balanceMinor: number): Promise<void>;
  /**
   * False while the server reports that no paid round may start (e.g. a round opened in another
   * window is still unfinished). Undefined means the transport does not track eligibility.
   */
  readyForWager?: boolean;
  /** Fetch the authoritative wallet and eligibility without presenting any round. */
  reconcile?(): Promise<Snapshot>;
  resume?(refresh?: boolean): Promise<Outcome>;
  completePresentation?(): Promise<Snapshot>;
  nextPresentation?(): Outcome | null;
  session(): Promise<Snapshot>;
  execute(command: Command): Promise<Outcome>;
}
