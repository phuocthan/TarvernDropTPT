import { randomUUID } from "node:crypto";
import type {
  Board,
  Command,
  GameDefinition,
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
      state.board = forcedBoard ?? this.board(command.chance);
      outcome.wins = evaluate(this.game, state.board, command.bet);
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
          const multipliers = feature.chests.map((c) => {
            c.multiplier = c.unlocked
              ? rules.chestMultipliers[
                  Math.floor(this.rng() * rules.chestMultipliers.length)
                ]
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
        if (bonus >= 3 && state.round!.baseWin < state.round!.cap)
          this.enter(state, bonus >= 4 ? "drop" : "tavern", outcome);
        else state.round = null;
      }
    } else this.enter(state, buy, outcome);
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
  private board(chance: string): Board {
    // Deliberately simple demo distribution, unrelated to the reference math.
    const ids = this.game.symbols
      .filter((s) => s.kind !== "bonus")
      .map((s) => s.id);
    const bonusId = this.game.symbols.find((s) => s.kind === "bonus")?.id;
    const bonusRate =
      chance === "super" ? 0.07 : chance === "extra" ? 0.05 : 0.03;
    return Array.from({ length: this.game.reels }, () =>
      Array.from({ length: this.game.rows }, () =>
        bonusId && this.rng() < bonusRate
          ? bonusId
          : ids[Math.floor(this.rng() * ids.length)],
      ),
    );
  }
}
