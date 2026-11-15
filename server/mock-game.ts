import { randomUUID } from "node:crypto";
import type {
  Board,
  Chance,
  Command,
  FeatureState,
  GameDefinition,
  LineWin,
  Outcome,
  Snapshot,
} from "../src/framework/domain/contracts.ts";
import {
  collect,
  evaluate,
  settleFeature,
} from "../src/framework/domain/rules.ts";
/** Fake server only. No certified math or real-money support. */
export class MockGame {
  state: Snapshot;
  private receipts = new Map<string, { command: string; outcome: Outcome }>();
  private game: GameDefinition;
  private rng: () => number;
  constructor(game: GameDefinition, rng: () => number = Math.random) {
    this.game = game;
    this.rng = rng;
    this.state = {
      version: 0,
      balance: game.demo.initialBalance,
      board: structuredClone(game.initialBoard),
      feature: null,
      round: null,
    };
  }
  execute(command: Command, forcedBoard?: Board): Outcome {
    const hash = JSON.stringify(command),
      receipt = this.receipts.get(command.requestId);
    if (receipt) {
      if (receipt.command !== hash) throw Error("REQUEST_CONFLICT");
      return structuredClone(receipt.outcome);
    }
    if (!command.requestId || command.requestId.length > 100)
      throw Error("INVALID_REQUEST");
    if (command.expectedVersion !== this.state.version)
      throw Error("STALE_SESSION");
    if (
      !["spin", "buy-tavern", "buy-drop"].includes(command.action) ||
      !["standard", "extra", "super"].includes(command.chance) ||
      !this.game.bets.includes(command.bet)
    )
      throw Error("INVALID_COMMAND");
    const state = structuredClone(this.state),
      feature = state.feature,
      rules = this.game.demo;
    if (
      feature &&
      (command.action !== "spin" ||
        command.bet !== state.round?.bet ||
        command.chance !== "standard")
    )
      throw Error("FEATURE_LOCKED");
    const buy =
      command.action === "buy-tavern"
        ? "tavern"
        : command.action === "buy-drop"
          ? "drop"
          : null;
    if ((buy && !rules.featureSpins[buy]) ||
        (!feature && !rules.chancePrices[command.chance]))
      throw Error("INVALID_COMMAND");
    const cost = feature
      ? 0
      : command.bet *
        (buy ? rules.buyPrices[buy] : rules.chancePrices[command.chance]);
    if (state.balance < cost) throw Error("INSUFFICIENT_BALANCE");
    state.balance -= cost;
    const outcome: Outcome = {
      requestId: command.requestId,
      bet: command.bet,
      state,
      wins: [],
      spinWin: 0,
      entry: null,
      retrigger: 0,
      collected: [],
      completion: null,
      finalFeature: null,
      paidAward: 0,
      capped: false,
    };
    if (!feature)
      state.round = {
        id: randomUUID(),
        bet: command.bet,
        baseWin: 0,
        cap: command.bet * rules.capMultiplier,
      };
    if (!buy) {
      const { board, wins } = this.spinResult(command, feature, forcedBoard);
      state.board = board;
      outcome.wins = wins;
      outcome.spinWin = outcome.wins.reduce((n, w) => n + w.amount, 0);
      const bonus = state.board
        .flat()
        .filter(
          (id) => this.game.symbols.find((s) => s.id === id)?.kind === "bonus",
        ).length;
      if (feature) {
        feature.remaining--;
        feature.played++;
        feature.accumulated += outcome.spinWin;
        outcome.collected = collect(
          feature.chests,
          outcome.wins,
          this.game.rows,
        );
        if (bonus >= 3) {
          outcome.retrigger = Math.min(
            rules.retriggerSpins,
            rules.maxFeatureSpins - feature.played - feature.remaining,
          );
          feature.remaining += outcome.retrigger;
        }
        // Stop at the round cap, including the base-game award, before any extra spin.
        const capped =
          feature.accumulated + state.round!.baseWin >= state.round!.cap;
        if (!feature.remaining || capped) {
          const pool = rules.chestMultipliers[feature.mode];
          const multipliers = feature.chests.map((c) => {
            c.multiplier = c.unlocked
              ? pool[Math.floor(this.rng() * pool.length)]
              : 1;
            return c.multiplier;
          });
          outcome.completion = settleFeature(
            feature.accumulated,
            multipliers,
            state.round!.baseWin,
            state.round!.cap,
          );
          outcome.capped = outcome.completion.capped;
          outcome.paidAward = outcome.completion.featureAward;
          state.balance += outcome.paidAward;
          state.feature = null;
          state.round = null;
          // Keep final chest evidence on the result without treating it as active state.
          outcome.finalFeature = structuredClone(feature);
        }
      } else {
        state.round!.baseWin = Math.min(outcome.spinWin, state.round!.cap);
        outcome.capped = outcome.spinWin >= state.round!.cap;
        outcome.spinWin = state.round!.baseWin;
        outcome.paidAward = state.round!.baseWin;
        state.balance += outcome.paidAward;
        const mode = bonus >= 4 ? "drop" : "tavern";
        if (bonus >= 3 && rules.featureSpins[mode] && state.round!.baseWin < state.round!.cap)
          this.enter(state, mode, outcome);
        else state.round = null;
      }
    } else {
      state.board = this.bonusEntryBoard(buy);
      this.enter(state, buy, outcome);
    }
    state.version++;
    this.state = state;
    this.receipts.set(command.requestId, {
      command: hash,
      outcome: structuredClone(outcome),
    });
    return structuredClone(outcome);
  }
  private enter(state: Snapshot, mode: "tavern" | "drop", outcome: Outcome) {
    state.feature = {
      mode,
      remaining: this.game.demo.featureSpins[mode],
      played: 0,
      accumulated: 0,
      chests: Array.from({ length: this.game.reels }, () => ({
        rows: [],
        unlocked: false,
        multiplier: null,
      })),
    };
    outcome.entry = mode;
  }
  private bonusEntryBoard(mode: FeatureState["mode"]): Board {
    const scatter = this.game.symbols.find((symbol) => symbol.kind === "bonus");
    const count = mode === "drop" ? 4 : 3;
    if (!scatter || this.game.reels < count || this.game.rows < 1)
      throw Error("INVALID_COMMAND");
    const board = this.board(null);
    const reels = board.map((_, reel) => reel);
    for (let placed = 0; placed < count; placed++) {
      const [reel] = reels.splice(Math.floor(this.rng() * reels.length), 1);
      board[reel][Math.floor(this.rng() * this.game.rows)] = scatter.id;
    }
    return board;
  }
  private spinResult(
    command: Command,
    feature: FeatureState | null,
    forcedBoard?: Board,
  ) {
    const board = forcedBoard ?? this.board(command.chance);
    const wins = evaluate(this.game, board, command.bet);
    if (forcedBoard || !feature || feature.chests.some((chest) => chest.unlocked))
      return { board, wins };

    // Keep the sampled Scatter positions while looking for better first-chest progress.
    const scatter = this.game.symbols.find((symbol) => symbol.kind === "bonus");
    const alternative = this.board(null).map((column, reel) =>
      column.map((symbol, row) =>
        board[reel][row] === scatter?.id ? board[reel][row] : symbol,
      ),
    );
    const alternativeWins = evaluate(this.game, alternative, command.bet);
    const leadingKeyCount = (lineWins: LineWin[]) => {
      const chests = structuredClone(feature.chests);
      collect(chests, lineWins, this.game.rows);
      return Math.max(...chests.map((chest) => chest.rows.length));
    };
    return leadingKeyCount(alternativeWins) > leadingKeyCount(wins)
      ? { board: alternative, wins: alternativeWins }
      : { board, wins };
  }
  private board(chance: Chance | null): Board {
    // Deliberately simple demo distribution, unrelated to the reference math.
    const ids = this.game.symbols
      .filter((s) => s.kind !== "bonus")
      .map((s) => s.id);
    const bonusId = this.game.symbols.find((s) => s.kind === "bonus")?.id;
    const bonusRate = chance === null ? 0 : this.game.demo.scatterRates[chance];
    return Array.from({ length: this.game.reels }, () =>
      Array.from({ length: this.game.rows }, () =>
        bonusId && bonusRate > 0 && this.rng() < bonusRate
          ? bonusId
          : ids[Math.floor(this.rng() * ids.length)],
      ),
    );
  }
}
