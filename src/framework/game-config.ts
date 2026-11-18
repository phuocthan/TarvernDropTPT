import type { GameDefinition } from "./domain/contracts.ts";
import { validateDefinition } from "./domain/rules.ts";
import { validateResourceManifest } from "./resources/validate-manifest.ts";

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
  if (game.resources !== undefined) validateResourceManifest(game.resources);
  const invalid = (field: string): never => {
    throw Error(`Invalid game config [${game.id ?? "unknown"}]: ${field}`);
  };
  if (game.schemaVersion !== 1) invalid("schemaVersion (expected 1)");
  if (!nonEmpty(game.id) || !key.test(game.id) || !nonEmpty(game.title))
    invalid("id or title");
  const route = game.routing;
  if (route?.contract !== undefined && route.contract !== "proposal-v1") invalid("routing.contract");
  if (game.currency && (!/^[A-Z]{3}$/.test(game.currency.code) || !nonNegativeInt(game.currency.exponent) || game.currency.exponent > 6)) invalid("currency");
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
        (symbol.image === undefined || nonEmpty(symbol.image)) &&
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
  const { normal, drop, feature, animationGrid, scene } = display;
  if (display.allowForceStop !== undefined && typeof display.allowForceStop !== "boolean") invalid("presentation.allowForceStop");
  if (display.foregroundWinSymbols !== undefined && (!Array.isArray(display.foregroundWinSymbols) ||
      !display.foregroundWinSymbols.every((id) => ids.has(id)))) invalid("presentation.foregroundWinSymbols");
  if (display.winOverflowPaddingPx !== undefined && (!nonNegativeInt(display.winOverflowPaddingPx) || display.winOverflowPaddingPx > display.cellSizePx * 2))
    invalid("presentation.winOverflowPaddingPx");
  const deformation = display.landing;
  if (deformation !== undefined && (!deformation ||
      ![deformation.compressMs, deformation.stretchMs, deformation.settleMs].every(positiveInt) ||
      !nonNegativeInt(deformation.leadMs) || deformation.leadMs > deformation.compressMs + deformation.stretchMs + deformation.settleMs ||
      ![deformation.squashX, deformation.squashY, deformation.stretchX, deformation.stretchY]
        .every((value) => Number.isFinite(value) && value >= 0.5 && value <= 1.5)))
    invalid("presentation.landing");
  const anticipation = drop?.anticipation;
  if (anticipation !== undefined &&
    (!anticipation || !ids.has(anticipation.symbolId) ||
      !positiveInt(anticipation.count) || !nonNegativeInt(anticipation.reelPauseMs)))
    invalid("presentation.drop.anticipation");
  const loading = display.loadingScreen;
  if (loading !== undefined &&
    (!loading || ![loading.background, loading.brandLogo, loading.brandName, loading.gameLogo].every(nonEmpty)))
    invalid("presentation.loadingScreen");
  const brandIntro = loading?.brandIntro;
  if (brandIntro !== undefined &&
      (!brandIntro || !nonEmpty(brandIntro.src) || !positiveInt(brandIntro.durationMs) ||
       (brandIntro.holdUntilReady !== undefined && typeof brandIntro.holdUntilReady !== "boolean")))
    invalid("presentation.loadingScreen.brandIntro");
  const controls = display.controls;
  if (controls !== undefined &&
    (!controls || typeof controls.menu !== "boolean" || !Array.isArray(controls.autoRounds) ||
      !controls.autoRounds.length || !controls.autoRounds.every(positiveInt) ||
      new Set(controls.autoRounds).size !== controls.autoRounds.length ||
      (controls.autoUnlimited !== undefined && typeof controls.autoUnlimited !== "boolean") ||
      (controls.autoTopUp !== undefined && !positiveInt(controls.autoTopUp)) ||
      (controls.betMenuCloseDelayMs !== undefined && !nonNegativeInt(controls.betMenuCloseDelayMs))))
    invalid("presentation.controls");
  if (
    display.symbolEdgeInsetPx !== undefined &&
    (!nonNegativeInt(display.symbolEdgeInsetPx) ||
      display.symbolEdgeInsetPx * 2 >= game.rows * (display.cellSizePx + display.gapPx) - display.gapPx)
  )
    invalid("presentation.symbolEdgeInsetPx");
  if (display.reelMaskPaddingPx !== undefined && !nonNegativeInt(display.reelMaskPaddingPx))
    invalid("presentation.reelMaskPaddingPx");
  if (
    animationGrid !== undefined &&
    (!animationGrid || !nonEmpty(animationGrid.originSlot) ||
      !positiveInt(animationGrid.reelPitch) || !positiveInt(animationGrid.rowPitch))
  )
    invalid("presentation.animationGrid");
  if (
    scene !== undefined &&
    (!scene || !scene.layers || Array.isArray(scene.layers) ||
      typeof scene.layers !== "object" ||
      !Object.entries(scene.layers).every(([name, z]) => key.test(name) && Number.isSafeInteger(z)) ||
      !scene.slots || Array.isArray(scene.slots) || typeof scene.slots !== "object" ||
      !Object.values(scene.slots).every(nonEmpty))
  )
    invalid("presentation.scene");
  const camera = scene?.backgroundCamera;
  const openingDimmer = scene?.openingDimmerOpacity;
  const winScreen = scene?.winScreen;
  if (winScreen !== undefined && (!winScreen ||
      !Number.isFinite(winScreen.centerY) || winScreen.centerY <= 0 || winScreen.centerY >= 1 ||
      !nonNegativeInt(winScreen.paddingPx) ||
      ![winScreen.landscapeFit, winScreen.portraitFit].every((fit) => Number.isFinite(fit) && fit > 0)))
    invalid("presentation.scene.winScreen");
  const openingReveal = scene?.openingReveal;
  const chestCamera = scene?.chestCamera;
  const sideLogo = scene?.sideLogo;
  if (sideLogo !== undefined &&
      (!sideLogo || !Number.isFinite(sideLogo.referenceAspect) || sideLogo.referenceAspect <= 1 ||
       !nonNegative(sideLogo.leftFactor) || !nonNegative(sideLogo.upFactor)))
    invalid("presentation.scene.sideLogo");
  if (chestCamera !== undefined &&
      (!chestCamera || !Number.isFinite(chestCamera.scale) || chestCamera.scale < 1 ||
       !nonNegative(chestCamera.originY) || chestCamera.originY > 1 ||
       !positiveInt(chestCamera.durationMs)))
    invalid("presentation.scene.chestCamera");
  if (openingDimmer !== undefined && (!nonNegative(openingDimmer) || openingDimmer > 1))
    invalid("presentation.scene.openingDimmerOpacity");
  if (openingReveal !== undefined &&
      (!openingReveal || !positiveInt(openingReveal.durationMs) ||
       (openingReveal.playbackRate !== undefined &&
        (!Number.isFinite(openingReveal.playbackRate) || openingReveal.playbackRate <= 0)) ||
       ![openingReveal.symbolDelayMs, openingReveal.mascotDelayMs].every(
         (delay) => nonNegativeInt(delay) && delay < openingReveal.durationMs,
       )))
    invalid("presentation.scene.openingReveal");
  if (
    camera !== undefined &&
    (!camera || ![camera.width, camera.top, camera.landscapeBottom, camera.portraitBottom].every(positiveInt) ||
      !Number.isFinite(camera.centerOffsetX))
  )
    invalid("presentation.scene.backgroundCamera");
  if (
    display.winDimmerOpacity !== undefined &&
    (!nonNegative(display.winDimmerOpacity) || display.winDimmerOpacity > 1)
  )
    invalid("presentation.winDimmerOpacity");
  const landing = display.symbolLandingEffects;
  const checkWinDelay = display.checkWinDelayMs;
  if (checkWinDelay !== undefined &&
      (!checkWinDelay || !nonNegativeInt(checkWinDelay.normal) || !nonNegativeInt(checkWinDelay.turbo)))
    invalid("presentation.checkWinDelayMs");
  if (
    landing !== undefined &&
    (!landing || typeof landing !== "object" || Array.isArray(landing) ||
      !Object.entries(landing).every(
        ([id, clips]) =>
          ids.has(id) && clips && typeof clips === "object" && !Array.isArray(clips) &&
          Object.keys(clips).length > 0 &&
          Object.entries(clips).every(([layer, clip]) => nonEmpty(layer) && nonEmpty(clip)),
      ))
  )
    invalid("presentation.symbolLandingEffects");
  if (
    feature !== undefined &&
    (!feature ||
      !nonNegativeInt(feature.startDelayMs) ||
      !nonNegativeInt(feature.endDelayMs) ||
      (feature.hideSymbolsUntilFirstSpin !== undefined && typeof feature.hideSymbolsUntilFirstSpin !== "boolean"))
  )
    invalid("presentation.feature");
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
    !Number.isFinite(drop.turboMultiplier) ||
    drop.turboMultiplier < 1 ||
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
