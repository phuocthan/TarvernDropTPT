import type { GameDefinition } from "./domain/contracts.ts";
import { validateDefinition } from "./domain/rules.ts";

const key = /^[a-z][a-z0-9-]*$/;
const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;
const positiveInt = (value: number) => Number.isSafeInteger(value) && value > 0;
const nonNegative = (value: number) => Number.isFinite(value) && value >= 0;
const nonNegativeInt = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

export function loadGameConfig(raw: unknown): GameDefinition {
  if (!raw || typeof raw !== "object")
    throw Error("Game config must be an object");
  const game = raw as GameDefinition;
  const invalid = (field: string): never => {
    throw Error(`Invalid game config [${game.id ?? "unknown"}]: ${field}`);
  };
  if (game.schemaVersion !== 1) invalid("schemaVersion (expected 1)");
  if (!nonEmpty(game.id) || !key.test(game.id) || !nonEmpty(game.title))
    invalid("id or title");
  const route = game.routing;
  if (
    !route ||
    !nonEmpty(route.query) ||
    !key.test(route.query) ||
    !nonEmpty(route.apiBase) ||
    !/^\/api(?:\/[a-z][a-z0-9-]*)?$/.test(route.apiBase) ||
    !["basic", "tavern"].includes(route.skin)
  )
    invalid("routing");
  if (!positiveInt(game.reels) || !positiveInt(game.rows))
    invalid("reels or rows");
  if (!Array.isArray(game.symbols) || !game.symbols.length) invalid("symbols");
  if (
    !game.symbols.every(
      (symbol) =>
        symbol &&
        nonEmpty(symbol.id) &&
        nonEmpty(symbol.label) &&
        nonEmpty(symbol.glyph) &&
        typeof symbol.color === "string" &&
        /^#[\da-f]{6}$/i.test(symbol.color) &&
        ["royal", "premium", "wild", "bonus"].includes(symbol.kind) &&
        symbol.pays &&
        typeof symbol.pays === "object" &&
        !Array.isArray(symbol.pays) &&
        Object.entries(symbol.pays).every(
          ([length, award]) =>
            /^[1-9][0-9]*$/.test(length) &&
            Number(length) <= game.reels &&
            nonNegativeInt(award),
        ),
    )
  )
    invalid("symbols");
  if (!game.symbols.some((symbol) => symbol.kind !== "bonus"))
    invalid("symbols (at least one non-Scatter symbol is required)");
  const ids = new Set(game.symbols.map((symbol) => symbol.id));
  if (
    !Array.isArray(game.initialBoard) ||
    game.initialBoard.length !== game.reels ||
    !game.initialBoard.every(
      (column) =>
        Array.isArray(column) &&
        column.length === game.rows &&
        column.every((id) => ids.has(id)),
    )
  )
    invalid("initialBoard (expected [reel][row] with known symbol IDs)");
  if (!Array.isArray(game.lines) || !game.lines.every(Array.isArray))
    invalid("lines");
  validateDefinition(game);
  if (
    !Array.isArray(game.bets) ||
    !game.bets.length ||
    !game.bets.every(positiveInt)
  )
    invalid("bets");
  if (!game.bets.includes(game.defaultBet))
    invalid("defaultBet (expected a value from bets)");

  const display = game.presentation;
  if (
    !display ||
    !["normal", "drop"].includes(display.spinType) ||
    !positiveInt(display.cellSizePx) ||
    !nonNegativeInt(display.gapPx)
  )
    invalid("presentation");
  const { normal, drop } = display;
  if (
    !normal ||
    ![
      normal.speedPxPerSecond,
      normal.turboSpeedPxPerSecond,
      normal.bounceMs,
    ].every(positiveInt) ||
    ![normal.stopDelayMs, normal.turboStopDelayMs, normal.bouncePx].every(
      nonNegativeInt,
    )
  )
    invalid("presentation.normal");
  if (
    !drop ||
    !positiveInt(drop.turboMultiplier) ||
    !positiveInt(drop.bounceMs) ||
    !nonNegativeInt(drop.bouncePx) ||
    ![drop.enter, drop.exit].every(
      (phase) =>
        phase &&
        positiveInt(phase.fallMs) &&
        [phase.reelStaggerMs, phase.rowStaggerMs, phase.holdMs].every(
          nonNegativeInt,
        ),
    )
  )
    invalid("presentation.drop");

  const demo = game.demo;
  if (
    !demo ||
    !nonNegativeInt(demo.initialBalance) ||
    !positiveInt(demo.capMultiplier) ||
    !nonNegativeInt(demo.retriggerSpins) ||
    !nonNegativeInt(demo.maxFeatureSpins) ||
    !Array.isArray(demo.winTiers) ||
    !demo.winTiers.every(
      (tier) => tier && nonEmpty(tier.label) && nonNegative(tier.multiplier),
    )
  )
    invalid("demo");
  if (!positiveInt(demo.chancePrices?.standard))
    invalid("demo.chancePrices.standard");
  for (const chance of ["standard", "extra", "super"] as const) {
    const rate = demo.scatterRates?.[chance];
    if (
      !nonNegativeInt(demo.chancePrices?.[chance]) ||
      !nonNegative(rate) ||
      rate > 1
    )
      invalid(`demo.chancePrices or demo.scatterRates [${chance}]`);
  }
  for (const mode of ["tavern", "drop"] as const) {
    const spins = demo.featureSpins?.[mode];
    const pool = demo.chestMultipliers?.[mode];
    if (
      !nonNegativeInt(demo.buyPrices?.[mode]) ||
      !nonNegativeInt(spins) ||
      !Array.isArray(pool) ||
      !pool.every(positiveInt) ||
      (spins > 0 &&
        (!pool.length ||
          game.reels < (mode === "drop" ? 4 : 3) ||
          spins > demo.maxFeatureSpins ||
          !game.symbols.some((symbol) => symbol.kind === "bonus")))
    )
      invalid(`demo bonus settings [${mode}]`);
  }
  return game;
}
