import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Board, FeatureState, GameDefinition, Outcome } from "../src/framework/domain/contracts.ts";
import { MockGame } from "./mock-game.ts";

type Payload = Record<string, unknown>;
type CurStep = "base" | "intro" | "freespin" | "show-chest" | "open-chest" | "free-end";
interface Feature {
  featureMode: "tavern" | "drop";
  totalSpins: number;
  curSpin: number;
  remainSpin: number;
  totalWinMinor: number;
  curStep: CurStep;
  keyPositions: number[];
}
interface Step extends Payload {
  stepId: string;
  type: string;
  curStep: CurStep;
  freegame: Feature | null;
  reels: number[];
  openedChests: { reel: number; multiplier: number }[];
  displayWinMinor: number;
}
interface Round {
  roundId: string;
  configId: string;
  settings: Payload;
  originalBaseBetMinor: number;
  chargedMinor: number;
  finalAwardMinor: number;
  steps: Step[];
  releasedThrough: number;
  presentedThrough: number;
  presentationStatus: "pending" | "completed" | "auto_closed";
  lastActivityAt: number;
  deadlineAt: number;
  summaryId: string | null;
  settlement: { status: "pending" | "paid" | "no_payout"; creditedMinor: number; settlementId: string | null };
}
interface Receipt {
  fingerprint: string;
  response: Payload;
}
interface AccountGame {
  balance: number;
  walletVersion: number;
  playToken: string;
  lastReels: number[];
  latestRoundId: string | null;
  rounds: Record<string, Round>;
  wagers: Record<string, Receipt>;
  acknowledgments: Record<string, Receipt>;
}
interface Database {
  schemaVersion: 1;
  sessions: Record<string, { userId: string; token: string }>;
  accounts: Record<string, Record<string, AccountGame>>;
}
export class ProposalError extends Error {
  status: number;
  constructor(code: string, status = 409) {
    super(code);
    this.status = status;
  }
}

const DAY = 24 * 60 * 60 * 1000;
const SYMBOLS = ["wild", "crown", "barrel", "coin", "ale", "A", "K", "Q", "J", "10", "bonus"];
function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(fingerprint).join(",") + "]";
  if (value && typeof value === "object")
    return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ":" + fingerprint(item)).join(",") + "}";
  return JSON.stringify(value);
}
function requireFields(body: Payload, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new ProposalError("INVALID_FIELDS", 400);
}

/** Local synthetic implementation of FE-BE-Proposal. Persisted state is the authority. */
export class ProposalBackend {
  private database: Database;
  private definitions = new Map<string, GameDefinition>();
  private file: string;
  private now: () => number;
  private rng: () => number;
  constructor(games: GameDefinition[], file: string, options: { now?: () => number; rng?: () => number } = {}) {
    this.file = resolve(file);
    this.now = options.now ?? Date.now;
    this.rng = options.rng ?? Math.random;
    for (const source of games) {
      const game = structuredClone(source);
      game.bets = [100, 500, 1000, 2000, 5000, 10000];
      game.defaultBet = 1000;
      game.demo.capMultiplier = 10000;
      game.demo.initialBalance = 10000000;
      const code = game.routing.query === "tavern" ? "tavern-drop" : game.routing.query;
      this.definitions.set(code, game);
    }
    try {
      this.database = JSON.parse(readFileSync(this.file, "utf8"));
      if (this.database.schemaVersion !== 1 || !this.database.sessions || !this.database.accounts)
        throw Error("Unsupported proposal database");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.database = { schemaVersion: 1, sessions: {}, accounts: {} };
    }
  }
  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = this.file + ".tmp";
    writeFileSync(temporary, JSON.stringify(this.database), { encoding: "utf8", flush: true });
    renameSync(temporary, this.file);
  }
  /** A synchronous transaction serializes requests and rolls memory back on persistence failure. */
  private transaction<T>(operation: () => T): T {
    const previous = structuredClone(this.database);
    try {
      const result = operation();
      this.save();
      return structuredClone(result);
    } catch (error) {
      this.database = previous;
      throw error;
    }
  }
  login(body: Payload) {
    requireFields(body, ["userId"]);
    if (body.userId !== undefined &&
        (typeof body.userId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.userId) || body.userId in Object.prototype))
      throw new ProposalError("INVALID_USER_ID", 400);
    return this.transaction(() => {
      const userId = body.userId as string | undefined ?? "demo-player-" + (1 + Math.floor(this.rng() * 5));
      const sessionId = randomUUID();
      const token = randomUUID();
      this.database.sessions[sessionId] = { userId, token };
      return { code: 0, synthetic: true, contractVersion: "v1-review-6", userId, sessionId, token };
    });
  }
  private context(sessionId: string, token: string, gameCode: string) {
    const session = this.database.sessions[sessionId];
    if (!session || session.token !== token) throw new ProposalError("INVALID_SESSION", 401);
    const definition = this.definitions.get(gameCode);
    if (!definition) throw new ProposalError("UNKNOWN_GAME", 404);
    const games = this.database.accounts[session.userId] ??= {};
    let account = games[gameCode];
    if (!account) {
      account = {
        balance: definition.demo.initialBalance, walletVersion: 0, playToken: randomUUID(),
        lastReels: this.reels(definition.initialBoard), latestRoundId: null,
        rounds: {}, wagers: {}, acknowledgments: {},
      };
      games[gameCode] = account;
    }
    return { account, definition };
  }
  private reels(board: Board) {
    return Array.from({ length: board[0].length }, (_, row) =>
      board.map((column) => {
        const id = SYMBOLS.indexOf(column[row]) + 1;
        if (!id) throw new ProposalError("UNSUPPORTED_SYMBOL", 500);
        return id;
      })).flat();
  }
  private feature(state: FeatureState, baseWin: number, curStep: CurStep): Feature {
    return {
      featureMode: state.mode, totalSpins: state.played + state.remaining,
      curSpin: state.played, remainSpin: state.remaining,
      totalWinMinor: baseWin + state.accumulated, curStep,
      keyPositions: state.chests.flatMap((chest, reel) => chest.rows.map((row) => row * state.chests.length + reel + 1)).sort((a, b) => a - b),
    };
  }
  private spinStep(outcome: Outcome, feature: Feature | null, type: string, curStep: CurStep): Step {
    const cols = outcome.state.board.length;
    return {
      stepId: randomUUID(), type, curStep, reels: this.reels(outcome.state.board),
      winLines: outcome.wins.map((win) => ({
        type: "N", lineId: win.line + 1,
        winSym: win.positions.map(({ reel, row }) => row * cols + reel + 1),
        win_amt: win.amount,
      })),
      totalwin_amt: outcome.spinWin, retriggerSpins: outcome.retrigger,
      freegame: feature, openedChests: [], displayWinMinor: feature?.totalWinMinor ?? outcome.spinWin,
    };
  }
  private settings(definition: GameDefinition): Payload {
    return {
      configId: definition.id + "-" + createHash("sha256").update(fingerprint(definition)).digest("hex").slice(0, 16),
      cols: definition.reels, rows: definition.rows, lineCount: definition.lines.length,
      currency: "KRW", currencyExponent: 0, defaultBetMinor: definition.defaultBet, allowedBetMinor: definition.bets,
      roundCapMultiplier: 10000,
      symbolIds: Object.fromEntries(SYMBOLS.map((symbol, index) => [index + 1, symbol])),
      paylines: definition.lines.map((line, index) => ({ lineId: index + 1, positions: line.map((row, reel) => row * definition.reels + reel + 1) })),
      chancePrices: { normal: definition.demo.chancePrices.standard, extra: definition.demo.chancePrices.extra, super: definition.demo.chancePrices.super },
      buyPrices: definition.demo.buyPrices,
    };
  }
  private buildRound(definition: GameDefinition, bet: number, action: "spin" | "buy-tavern" | "buy-drop", chance: "standard" | "extra" | "super"): Round {
    const mock = new MockGame(definition, this.rng);
    mock.state.balance = Number.MAX_SAFE_INTEGER / 2;
    let outcome = mock.execute({ requestId: randomUUID(), expectedVersion: 0, action, bet, chance });
    const mode = outcome.entry;
    const chargedMinor = bet * (action === "spin" ? definition.demo.chancePrices[chance] : definition.demo.buyPrices[action === "buy-drop" ? "drop" : "tavern"]);
    const baseWin = outcome.spinWin;
    const steps = [this.spinStep(outcome, null, "base_spin", "base")];
    let finalAward = baseWin;
    if (mode && outcome.state.feature) {
      const feature = this.feature(outcome.state.feature, baseWin, "intro");
      steps.push(this.spinStep(outcome, feature, "bonus_enter", "intro"));
      while (mock.state.feature) {
        outcome = mock.execute({ requestId: randomUUID(), expectedVersion: mock.state.version, action: "spin", bet, chance: "standard" });
        const state = outcome.finalFeature ?? outcome.state.feature!;
        if (outcome.completion) state.remaining = 0;
        const after = this.feature(state, baseWin, "freespin");
        steps.push(this.spinStep(outcome, after, "free_spin", "freespin"));
      }
      const completion = outcome.completion!;
      finalAward = completion.roundAward;
      const final = steps.at(-1)!;
      const eligible = outcome.finalFeature!.chests
        .map((chest, index) => ({ ...chest, reel: index + 1 }))
        .filter((chest) => chest.unlocked);
      const opened: { reel: number; multiplier: number }[] = [];
      if (eligible.length) {
        steps.push({
          ...structuredClone(final), stepId: randomUUID(), type: "chest_summary", curStep: "show-chest",
          freegame: { ...final.freegame!, curStep: "show-chest" },
          eligibleReels: eligible.map((chest) => chest.reel),
        });
        let amount = completion.accumulated;
        for (const chest of eligible) {
          amount = Math.min(amount * chest.multiplier!, Math.max(0, bet * 10000 - baseWin));
          opened.push({ reel: chest.reel, multiplier: chest.multiplier! });
          steps.push({
            stepId: randomUUID(), type: "chest_reveal", curStep: "open-chest",
            reels: [...final.reels], reel: chest.reel, multiplier: chest.multiplier!,
            displayWinMinor: baseWin + amount, displayWinAfterMinor: baseWin + amount,
            openedChests: structuredClone(opened),
            freegame: { ...final.freegame!, curStep: "open-chest", totalWinMinor: baseWin + amount },
          });
        }
      }
      steps.push({
        stepId: randomUUID(), type: "total_win", curStep: "free-end", reels: [...final.reels],
        displayWinMinor: finalAward, finalRoundAwardMinor: finalAward,
        openedChests: structuredClone(opened),
        freegame: { ...final.freegame!, curStep: "free-end", totalWinMinor: finalAward },
      });
    }
    const now = this.now();
    const settings = this.settings(definition);
    return {
      roundId: randomUUID(), configId: settings.configId as string, settings, originalBaseBetMinor: bet,
      chargedMinor, finalAwardMinor: finalAward, steps,
      releasedThrough: mode ? 2 : 1, presentedThrough: 1,
      presentationStatus: mode ? "pending" : "completed", lastActivityAt: now, deadlineAt: now + 30 * DAY,
      summaryId: null, settlement: { status: "pending", creditedMinor: 0, settlementId: null },
    };
  }
  private settle(account: AccountGame, round: Round) {
    if (round.settlement.status !== "pending") return;
    account.balance += round.finalAwardMinor;
    account.walletVersion++;
    round.settlement = {
      status: round.finalAwardMinor ? "paid" : "no_payout",
      creditedMinor: round.finalAwardMinor, settlementId: "award-" + round.roundId,
    };
    account.playToken = randomUUID();
  }
  private expire(account: AccountGame) {
    for (const round of Object.values(account.rounds)) {
      if (round.presentationStatus !== "pending" || round.deadlineAt > this.now()) continue;
      round.presentationStatus = "auto_closed";
      round.summaryId = randomUUID();
      this.settle(account, round);
    }
  }
  sweepExpired() {
    let expired = false;
    for (const games of Object.values(this.database.accounts))
      for (const account of Object.values(games))
        if (Object.values(account.rounds).some((round) => round.presentationStatus === "pending" && round.deadlineAt <= this.now()))
          expired = true;
    if (!expired) return;
    this.transaction(() => {
      for (const games of Object.values(this.database.accounts))
        for (const account of Object.values(games)) this.expire(account);
    });
  }
  private envelope(account: AccountGame, round?: Round): Payload {
    const allowed = !round || (round.presentationStatus !== "pending" && !round.summaryId && round.settlement.status !== "pending");
    return {
      code: 0, synthetic: true, contractVersion: "v1-review-6", currency: "KRW", currencyExponent: 0,
      wallet: { confirmedBalanceMinor: account.balance, walletVersion: account.walletVersion },
      canStartPaidRound: allowed,
      ...(allowed ? { playToken: account.playToken } : {}),
      ...(round ? {
        roundId: round.roundId, originalBaseBetMinor: round.originalBaseBetMinor,
        chargedMinor: round.chargedMinor, roundCapMinor: round.originalBaseBetMinor * 10000,
        configId: round.configId, releasedThrough: round.releasedThrough, presentedThrough: round.presentedThrough,
        inactivityDeadlineAt: new Date(round.deadlineAt).toISOString(),
        presentationStatus: round.presentationStatus, settlement: structuredClone(round.settlement),
      } : {}),
    };
  }
  private release(account: AccountGame, round: Round): Payload {
    const step = round.steps[round.releasedThrough - 1];
    account.lastReels = [...step.reels];
    return {
      ...this.envelope(account, round), step: structuredClone(step), stepId: step.stepId,
      freegame: structuredClone(step.freegame), reels: [...step.reels],
      winLines: step.winLines ?? [], totalwin_amt: step.totalwin_amt ?? 0,
    };
  }
  handle(method: string, path: string, body: Payload, auth: { sessionId: string; token: string; playToken: string }, gameCode = "tavern-drop"): Payload {
    if (method !== "POST") throw new ProposalError("METHOD_NOT_ALLOWED", 405);
    if (body.gameCode !== undefined) {
      if (typeof body.gameCode !== "string" || !this.definitions.has(body.gameCode)) throw new ProposalError("UNKNOWN_GAME", 400);
      gameCode = body.gameCode;
      body = { ...body };
      delete body.gameCode;
    }
    if (method === "POST" && path === "/login") return this.login(body);
    return this.transaction(() => {
      const { account, definition } = this.context(auth.sessionId, auth.token, gameCode);
      this.expire(account);
      const current = account.latestRoundId ? account.rounds[account.latestRoundId] : undefined;
      if (path === "/game-info") {
        requireFields(body, []);
        const resume = current?.summaryId ? {
          mode: "final_summary", roundId: current.roundId, summaryId: current.summaryId,
          finalRoundAwardMinor: current.finalAwardMinor,
        } : current && (current.presentationStatus === "pending" || current.steps.length === 1) ? {
          mode: current.steps[current.releasedThrough - 1].curStep === "freespin" || current.steps.length === 1
            ? "show_stored_result" : "play_step",
          roundId: current.roundId, releasedThrough: current.releasedThrough, presentedThrough: current.presentedThrough,
          step: structuredClone(current.steps[current.releasedThrough - 1]),
          snapshot: structuredClone(current.steps[(current.steps[current.releasedThrough - 1].curStep === "freespin"
            ? current.releasedThrough : current.presentedThrough) - 1]),
        } : null;
        return {
          ...this.envelope(account, current),
          settings: current?.presentationStatus === "pending" || current?.summaryId ? current.settings : this.settings(definition),
          lastReels: [...account.lastReels], resume,
          freegame: current?.presentationStatus === "pending" ? current.steps[current.releasedThrough - 1].freegame : null,
        };
      }
      if (path === "/rounds/status") {
        requireFields(body, []);
        return this.envelope(account, current);
      }
      if (method !== "POST" || !["/spin", "/buy-feature"].includes(path)) throw new ProposalError("NOT_FOUND", 404);
      if (path === "/spin" && body.curStep === "final-summary") {
        requireFields(body, ["isFreespin", "curStep", "summaryId"]);
        if (body.isFreespin !== 0 || typeof body.summaryId !== "string") throw new ProposalError("INVALID_SUMMARY", 400);
        const key = body.summaryId;
        const saved = account.acknowledgments[key];
        if (saved) {
          if (saved.fingerprint !== fingerprint(body)) throw new ProposalError("REQUEST_CONFLICT");
          return saved.response;
        }
        const round = Object.values(account.rounds).find((item) => item.summaryId === key);
        if (!round) throw new ProposalError("UNKNOWN_SUMMARY");
        round.summaryId = null;
        const response = { ...this.envelope(account, current), resume: null };
        account.acknowledgments[key] = { fingerprint: fingerprint(body), response };
        return response;
      }
      if (path === "/spin" && body.isFreespin === 1) {
        requireFields(body, ["isFreespin", "curStep", "stepId", "kind"]);
        if (typeof body.stepId !== "string" || (body.kind !== undefined && body.kind !== "shown_as_result"))
          throw new ProposalError("INVALID_CHECKPOINT", 400);
        const key = body.stepId;
        const saved = account.acknowledgments[key];
        if (saved) {
          if (saved.fingerprint !== fingerprint(body)) throw new ProposalError("REQUEST_CONFLICT");
          return saved.response;
        }
        const round = Object.values(account.rounds).find((item) => item.steps.some((step) => step.stepId === key));
        if (!round || round !== current || round.presentationStatus !== "pending") throw new ProposalError("STALE_STEP");
        const step = round.steps[round.releasedThrough - 1];
        if (step.stepId !== key || step.curStep !== body.curStep) throw new ProposalError("INVALID_CHECKPOINT");
        round.presentedThrough = round.releasedThrough;
        round.lastActivityAt = this.now();
        round.deadlineAt = this.now() + 30 * DAY;
        if (round.presentedThrough === round.steps.length) {
          round.presentationStatus = "completed";
          this.settle(account, round);
        } else round.releasedThrough++;
        const response = round.presentationStatus === "completed"
          ? { ...this.envelope(account, round), freegame: null, resume: null }
          : this.release(account, round);
        account.acknowledgments[key] = { fingerprint: fingerprint(body), response };
        return response;
      }
      requireFields(body, path === "/spin" ? ["isFreespin", "betMinor", "chanceMode"] : ["betMinor", "featureMode"]);
      if (!auth.playToken) throw new ProposalError("PLAY_TOKEN_REQUIRED", 400);
      const requestHash = fingerprint({ path, body });
      const saved = account.wagers[auth.playToken];
      if (saved) {
        if (saved.fingerprint !== requestHash) throw new ProposalError("REQUEST_CONFLICT");
        return saved.response;
      }
      if (auth.playToken !== account.playToken) throw new ProposalError("INVALID_PLAY_TOKEN");
      if (!this.envelope(account, current).canStartPaidRound) throw new ProposalError("ROUND_IN_PROGRESS");
      if (!Number.isSafeInteger(body.betMinor) || !definition.bets.includes(body.betMinor as number))
        throw new ProposalError("INVALID_BET", 400);
      let action: "spin" | "buy-tavern" | "buy-drop" = "spin";
      let chance: "standard" | "extra" | "super" = "standard";
      if (path === "/buy-feature") {
        if (!["tavern", "drop"].includes(body.featureMode as string)) throw new ProposalError("INVALID_FEATURE", 400);
        action = body.featureMode === "drop" ? "buy-drop" : "buy-tavern";
      } else {
        if (body.isFreespin !== 0 || !["normal", "extra", "super"].includes(body.chanceMode as string))
          throw new ProposalError("INVALID_SPIN", 400);
        chance = body.chanceMode === "normal" ? "standard" : body.chanceMode as "extra" | "super";
      }
      const cost = (body.betMinor as number) * (action === "spin"
        ? definition.demo.chancePrices[chance]
        : definition.demo.buyPrices[action === "buy-drop" ? "drop" : "tavern"]);
      if (!cost) throw new ProposalError("MODE_UNAVAILABLE", 400);
      if (account.balance < cost) throw new ProposalError("INSUFFICIENT_BALANCE");
      const round = this.buildRound(definition, body.betMinor as number, action, chance);
      account.balance -= round.chargedMinor;
      account.walletVersion++;
      account.rounds[round.roundId] = round;
      account.latestRoundId = round.roundId;
      if (round.presentationStatus === "completed") this.settle(account, round);
      const response = this.release(account, round);
      account.wagers[auth.playToken] = { fingerprint: requestHash, response };
      return response;
    });
  }
}
