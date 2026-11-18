import type { Board, Command, FeatureState, GameDefinition, GameTransport, Outcome, Snapshot } from "../domain/contracts.ts";
import { ApiError, HttpTransport } from "./http.ts";
import { JsonClient } from "../network/json-client.ts";

interface Feature {
  featureMode: "tavern" | "drop"; totalSpins: number; curSpin: number; remainSpin: number;
  totalWinMinor: number; keyPositions: number[]; curStep: string;
}
interface Step {
  stepId: string; curStep: string; reels: number[]; freegame: Feature | null;
  winLines?: { type: string; lineId: number; winSym: number[]; win_amt: number }[];
  totalwin_amt?: number; retriggerSpins?: number;
  openedChests: { reel: number; multiplier: number }[];
  displayWinMinor: number; displayWinAfterMinor?: number; finalRoundAwardMinor?: number;
  reel?: number; multiplier?: number;
}
interface Response {
  sessionId?: string; token?: string; userId?: string;
  playToken?: string; roundId?: string; originalBaseBetMinor?: number; roundCapMinor?: number;
  wallet: { confirmedBalanceMinor: number; walletVersion: number };
  releasedThrough?: number; presentedThrough?: number; presentationStatus?: string;
  settlement?: { status: string; creditedMinor: number };
  step?: Step; lastReels?: number[];
  settings?: {
    cols: number; rows: number; symbolIds: Record<string, string>;
    currency: string; currencyExponent: number; defaultBetMinor: number; allowedBetMinor: number[];
    paylines: { lineId: number; positions: number[] }[];
    chancePrices: { normal: number; extra: number; super: number }; buyPrices: { tavern: number; drop: number }; roundCapMultiplier: number;
  };
  resume?: { mode: string; summaryId?: string; finalRoundAwardMinor?: number; step?: Step; snapshot?: Step } | null;
}

/** Proposal-specific wire mapping; rendering keeps framework domain objects. */
export class ProposalTransport implements GameTransport {
  hasResume = false;
  private sessionId = "";
  private token = "";
  private playToken = "";
  private response!: Response;
  private active?: Step;
  private queued?: Response;
  private staticResult = false;
  private summaryId?: string;
  private symbols: Record<string, string> = {};
  private key: string;
  private snapshot!: Snapshot;
  private game: GameDefinition;
  private storage: Storage;
  private client: JsonClient;
  constructor(game: GameDefinition, storage: Storage, fetcher: typeof fetch = fetch) {
    this.game = game; this.storage = storage; this.client = new JsonClient(fetcher);
    this.key = game.id + ".proposal-v1";
  }
  private async request(path: string, body?: unknown, playToken?: string): Promise<Response> {
    const code = this.game.routing.query === "tavern" ? "tavern-drop" : this.game.routing.query;
    return this.client.request<Response>(`/api/v1${path}`, { ...body as object, gameCode: code }, {
      "Session-Id": this.sessionId, Authorization: `Bearer ${this.token}`,
      ...(playToken ? { "Play-Token": playToken } : {}),
    });
  }
  private board(reels: number[]): Board {
    if (reels.length !== this.game.reels * this.game.rows) throw Error("INVALID_BOARD_SIZE");
    return Array.from({ length: this.game.reels }, (_, reel) => Array.from({ length: this.game.rows }, (_, row) => {
      const symbol = this.symbols[reels[row * this.game.reels + reel]];
      if (!symbol || !this.game.symbols.some((item) => item.id === symbol)) throw Error("UNKNOWN_SYMBOL");
      return symbol;
    }));
  }
  private feature(step?: Step): FeatureState | null {
    const f = step?.freegame;
    if (!f) return null;
    const opened = new Map(step.openedChests.map((chest) => [chest.reel - 1, chest.multiplier]));
    return {
      mode: f.featureMode, remaining: f.remainSpin, played: f.curSpin, accumulated: f.totalWinMinor,
      chests: Array.from({ length: this.game.reels }, (_, reel) => {
        const rows = f.keyPositions.filter((pos) => (pos - 1) % this.game.reels === reel).map((pos) => Math.floor((pos - 1) / this.game.reels));
        return { rows, unlocked: rows.length === this.game.rows, multiplier: opened.get(reel) ?? null };
      }),
    };
  }
  private state(response: Response, step?: Step): Snapshot {
    const active = response.presentationStatus === "pending" || !!response.resume?.summaryId;
    return {
      version: response.releasedThrough ?? 0, balance: response.wallet.confirmedBalanceMinor,
      board: this.board(step?.reels ?? response.lastReels!),
      feature: active ? this.feature(step) : null,
      round: active && response.roundId ? { id: response.roundId, bet: response.originalBaseBetMinor!, baseWin: 0, cap: response.roundCapMinor! } : null,
    };
  }
  async session(): Promise<Snapshot> {
    if (this.sessionId) return this.refresh();
    let userId = this.storage.getItem(this.key + ".user");
    if (!userId) { userId = "local-" + crypto.randomUUID(); this.storage.setItem(this.key + ".user", userId); }
    const login = await this.request("/login", { userId });
    this.sessionId = login.sessionId!; this.token = login.token!;
    return this.refresh();
  }
  private async refresh() {
    const response = await this.request("/game-info");
    const settings = response.settings!;
    if (settings.cols !== this.game.reels || settings.rows !== this.game.rows) throw Error("CONFIG_GEOMETRY_MISMATCH");
    this.symbols = settings.symbolIds;
    this.game.currency = { code: settings.currency, exponent: settings.currencyExponent, locale: "en-US" };
    this.game.bets.splice(0, this.game.bets.length, ...settings.allowedBetMinor);
    this.game.defaultBet = settings.defaultBetMinor;
    this.game.lines = settings.paylines.map((line) => line.positions.map((pos) => Math.floor((pos - 1) / settings.cols)));
    this.game.demo.chancePrices = { standard: settings.chancePrices.normal, extra: settings.chancePrices.extra, super: settings.chancePrices.super };
    this.game.demo.buyPrices = settings.buyPrices;
    this.game.demo.capMultiplier = settings.roundCapMultiplier;
    this.response = response; this.playToken = response.playToken ?? "";
    this.active = response.resume?.step;
    this.staticResult = response.resume?.mode === "show_stored_result";
    this.summaryId = response.resume?.summaryId;
    this.hasResume = !!response.resume && (response.presentationStatus === "pending" || !!this.summaryId);
    this.queued = undefined;
    this.snapshot = this.state(response, this.hasResume ? (this.staticResult ? this.active : response.resume?.snapshot ?? this.active) : undefined);
    if (this.hasResume) this.snapshot.resume = {
      curStep: this.summaryId ? "free-end" : this.active!.curStep,
      featureMode: this.active?.freegame?.featureMode ?? response.resume?.snapshot?.freegame?.featureMode ?? null,
      kind: response.resume!.mode,
    };
    return this.snapshot;
  }
  private outcome(response: Response, step: Step): Outcome {
    const beforeWin = response.resume?.snapshot?.displayWinMinor ?? this.snapshot?.feature?.accumulated ?? 0;
    this.response = response; this.active = step;
    this.playToken = response.playToken ?? this.playToken;
    this.snapshot = this.state(response, step);
    const wins = (step.winLines ?? []).filter((line) => line.type === "N").map((line) => {
      const positions = line.winSym.map((pos) => ({ reel: (pos - 1) % this.game.reels, row: Math.floor((pos - 1) / this.game.reels) }));
      return { line: line.lineId - 1, positions, amount: line.win_amt, symbol: this.snapshot.board[positions[0].reel][positions[0].row] };
    });
    const final = step.curStep === "free-end";
    const total = step.finalRoundAwardMinor ?? step.displayWinMinor;
    return {
      requestId: step.stepId, bet: response.originalBaseBetMinor!, state: structuredClone(this.snapshot), wins,
      spinWin: step.totalwin_amt ?? 0, entry: step.curStep === "intro" ? step.freegame!.featureMode : null,
      scatterPositions: [...new Set((step.winLines ?? []).filter((line) => line.type === "S").flatMap((line) => line.winSym))]
        .map((pos) => ({ reel: (pos - 1) % this.game.reels, row: Math.floor((pos - 1) / this.game.reels) })),
      retrigger: step.retriggerSpins ?? 0, collected: [], finalFeature: null,
      completion: final ? { accumulated: total, multipliers: [], product: 1, featureAward: total, roundAward: total, capped: total >= response.roundCapMinor! } : null,
      paidAward: response.settlement?.creditedMinor ?? 0, capped: (final || step.curStep === "base") && total >= response.roundCapMinor!,
      checkpoint: { curStep: step.curStep, staticResult: this.staticResult, resumed: !!response.resume, reel: step.reel === undefined ? undefined : step.reel - 1,
        multiplier: step.multiplier, displayWinMinor: step.displayWinMinor,
        beforeWinMinor: beforeWin },
    };
  }
  async resume(refresh = true): Promise<Outcome> {
    if (refresh) await this.refresh();
    if (this.summaryId) {
      const amount = this.response.resume!.finalRoundAwardMinor!;
      const step: Step = { stepId: this.summaryId, curStep: "free-end", reels: this.response.lastReels!,
        freegame: null, openedChests: [], displayWinMinor: amount, finalRoundAwardMinor: amount };
      return this.outcome(this.response, step);
    }
    if (!this.active && ["completed", "auto_closed"].includes(this.response.presentationStatus ?? "")) {
      // The final ACK may have committed even though its HTTP response was lost.
      const step: Step = { stepId: this.response.roundId! + "-settled", curStep: "settled", reels: this.response.lastReels!,
        freegame: null, openedChests: [], displayWinMinor: this.response.settlement?.creditedMinor ?? 0 };
      return this.outcome(this.response, step);
    }
    if (!this.active) throw Error("NO_PENDING_PRESENTATION");
    return this.outcome(this.response, this.active);
  }
  async execute(command: Command): Promise<Outcome> {
    if (this.queued) {
      const next = this.queued; this.queued = undefined; this.staticResult = false;
      return this.outcome(next, next.step!);
    }
    if (this.hasResume) return this.resume();
    const key = this.key + ".wager";
    const saved = this.storage.getItem(key);
    const pending = saved ? JSON.parse(saved) as { requestId: string; token: string } : null;
    const token = pending?.requestId === command.requestId ? pending.token : this.playToken;
    if (!token) throw new ApiError("PLAY_TOKEN_REQUIRED");
    this.storage.setItem(key, JSON.stringify({ requestId: command.requestId, token }));
    const response = command.action === "spin"
      ? await this.request("/spin", { isFreespin: 0, betMinor: command.bet, chanceMode: command.chance === "standard" ? "normal" : command.chance }, token)
      : await this.request("/buy-feature", { betMinor: command.bet, featureMode: command.action === "buy-drop" ? "drop" : "tavern" }, token);
    this.staticResult = false;
    // Retain the token receipt until the next wager; a lost response retries the same entitlement.
    return this.outcome(response, response.step!);
  }
  async completePresentation(): Promise<Snapshot> {
    if (!this.active) return this.snapshot;
    if (this.response.presentationStatus !== "pending" && !this.summaryId) return this.snapshot;
    const response = this.summaryId
      ? await this.request("/spin", { isFreespin: 0, curStep: "final-summary", summaryId: this.summaryId })
      : await this.request("/spin", { isFreespin: 1, curStep: this.active.curStep, stepId: this.active.stepId,
        ...(this.staticResult ? { kind: "shown_as_result" } : {}) });
    this.snapshot.balance = response.wallet.confirmedBalanceMinor;
    this.playToken = response.playToken ?? "";
    this.hasResume = false; this.summaryId = undefined;
    if (response.presentationStatus === "pending") this.queued = response;
    else { this.snapshot.feature = null; this.snapshot.round = null; }
    return structuredClone(this.snapshot);
  }
  nextPresentation(): Outcome | null {
    if (!this.queued?.step || this.queued.step.curStep === "freespin") return null;
    const next = this.queued; this.queued = undefined; this.staticResult = false;
    return this.outcome(next, next.step!);
  }
}

export function createGameTransport(game: GameDefinition, storage: Storage): GameTransport {
  return game.routing.contract === "proposal-v1" ? new ProposalTransport(game, storage) : new HttpTransport(game.routing.apiBase);
}
