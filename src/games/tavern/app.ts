import "./theme.css";
import { createSlotSession } from "../../framework/slot-core/index.ts";
import { gameRuntime } from "../../framework/app/game-runtime.ts";
import { resolveSessionEntry } from "../../framework/app/session-entry.ts";
import { createGameTransport } from "../../framework/transport/proposal.ts";
import { formatMoney } from "../../framework/ui/index.ts";
import { loadTavernSymbols, paytableIcon } from "./skin.ts";
import { createTavernPayline } from "./payline.ts";
import {
  createReelhouse,
  loadReelhouse,
  mountTavernEffects,
} from "./effects.ts";
import { loadTavernBitmapFonts, renderAmount } from "./typography.ts";
import { artRegion, hudIcon, tavernAsset as asset } from "./art.ts";
import { applySceneLayers, revealScene, waitForContinue, type SceneAnchor } from "../../framework/presentation/scene.ts";
import type { BrandLoader } from "../../framework/presentation/brand-loading.ts";
import { mountBetPicker, mountRoundPicker, updateBetTrack } from "../../framework/ui/index.ts";
import { countPayout } from "../../framework/presentation/payout.ts";
import { loadTavernAudio } from "./audio.ts";
import { mountMascot } from "./mascot.ts";
import type {
  Chance,
  Chest,
  FeatureState,
  GameDefinition,
  Outcome,
  ReelMotion,
} from "../../framework/domain/contracts.ts";


export async function mountTavern(root: HTMLElement, game: GameDefinition, loader?: BrandLoader) {
  const runtime = gameRuntime(game);
  const resources = runtime.resources;
  const transport = createGameTransport(game, localStorage);
  const [, initialState] = await Promise.all([
    runtime.prepare(loader && {
      update: (completed, total) => loader.update(completed / total * 70, 100),
    }),
    transport.session(),
  ]);
  loader?.update(75, 100);
  // Downloads may overlap the intro; renderer creation and first renders must wait.
  await loader?.waitForIntro();
  const money = (n: number) => formatMoney(game, n);
  const controls = game.presentation.controls;
  const gameMenuEnabled = controls?.menu ?? false;
  root.innerHTML = `
 <main class="game-shell tavern-shell" data-mode="base">
  <header class="tavern-top">
    <time id="game-clock"></time> | <span id="game-title"></span>
  </header>
  <section class="stage">
   <div class="scenery" aria-hidden="true">
     ${artRegion("base", "backdrop base-art")}
     ${artRegion("cellar", "backdrop bonus-art")}
     ${artRegion("barrel", "barrel base-art")}
     ${artRegion("cellarBarrels", "backdrop bonus-art")}
   </div>
   <div class="tavern-foreground" id="scene-table" aria-hidden="true">
     ${artRegion("baseTable", "table base-art")}
     ${artRegion("cellarTable", "table bonus-art")}
   </div>
   <div class="mascot" id="mascot" aria-hidden="true"><img src="${asset("td_card_character.webp")}" alt=""></div>
   <h1 class="tavern-logo"><img src="${asset("td_loader.webp")}" alt="Tavern Drop"></h1>
   <div class="machine"><div class="reel-frame">${artRegion("reel", "frame-art")}
     <div class="reel-host" id="board"><div class="reel-keys" id="reel-keys" aria-hidden="true" hidden></div></div>
     <div class="board-loading" id="loading">Loading Tavern Drop…</div>
   </div><div class="chest-row" id="chests" hidden></div></div>
  </section>
  <section class="tavern-hud" aria-label="Game controls">
   <button id="buy" class="feature-button" aria-label="Feature buy">${hudIcon("feature-buy")}</button>
   <div class="hud-bar">
    ${gameMenuEnabled ? `<button id="menu" class="hud-menu" aria-label="Open menu" popovertarget="hud-menu-panel">${hudIcon("menu")}</button>` : ""}
    <div class="hud-money hud-balance"><span>Balance</span><strong id="balance">—</strong></div>
    <div class="hud-money win-value" id="win-value" hidden><span id="spin-win-label">Win</span><strong id="spin-win-amount">0.00</strong></div>
    <div class="hud-money" id="feature-total" hidden><span>Total win</span><strong id="feature-total-amount">0.00</strong></div>
    <div id="free-spins" hidden><span>Free spins</span> <strong id="feature-progress">0</strong></div>
    <div class="hud-bet">
     <button id="bet-picker" type="button" class="hud-money hud-bet-amount" aria-label="Bet menu" aria-controls="bet-panel" aria-expanded="false" popovertarget="bet-panel" disabled><span id="bet-label">Bet</span><strong id="bet">1.00</strong><span id="bet-track" role="meter" aria-label="Bet level" aria-valuemin="0"></span></button>
     <div class="bet-arrows"><button id="bet-up" aria-label="Increase bet">${hudIcon("bet-up")}</button><button id="bet-down" aria-label="Decrease bet">${hudIcon("bet-down")}</button></div>
    </div>
    <div class="hud-spin-control">
     <button id="spin" class="spin-button" popovertarget="auto-panel" popovertargetaction="hide" disabled aria-label="Spin">${hudIcon("spin")}</button>
     <button id="auto-add" type="button" class="auto-add" aria-label="Add ${controls?.autoTopUp ?? 0} autoplay spins" hidden>+${controls?.autoTopUp ?? 0}</button>
    </div>
    <div class="hud-quick"><button id="auto" aria-label="Autoplay">${hudIcon("autoplay")}</button><button id="speed" aria-label="Turbo" aria-pressed="false">${hudIcon("turbo")}</button></div>
   </div>
   <div class="hud-aux"><button id="rules" aria-label="Rules and paytable">ⓘ</button><button id="sound" aria-label="Toggle sound" aria-pressed="false">♫</button></div>
   <div id="auto-panel" class="tavern-hud-panel"></div>
   <div id="bet-panel" class="tavern-hud-panel" popover="auto" aria-label="Bet menu"><strong>Bet menu</strong><div class="bet-picker-options"></div></div>
   ${gameMenuEnabled ? `<div id="hud-menu-panel" class="tavern-hud-panel" popover="auto" aria-label="Game menu">
     <button id="menu-rules" type="button" aria-label="Game Rules">${hudIcon("info")} Info</button>
     <button id="menu-share" type="button">${hudIcon("share")} Share</button>
     <label><span id="effects-icon">${hudIcon("effects-muted")}</span><input id="effects-volume" type="range" min="0" max="100" aria-label="Sound effects volume"></label>
     <label><span id="music-icon">${hudIcon("music-muted")}</span><input id="music-volume" type="range" min="0" max="100" aria-label="Music volume"></label>
   </div>` : ""}
  </section>
 </main>
 <dialog id="dialog" class="tavern-dialog"><div class="modal-inner"><button class="close-modal" aria-label="Close dialog">${hudIcon("close")}</button><div id="modal-content"></div></div></dialog>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  $("game-title").textContent = game.title;
  const clock = $<HTMLTimeElement>("game-clock");
  const formatClock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
  function updateClock() {
    if (!clock.isConnected) return;
    const now = new Date();
    clock.dateTime = now.toISOString();
    clock.textContent = formatClock.format(now);
    setTimeout(updateClock, 60_000 - now.getTime() % 60_000);
  }
  updateClock();
  const scene = game.presentation.scene;
  const stage = root.querySelector<HTMLElement>(".stage")!;
  if (scene) applySceneLayers(stage, scene.layers);
  const audioReady = loadTavernAudio(resources);
  const showLoadingError = () => {
    const boardLoading = $("loading");
    if (boardLoading) boardLoading.textContent = "Reload to retry";
    loader?.fail();
  };
  let symbols;
  try {
    symbols = await loadTavernSymbols(resources);
  } catch {
    showLoadingError();
    return;
  }
  const audio = await audioReady;
  runtime.lifetime.add(() => audio.dispose());
  loader?.update(80, 100);
  let music = "";
  function syncMusic(bonus: boolean) {
    const cue = bonus ? "musicBonus" : "musicBase";
    if (audio.muted || music === cue) return;
    if (music) audio.stop(music);
    music = cue;
    audio.cue(music, true, "music");
  }
  const {
    controller,
    board: view,
    nextSpinDelay,
    waitBeforeFeatureResult,
    prepareFeatureEntry,
    waitAfterReels,
    mount,
  } = createSlotSession(game, transport, symbols, localStorage);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let overlayMascot: Awaited<ReturnType<typeof mountMascot>> | undefined;
  let overlayMount: Promise<void> | undefined;
  let mascotAnchor: SceneAnchor | undefined;
  let overlayVisible = false;
  function prepareOverlayMascot() {
    return overlayMount ??= mountMascot($("mascot"), resources).then((mounted) => {
      overlayMascot = mounted;
      if (mascotAnchor) mounted.place(mascotAnchor);
      mounted.setActive(overlayVisible);
    }).catch((error) => console.warn("Tavern mascot unavailable", error));
  }
  function placeOverlayMascot(anchor?: SceneAnchor | null) {
    const visible = anchor !== null;
    if (anchor) mascotAnchor = anchor;
    if (overlayMascot) {
      if (visible && mascotAnchor) overlayMascot.place(mascotAnchor);
      if (visible !== overlayVisible) overlayMascot.setActive(visible);
    }
    overlayVisible = visible;
    if (visible) void prepareOverlayMascot();
  }
  const reelMotion: ReelMotion = game.presentation.spinType;
  let betIndex = game.bets.indexOf(game.defaultBet),
    chance: Chance = "standard",
    turbo = false,
    autoRemaining = 0,
    autoRunning = false,
    skipped = false,
    autoTimer: ReturnType<typeof setTimeout> | null = null;
  let displayWin = 0;
  let countingFeatureBase: number | undefined;
  let lastShareableWin: { amount: number; bet: number } | undefined;
  let payline: ReturnType<typeof createTavernPayline>;
  let effects: Awaited<ReturnType<typeof mountTavernEffects>> | undefined;
  function celebrate(playbackRate?: number) {
    if (overlayVisible) overlayMascot?.win(playbackRate);
    effects?.celebrateMascot(playbackRate);
  }
  const effectsReady = reducedMotion ? Promise.resolve(undefined) : mountTavernEffects(
    stage,
    root.querySelector<HTMLElement>(".frame-art")!,
    $("board"),
    $("scene-table"),
    scene,
    placeOverlayMascot,
    resources,
    view.app,
  ).catch((error) => {
    console.warn("Tavern scene animations unavailable", error);
    return undefined;
  });
  const paylineAssets = Promise.allSettled([
    reducedMotion ? Promise.resolve() : loadReelhouse(resources),
    loadTavernBitmapFonts(resources),
  ]);
  let presentingFeature: FeatureState | null = null;
  let presentingBet = game.bets[betIndex];
  const dialog = $<HTMLDialogElement>("dialog");
  const closeModal = dialog.querySelector<HTMLButtonElement>(".close-modal")!;
  let onModalBack: (() => void) | undefined;
  const autoPicker = mountRoundPicker(
    $("auto-panel"), $<HTMLButtonElement>("auto"), controls?.autoRounds ?? [10, 25, 50],
    (round) => {
      if (autoRunning || controller.phase !== "ready" || controller.state?.feature) return;
      autoRemaining = round;
      sync();
    },
    controls?.autoUnlimited,
  );
  $("auto-panel").addEventListener("toggle", () => sync());
  const featureIcon = hudIcon("feature-buy");
  const keyArt = artRegion("key", "key-art");
  const betPicker = mountBetPicker(
    $("bet-panel"), $<HTMLButtonElement>("bet-picker"), game.bets,
    (bet) => money(bet * game.demo.chancePrices[chance]),
    (index) => setBet(index),
    controls?.betMenuCloseDelayMs,
  );
  function setBet(index: number) {
    if (controller.phase !== "ready" || controller.state?.feature) return;
    audio.cue("bet");
    betIndex = index;
    sync();
  }
  function chestMarkup(chest: Chest, reel: number, reveal = false) {
    const multiplier = reveal && chest.unlocked ? chest.multiplier : null;
    return `<div class="chest ${chest.unlocked ? "unlocked" : ""} ${multiplier ? "revealed" : ""}" style="--reel:${reel}" aria-label="Reel ${reel + 1}, ${chest.rows.length} of ${game.rows} keys">
      ${artRegion(multiplier ? "chestOpen" : "chestLid", "tavern-chest-lid")}
      ${artRegion("chestFront", "tavern-chest-front")}
      ${multiplier ? artRegion("chestCoins", "chest-coins") + `<span class="chest-multiplier">×${multiplier}</span>` : ""}
    </div>`;
  }
  function syncBonusArt(feature?: FeatureState | null) {
    const chests = $("chests");
    const keys = $("reel-keys");
    chests.hidden = keys.hidden = !feature;
    if (!feature) {
      chests.replaceChildren();
      keys.replaceChildren();
      return;
    }
    if (!keys.children.length) {
      chests.innerHTML = feature.chests
        .map((chest, reel) => chestMarkup(chest, reel))
        .join("");
      keys.innerHTML = Array.from(
        { length: game.rows * game.reels },
        (_, index) =>
          `<div class="key-cell" style="--row:${Math.floor(index / game.reels)};--reel:${index % game.reels}">${keyArt}</div>`,
      ).join("");
    }
    for (const [index, cell] of Array.from(keys.children).entries()) {
      const collected = feature.chests[index % game.reels].rows.includes(
        Math.floor(index / game.reels),
      );
      cell.classList.toggle("collected", collected);
    }
    for (const [reel, chest] of Array.from(chests.children).entries()) {
      const { unlocked, rows } = feature.chests[reel];
      chest.classList.toggle("unlocked", unlocked);
      chest.setAttribute(
        "aria-label",
        `Reel ${reel + 1}, ${rows.length} of ${game.rows} keys`,
      );
    }
  }
  function syncWin(feature?: FeatureState | null) {
    $("win-value").hidden = displayWin === 0;
    $("spin-win-amount").textContent = money(displayWin);
    $("feature-total").hidden = !feature;
    if (feature) {
      const total = countingFeatureBase === undefined
        ? feature.accumulated
        : countingFeatureBase + displayWin;
      $("feature-total-amount").textContent = money(total);
    }
  }
  function sync() {
    const state = controller.state,
      feature =
        controller.phase === "presenting" ? presentingFeature : state?.feature,
      busy = controller.phase !== "ready";
    const nextFreeSpin = !busy && !!feature?.remaining;
    $("balance").textContent = state ? money(state.balance) : "—";
    const bet = game.bets[betIndex];
    updateBetTrack($("bet-track"), betIndex, game.bets.length);
    $("bet-label").textContent =
      feature || chance === "standard" ? "Bet" : chance + " chance";
    const shownBet = money(
      feature
        ? (state?.round?.bet ?? presentingBet)
        : bet * game.demo.chancePrices[chance],
    );
    $("bet").textContent = shownBet;
    $("bet-picker").setAttribute("aria-label", `Bet menu, current bet ${shownBet}`);
    const mode = feature?.mode || "base";
    const shell = stage.parentElement!;
    shell.dataset.mode = mode;
    $("free-spins").hidden = !feature;
    const startingFreeSpin = controller.phase === "pending" &&
      controller.pending?.action === "spin" &&
      controller.pending.expectedVersion === state?.version;
    $("feature-progress").textContent = String(Math.max(0, (feature?.remaining ?? 0) - Number(startingFreeSpin)));
    if (effects) effects.sync(feature ?? null);
    else syncBonusArt(feature);
    $("buy").innerHTML =
      chance === "standard" || feature ? featureIcon : "Disable";
    $("buy").setAttribute(
      "aria-label",
      chance === "standard" || feature ? "Feature buy" : "Disable chance",
    );
    syncWin(feature);
    $<HTMLButtonElement>("auto").disabled = !!feature || autoRunning || busy;
    const betLocked = busy || !!feature;
    betPicker.sync(betIndex, betLocked);
    $<HTMLButtonElement>("buy").disabled = betLocked;
    $<HTMLButtonElement>("bet-down").disabled = betLocked || betIndex === 0;
    $<HTMLButtonElement>("bet-up").disabled = betLocked || betIndex === game.bets.length - 1;
    $<HTMLButtonElement>("spin").disabled =
      nextFreeSpin ||
      (busy && view.isMoving && !view.allowForceStop && !autoRunning) ||
      controller.phase === "loading" ||
      controller.phase === "recovery";
    $("spin").classList.toggle(
      "spinning",
      busy && controller.phase !== "recovery",
    );
    const blockedStop = busy && view.isMoving && !view.allowForceStop;
    const skip = !blockedStop && ((busy && shell.dataset.totalWin !== "returning") || nextFreeSpin);
    const spin = $("spin");
    const unlimited = autoRemaining === Infinity;
    spin.innerHTML = autoRunning
      ? `<span class="auto-count">${unlimited ? "∞" : autoRemaining}</span>`
      : skip ? hudIcon("spin") : hudIcon("spin") + hudIcon("autoplay-ready");
    spin.setAttribute("aria-label", autoRunning
      ? (unlimited ? "Stop unlimited autoplay" : `Stop autoplay, ${autoRemaining} spins left`)
      : blockedStop ? "Spinning" : skip ? "Skip" : autoPicker.isOpen() && autoRemaining > 0 ? "Start autoplay" : "Spin");
    $("auto-add").hidden = !autoRunning || unlimited || !controls?.autoTopUp;
    autoPicker.setSelected(autoRunning ? 0 : autoRemaining);
    $("speed").setAttribute("aria-pressed", String(turbo));
    $("sound").setAttribute("aria-pressed", String(!audio.muted));
  }
  function modal(content: string, dismissible = true, look = "", onBack?: () => void) {
    delete dialog.dataset.returning;
    dialog.dataset.look = look;
    $("modal-content").innerHTML = content;
    closeModal.hidden = !dismissible;
    onModalBack = onBack;
    if (!dialog.open) dialog.showModal();
  }
  closeModal.onclick = () => {
    if (onModalBack) onModalBack();
    else dialog.close();
  };
  dialog.addEventListener("cancel", (event) => {
    if (closeModal.hidden || onModalBack) {
      event.preventDefault();
      onModalBack?.();
    }
  });
  dialog.addEventListener("close", () => scheduleNextSpin());
  const winTier = (amount: number, bet: number) =>
    game.demo.winTiers.filter((tier) => amount >= bet * tier.multiplier).at(-1);
  const winAnimation = (label: string) =>
    label === "NICE WIN" ? "smallwin" : label.toLowerCase().replace(/\s/g, "");
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  async function showWinCelebration(label: string, text: string, clip: string, count?: { from: number; to: number }) {
    audio.cue(clip);
    const overlay = document.createElement("div");
    overlay.className = "win-celebration";
    if (clip === "addfs") overlay.classList.add("retrigger-celebration");
    overlay.setAttribute("role", "status");
    const title = document.createElement("strong");
    title.textContent = label;
    const value = document.createElement("span");
    value.className = "win-celebration-value";
    renderAmount(value, count ? money(count.from) : text, "td_gold");
    const art = document.createElement("div");
    art.className = "tavern-screen-art";
    overlay.append(title, art, value);
    root.append(overlay);
    const update = (amount: number) => {
      const formatted = money(amount);
      renderAmount(value, formatted, "td_gold");
      effects?.setScreenAmount(formatted);
    };
    const counting = count ? countPayout(count.from, count.to, 1800, update) : Promise.resolve();
    if (effects) {
      await Promise.all([
        effects.showScreen(art, clip, { amount: clip === "addfs" ? undefined : count ? money(count.from) : text }),
        counting,
      ]);
      if (count) await delay(800);
      await effects.endScreen();
    } else {
      await Promise.all([delay(900), counting]);
      if (count) await delay(800);
    }
    overlay.remove();
  }
  async function showWinSequence(amount: number, bet: number, capped = false) {
    const tiers = game.demo.winTiers.filter((tier) => amount >= bet * tier.multiplier);
    const large = tiers.filter((tier) => tier.multiplier >= 20);
    const selected = large.length ? large : tiers.slice(-1);
    const stages = selected.map((tier) => ({
      label: tier.label, clip: winAnimation(tier.label), threshold: bet * tier.multiplier,
    }));
    if (capped) stages.push({ label: "MAX WIN", clip: "maxwin", threshold: amount });
    if (!stages.length) return;

    const overlay = document.createElement("div");
    overlay.className = "win-celebration";
    overlay.setAttribute("role", "status");
    const title = document.createElement("strong");
    title.textContent = stages[0].label;
    const art = document.createElement("div");
    art.className = "tavern-screen-art";
    const value = document.createElement("span");
    value.className = "win-celebration-value";
    renderAmount(value, money(0), "td_gold");
    overlay.append(title, art, value);
    root.append(overlay);
    // Higher Spine clips already include the lower win tiers. Play the final
    // clip once and follow its authored transition times with one counter.
    const finalClip = stages[stages.length - 1].clip;
    const timing = effects?.winScreenTiming(finalClip) ?? { duration: 1.5, times: {} };
    const slotNames: Record<string, string> = {
      bigwin: "big_win_text", superwin: "super_win_text", megawin: "mega_win_text",
      epicwin: "epic_win_text", maxwin: "max_win_text",
    };
    const marks = stages.map((stage, index) => ({
      ...stage,
      time: timing.times[slotNames[stage.clip]] ?? (index * timing.duration / stages.length),
    }));
    const start = performance.now();
    const screen = effects?.showScreen(art, finalClip, { amount: money(0) }) ?? delay(timing.duration * 1000);
    let active = -1;
    const counting = new Promise<void>((resolve) => {
      const tick = () => {
        const time = Math.min(timing.duration, effects ? effects.screenTime() : (performance.now() - start) / 1000);
        let index = 0;
        while (index + 1 < marks.length && time >= marks[index + 1].time) index++;
        const stage = marks[index];
        if (index !== active) {
          active = index;
          if (title.textContent !== stage.label) title.textContent = stage.label;
          audio.cue(stage.clip);
        }
        const next = marks[index + 1];
        const from = index ? Math.min(amount, stage.threshold) : 0;
        const to = next ? Math.min(amount, next.threshold) : amount;
        const end = next?.time ?? timing.duration;
        const progress = Math.max(0, Math.min(1, (time - stage.time) / (end - stage.time || 1)));
        const formatted = money(Math.round(from + (to - from) * progress));
        renderAmount(value, formatted, "td_gold");
        effects?.setScreenAmount(formatted);
        if (time < timing.duration) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    await Promise.all([screen, counting]);
    await delay(800);
    await effects?.endScreen();
    overlay.remove();
  }
  function clearSpinTimer() {
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = null;
  }
  function stopAuto() {
    autoPicker.close();
    autoRemaining = 0;
    autoRunning = false;
    clearSpinTimer();
    sync();
  }
  function scheduleNextSpin(noWinReelsStoppedAt?: number) {
    const feature = controller.state?.feature;
    if (
      autoTimer !== null ||
      dialog.open ||
      controller.phase !== "ready" ||
      !(feature?.remaining || autoRunning)
    )
      return;
    const delay = noWinReelsStoppedAt === undefined
      ? nextSpinDelay(turbo ? 357 : feature?.played === 0 ? 1400 : 900)
      : Math.max(0, 500 - (performance.now() - noWinReelsStoppedAt));
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (!dialog.open && controller.phase === "ready") void run("spin");
    }, delay);
  }
  async function present(outcome: Outcome, spinTurbo: boolean) {
    presentingBet = outcome.bet;
    presentingFeature = outcome.entry
      ? null
      : (outcome.finalFeature ?? outcome.state.feature);
    const checkpoint = outcome.checkpoint;
    const isSpinStep = !checkpoint || ["base", "intro", "freespin"].includes(checkpoint.curStep);
    let noWinReelsStoppedAt: number | undefined;
    const tier = winTier(outcome.spinWin, outcome.bet);
    if (isSpinStep) {
      const resumeIntro = checkpoint?.resumed && checkpoint.curStep === "intro";
      if (resumeIntro) {
        // Re-present the recorded trigger without spinning or releasing another server step.
        view.setBoard(outcome.state.board);
        sync();
        const scatter = outcome.state.board.flatMap((column, reel) =>
          column.flatMap((id, row) => id === "bonus" ? [{ reel, row }] : []),
        );
        if (scatter.length) {
          await view.focusWins(scatter);
          celebrate();
        }
        view.clearHighlight();
      } else {
        let scatterLanded = 0;
        if (checkpoint?.staticResult) view.setBoard(outcome.state.board);
        else await view.stop(outcome.state.board, effects?.playSceneEffects, {
          reel: (reel) => audio.cue(`reel${reel}`),
          symbol: (id) => {
            if (id === game.presentation.drop.anticipation?.symbolId)
              audio.cue(`scatter${Math.min(scatterLanded++, 3)}`);
          },
          anticipation: (active) => active ? audio.cue("anticipation", true) : audio.stop("anticipation"),
        });
        const plainNoWin = outcome.spinWin === 0 && outcome.wins.length === 0 &&
          !outcome.entry && !outcome.retrigger && !outcome.completion && !outcome.capped;
        noWinReelsStoppedAt = plainNoWin ? performance.now() : undefined;
        if (!plainNoWin) await waitAfterReels(spinTurbo);
        const scatter =
          outcome.entry || outcome.retrigger
            ? outcome.state.board.flatMap((column, reel) =>
                column.flatMap((id, row) =>
                  id === "bonus" ? [{ reel, row }] : [],
                ),
              )
            : (outcome.scatterPositions ?? []);
        displayWin = 0;
        countingFeatureBase = presentingFeature
          ? Math.max(0, presentingFeature.accumulated - outcome.spinWin)
          : undefined;
        sync();
        if (outcome.wins.length) audio.cue("win");
        const animateWins = async () => {
          const lineDuration = turbo
            ? 304
            : Math.max(250, Math.min(670, 2500 / Math.max(1, outcome.wins.length)));
          for (const win of outcome.wins) {
            if (skipped) break;
            view.focusWins(win.positions);
            await payline.play(
              win,
              game.lines[win.line],
              money(win.amount),
              win.amount >= outcome.bet * 20,
              lineDuration,
              () => skipped,
            );
          }
          if (scatter.length && (outcome.entry || !skipped)) {
            await view.waitForLandings(scatter);
            await view.focusWins(scatter);
            celebrate();
          }
          view.clearHighlight();
        };
        const from = performance.now();
        const countWin = plainNoWin ? undefined : new Promise<void>((resolve) => {
          const tick = () => {
            const t = skipped
              ? 1
              : Math.min(1, (performance.now() - from) / (turbo ? 179 : 650));
            displayWin = Math.round(outcome.spinWin * (1 - (1 - t) ** 3));
            syncWin(presentingFeature);
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          tick();
        });
        await Promise.all([animateWins(), countWin]);
        countingFeatureBase = undefined;
        syncWin(presentingFeature);
        if (outcome.retrigger) {
          audio.cue("retrigger");
          effects?.shake();
          await showWinCelebration("Retrigger", `+${outcome.retrigger} Free Spins`, "addfs");
        }
      }
      if (outcome.entry) {
        stopAuto();
        audio.cue("entry");
        prepareFeatureEntry();
        await effects?.prepareBonusIntro();
        stage.dataset.bonusIntro = "true";
        modal(
          `<div class="tavern-screen-art bonus-intro-art"></div>
          <h2>${outcome.entry.toUpperCase()} BONUS</h2>
          <img class="bonus-preview" src="${asset(outcome.entry === "drop" ? "td_super.webp" : "td_bonus.webp")}" alt="">
          <strong class="free-spin-title">${outcome.state.feature!.remaining} Free Spins</strong>
          <p class="bonus-instructions">Win every position on a reel to unlock its chest multiplier.</p>
          <button id="continue" class="scene-continue">Press to continue</button>`,
          false,
          "bonus",
        );
        const bonusClip = outcome.entry === "drop" ? "super" : "bonus";
        const introArt = dialog.querySelector<HTMLElement>(".tavern-screen-art")!;
        if (effects) void effects.showScreen(introArt, bonusClip + "_intro", {
          count: outcome.state.feature!.remaining,
          outro: bonusClip + "_outro",
        });
        await waitForContinue(dialog, $<HTMLButtonElement>("continue"));
        await effects?.endScreen(bonusClip + "_outro");
        dialog.close();
        displayWin = 0;
        presentingFeature = outcome.state.feature;
        // The Spine key grid and the reel canvas must measure the same bonus layout.
        stage.parentElement!.dataset.mode = outcome.entry;
        const bonusEntry = effects?.enterBonus();
        sync();
        delete stage.dataset.bonusIntro;
        audio.cue("entryEnd");
        syncMusic(true);
        await bonusEntry;
      }
    } else if (checkpoint?.curStep === "show-chest" || checkpoint?.curStep === "open-chest") {
      presentingFeature = outcome.state.feature;
      sync();
      view.hideSymbols();
      if (checkpoint.curStep === "show-chest") {
        await waitBeforeFeatureResult();
        if (music) audio.stop(music);
        music = "";
        audio.cue("chestIntro");
        await effects?.revealChests(money(checkpoint.displayWinMinor));
        await delay(2000);
      } else {
        const reel = checkpoint.reel!;
        // A reload may enter directly at an unfinished chest, without replaying prior ones.
        if (!stage.dataset.chestReveal) {
          await effects?.revealChests(money(checkpoint.beforeWinMinor));
          for (const [index, chest] of (presentingFeature?.chests ?? []).entries())
            if (index !== reel && chest.multiplier != null) effects?.restoreChest(index, chest.multiplier);
        }
        audio.cue(`chest${Math.min(reel, 3)}`);
        if (effects) await effects.openChest(reel, checkpoint.multiplier!);
        else $("chests").children[reel].outerHTML = chestMarkup(presentingFeature!.chests[reel], reel, true);
        const finishing = effects?.finishChest(reel);
        await countPayout(checkpoint.beforeWinMinor, checkpoint.displayWinMinor, 420, (value) => effects?.setChestAmount(money(value)));
        await finishing;
      }
    }
    if (outcome.completion) {
      stopAuto();
      if (!checkpoint || !outcome.state.feature?.chests.some((chest) => chest.unlocked))
        await waitBeforeFeatureResult();
      const c = outcome.completion;
      const chests = outcome.finalFeature?.chests ?? [];
      const unlocked = chests.map((chest, reel) => ({ chest, reel }))
        .filter(({ chest }) => chest.unlocked && chest.multiplier != null);
      if (unlocked.length) {
        if (music) audio.stop(music);
        music = "";
        audio.cue("chestIntro");
        const fallback = effects ? undefined : document.createElement("strong");
        if (fallback) {
          fallback.className = "chest-result-fallback";
          fallback.setAttribute("aria-live", "polite");
          stage.append(fallback);
        }
        const setAmount = (value: number) => {
          const formatted = money(value);
          effects?.setChestAmount(formatted);
          if (fallback) renderAmount(fallback, formatted, "td_gold");
          stage.dataset.chestAmount = formatted;
        };
        setAmount(c.accumulated);
        view.hideSymbols();
        await effects?.revealChests(money(c.accumulated));
        if (!effects) stage.dataset.chestReveal = "true";
        await delay(2000);
        for (const [index, { chest, reel }] of unlocked.entries()) {
          audio.cue(`chest${Math.min(index, 3)}`);
          if (effects) await effects.openChest(reel, chest.multiplier!);
          else $("chests").children[reel].outerHTML = chestMarkup(chest, reel, true);
        }
        celebrate();
        let runningAmount = c.accumulated;
        for (const [index, { chest, reel }] of unlocked.entries()) {
          const nextAmount = Math.min(runningAmount * chest.multiplier!, c.featureAward);
          audio.cue(`multiplier${index}`);
          const animation = effects?.finishChest(reel);
          if (effects) await delay(650);
          if (runningAmount !== nextAmount) audio.cue("count");
          await countPayout(runningAmount, nextAmount, 420, setAmount);
          audio.stop("count");
          if (runningAmount !== nextAmount) audio.cue("countEnd");
          await animation;
          runningAmount = nextAmount;
        }
        setAmount(c.featureAward);
        await delay(800);
        fallback?.remove();
        delete stage.dataset.chestReveal;
        delete stage.dataset.chestAmount;
        delete stage.dataset.chestOpening;
        delete stage.dataset.chestOpened;
      }
      if (c.featureAward >= outcome.bet * 20 || c.capped)
        await showWinSequence(c.featureAward, outcome.bet, c.capped);
      await effects?.prepareTotalWin();
      view.hideSymbols();
      $("chests").hidden = true;
      const shell = stage.parentElement!;
      shell.dataset.totalWin = "shown";
      modal(
        `<div class="tavern-screen-art total-win-screen"></div>
        <h2>${artRegion("totalWin", "total-win-art")}<span class="visually-hidden">Total Win</span></h2>
        <strong class="result-total bonus-paid" aria-live="polite">${money(c.featureAward)}</strong>
        <button id="continue" class="scene-continue">Press to continue</button>`,
        false,
        "total-win",
      );
      const amount = money(c.featureAward);
      renderAmount(dialog.querySelector<HTMLElement>(".result-total")!, amount, "td_gold");
      audio.cue("totalIntro");
      const resultArt = dialog.querySelector<HTMLElement>(".tavern-screen-art")!;
      const enter = effects?.showScreen(resultArt, "total_win_start", {
        amount, idle: "total_win_idle", outro: "total_win_end",
      });
      await waitForContinue(dialog, $<HTMLButtonElement>("continue"), enter);
      audio.cue("totalOutro");
      const liveReturn = effects?.hasLiveTotalWin();
      const leaving = effects?.endScreen("total_win_end");
      if (liveReturn) {
        dialog.dataset.returning = "true";
        await effects?.waitForTotalWinReturn(leaving!);
      } else {
        await leaving;
        dialog.close();
      }
      if (checkpoint) {
        const before = controller.state!.balance;
        await controller.completePresentation();
        outcome.state.balance = controller.state!.balance;
        outcome.paidAward = Math.max(0, outcome.state.balance - before);
      }
      presentingFeature = null;
      displayWin = liveReturn ? 0 : c.roundAward;
      // The base and bonus machine have different top offsets. Apply the base layout
      // before the Spine frame is positioned so the frame and symbols enter together.
      shell.dataset.mode = "base";
      shell.dataset.totalWin = "returning";
      const entering = effects?.returnFromTotalWin();
      view.setBoard(outcome.state.board);
      sync();
      if (liveReturn) {
        const balance = outcome.state.balance;
        const beforeAward = balance - outcome.paidAward;
        $("balance").textContent = money(beforeAward);
        await delay(500);
        await Promise.all([
          leaving,
          entering,
          countPayout(beforeAward, balance, 520, (value) => {
            $("balance").textContent = money(value);
          }),
          countPayout(0, c.roundAward, 520, (value) => {
            displayWin = value;
            syncWin();
          }),
        ]);
        dialog.close();
        delete dialog.dataset.returning;
      } else await entering;
      delete shell.dataset.totalWin;
    } else if (outcome.capped) {
      stopAuto();
      await showWinSequence(outcome.paidAward, outcome.bet, true);
    } else if (tier && !outcome.entry) {
      await showWinSequence(outcome.spinWin, outcome.bet);
    }
    if (outcome.paidAward > 0 && !outcome.state.feature)
      lastShareableWin = { amount: outcome.completion?.roundAward ?? outcome.paidAward, bet: outcome.bet };
    await controller.completePresentation();
    const next = controller.nextPresentation();
    if (next) { await present(next, spinTurbo); return; }
    if (autoRunning && autoRemaining !== Infinity) {
      autoRemaining--;
      autoRunning = autoRemaining > 0;
    }
    sync();
    syncMusic(!!controller.state?.feature);
    scheduleNextSpin(noWinReelsStoppedAt);
  }
  async function run(
    action: "spin" | "buy-tavern" | "buy-drop",
    recover = false,
    startupResume = false,
  ) {
    if (!recover && controller.phase !== "ready") {
      if (view.isMoving && !view.allowForceStop) return;
      skipped = true;
      view.skip();
      effects?.skip();
      return;
    }
    clearSpinTimer();
    displayWin = 0;
    syncWin(controller.state?.feature);
    const spinTurbo = turbo;
    audio.unlock();
    skipped = false;
    if (!recover) {
      view.start(turbo, reelMotion);
      effects?.spin();
      audio.cue("start");
    }
    const work = recover
      ? controller.recover(!startupResume)
      : controller.execute({
          action,
          bet: controller.state?.round?.bet || game.bets[betIndex],
          chance: controller.state?.feature ? "standard" : chance,
        });
    if (!startupResume) sync();
    try {
      const outcome = await work;
      if (startupResume) {
        const shell = stage.parentElement!;
        delete shell.dataset.opening;
        shell.querySelector(".opening-continue")?.remove();
        view.app.start();
        if (!outcome.entry && outcome.state.feature) {
          presentingFeature = outcome.state.feature;
          effects?.restoreFeature(outcome.state.feature);
        } else if (!outcome.entry) view.hideSymbols();
        shell.querySelector<HTMLElement>(".tavern-hud")!.inert = false;
      }
      await present(outcome, spinTurbo);
    } catch (error) {
      stopAuto();
      if (controller.state) {
        view.setBoard(controller.state.board);
        if (controller.state.feature?.played === 0) prepareFeatureEntry();
      }
      const pending = controller.phase === "recovery";
      modal(
        `<span class="eyebrow">${pending ? "PENDING ROUND" : "REQUEST DECLINED"}</span><h2>${pending ? "Recover your result" : "Please try again"}</h2><p>${pending ? "Retry retrieves the same request without placing another bet." : error instanceof Error ? error.message : "Server unavailable"}</p><button id="retry" class="primary">${pending ? "RECOVER RESULT" : "CONTINUE"}</button>`,
        false,
      );
      $("retry").onclick = () => {
        dialog.close();
        if (pending) void run("spin", true, startupResume);
      };
      sync();
    }
  }
  $("spin").onclick = () => {
    if (autoRunning) {
      stopAuto();
      return;
    }
    if (autoPicker.isOpen() && controller.phase === "ready" && !controller.state?.feature && autoRemaining > 0)
      autoRunning = true;
    autoPicker.close();
    void run("spin");
  };
  $("auto-add").onclick = () => {
    if (!autoRunning || autoRemaining === Infinity || !controls?.autoTopUp) return;
    audio.cue("click");
    autoRemaining += controls.autoTopUp;
    sync();
  };
  $("bet-down").onclick = () => setBet(Math.max(0, betIndex - 1));
  $("bet-up").onclick = () => setBet(Math.min(game.bets.length - 1, betIndex + 1));
  $("speed").onclick = () => {
    turbo = !turbo;
    sync();
  };
  $("sound").onclick = () => {
    audio.unlock();
    audio.muted = !audio.muted;
    if (audio.muted) music = "";
    else syncMusic(!!controller.state?.feature);
    sync();
  };
  $("auto").onclick = () => {
    audio.cue("click");
    if (controls?.autoUnlimited && !autoRemaining) {
      autoRemaining = Infinity;
      sync();
    }
  };
  const shopOptions = [
    {
      kind: "chance",
      id: "extra",
      title: "Extra Chance",
      image: "td_ante.webp",
      bolts: 3,
    },
    {
      kind: "chance",
      id: "super",
      title: "Super Chance",
      image: "td_superante.webp",
      bolts: 5,
    },
    {
      kind: "buy",
      id: "tavern",
      title: "Tavern Bonus",
      image: "td_bonus.webp",
      bolts: 4,
    },
    {
      kind: "buy",
      id: "drop",
      title: "Drop Bonus",
      image: "td_super.webp",
      bolts: 5,
    },
  ] as const;
  type ShopOption = (typeof shopOptions)[number];
  const shopPrice = (option: ShopOption) =>
    game.bets[betIndex] *
    (option.kind === "chance"
      ? game.demo.chancePrices[option.id]
      : game.demo.buyPrices[option.id]);
  const shopArt = (option: ShopOption) =>
    `<img src="${asset(option.image)}" alt="">
     <span class="shop-bolts" aria-hidden="true">${hudIcon("turbo").repeat(option.bolts)}<i>${hudIcon("turbo").repeat(5 - option.bolts)}</i></span>`;
  function openShop() {
    modal(
      `<h2 class="visually-hidden">Feature buy</h2>
      <div class="shop-grid">${shopOptions
        .map(
          (option) => `
        <div class="shop-tile">
          <button data-${option.kind}="${option.id}" class="shop-card ${option.kind}">
            ${shopArt(option)}
            <strong>${option.title}</strong>
            <b>${money(shopPrice(option))}</b>
            <span class="shop-action">${option.kind === "chance" ? "Activate" : "Buy"}</span>
          </button>
        </div>`,
        )
        .join("")}</div>
      <div class="shop-controls">
        <div class="hud-money shop-balance"><span>Balance</span><strong>${money(controller.state!.balance)}</strong></div>
        <div class="shop-bet">
        <button id="shop-bet-down" aria-label="Decrease feature bet" ${betIndex === 0 ? "disabled" : ""}>${hudIcon("bet-down")}</button>
        <div class="hud-money"><span>Bet</span><strong>${money(game.bets[betIndex])}</strong></div>
        <button id="shop-bet-up" aria-label="Increase feature bet" ${betIndex === game.bets.length - 1 ? "disabled" : ""}>${hudIcon("bet-up")}</button>
        </div>
      </div>`,
      true,
      "shop",
    );
    $("shop-bet-down").onclick = () => {
      updateShopBet(betIndex - 1, "shop-bet-down");
    };
    $("shop-bet-up").onclick = () => {
      updateShopBet(betIndex + 1, "shop-bet-up");
    };
    for (const option of shopOptions) {
      dialog.querySelector<HTMLButtonElement>(
        `[data-${option.kind}="${option.id}"]`,
      )!.onclick = () => confirmFeature(option);
    }
  }
  function updateShopBet(index: number, control: string) {
    const scrollTop = dialog.querySelector<HTMLElement>(".shop-grid")!.scrollTop;
    setBet(index);
    openShop();
    dialog.querySelector<HTMLElement>(".shop-grid")!.scrollTop = scrollTop;
    $(control).focus({ preventScroll: true });
  }
  function confirmFeature(option: ShopOption) {
    const scrollTop = dialog.querySelector<HTMLElement>(".shop-grid")!.scrollTop;
    const summary =
      option.kind === "chance"
        ? "Increase the chance of triggering a bonus on each spin."
        : `Enter a bonus game with ${game.demo.featureSpins[option.id]} free spins. Win positions in the reel to unlock chest multipliers.`;
    const multiplier = option.id === "drop"
      ? ` The minimum multiplier is ${Math.min(...game.demo.chestMultipliers.drop)}x.`
      : "";
    modal(
      `<div class="shop-card shop-confirm">
        ${shopArt(option)}<h2>${option.title}</h2><p>${summary}${multiplier}</p>
        <b>${money(shopPrice(option))}</b>
        <button id="confirm-buy" class="shop-action">Confirm</button>
      </div>`,
      true,
      "shop-confirm",
      () => {
        openShop();
        dialog.querySelector<HTMLElement>(".shop-grid")!.scrollTop = scrollTop;
        dialog.querySelector<HTMLButtonElement>(`[data-${option.kind}="${option.id}"]`)?.focus({ preventScroll: true });
      },
    );
    closeModal.focus({ preventScroll: true });
    $("confirm-buy").onclick = () => {
      dialog.close();
      if (option.kind === "chance") {
        chance = option.id;
        sync();
      } else {
        void run(option.id === "tavern" ? "buy-tavern" : "buy-drop");
      }
    };
  }
  $("buy").onclick = () => {
    if (controller.phase !== "ready" || controller.state?.feature) return;
    stopAuto();
    if (chance !== "standard") {
      chance = "standard";
      sync();
      return;
    }
    openShop();
  };
  function rules() {
    modal(
      `<span class="eyebrow">TEMPLATE RULES · PROVISIONAL MATH</span><h2>Inside the tavern</h2><p>${game.reels} reels × ${game.rows} rows. ${game.lines.length} illustrative fixed paylines. Matching symbols pay left to right; Wild substitutes for paying symbols. The best Wild substitution pays once per line.</p><p>Demo entry: 3 Bonus symbols start Tavern; 4+ start Drop. Each feature has its own presentation and configurable spin count. These entry rules are unverified.</p><p>During free spins, each distinct winning row fills one position on that reel’s chest. Repeated positions do not add progress. ${game.rows} rows unlock a chest. At completion, unlocked chest multipliers multiply together and apply to accumulated feature wins. A server-side cap limits the full paid round.</p><div class="paytable">${game.symbols
        .filter((s) => s.kind !== "bonus")
        .map(
          (s) =>
            `<div>${paytableIcon(s.id)}<b style="color:${s.color}">${s.label}</b><span>3: ${(s.pays[3] || 0) / 100}×</span><span>4: ${(s.pays[4] || 0) / 100}×</span><span>5: ${(s.pays[5] || 0) / 100}×</span></div>`,
        )
        .join(
          "",
        )}</div><p class="muted">The demo uses provisional awards, prices, probabilities and line patterns. Sessions reset when the server restarts.</p>`,
    );
  }
  $("rules").onclick = rules;
  if (gameMenuEnabled) {
    const menu = $("hud-menu-panel");
    $("menu-rules").onclick = () => { menu.hidePopover(); rules(); };
    menu.addEventListener("toggle", () => {
      const open = menu.matches(":popover-open");
      $("menu").innerHTML = hudIcon(open ? "close" : "menu");
      $("menu").setAttribute("aria-expanded", String(open));
    });
    for (const channel of ["effects", "music"] as const) {
      const slider = $<HTMLInputElement>(channel + "-volume");
      slider.value = String(Math.round(audio.level(channel) * 100));
      slider.oninput = () => {
        audio.unlock();
        audio.muted = false;
        audio.setLevel(channel, Number(slider.value) / 100);
        for (const name of ["effects", "music"] as const)
          $(name + "-icon").innerHTML = hudIcon(audio.level(name) > 0 ? name : `${name}-muted`);
        syncMusic(!!controller.state?.feature);
      };
    }
    $("menu-share").onclick = () => {
      menu.hidePopover();
      const win = lastShareableWin;
      modal(`<h2>Share</h2><p class="share-game">Tavern Drop</p>
        <div class="share-card">${win
          ? `<strong>Win ${money(win.amount)}</strong><p>Bet ${money(win.bet)}</p><button id="copy-win" type="button">Copy result</button>`
          : "<strong>Nothing to share yet</strong><p>Play a round and your cards show up here.</p>"}</div>`,
        true, "share",
      );
      if (win) $("copy-win").onclick = async () => {
        const button = $("copy-win");
        try {
          await navigator.clipboard.writeText(`Tavern Drop · Win ${money(win.amount)} · Bet ${money(win.bet)}`);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Clipboard unavailable";
        }
      };
    };
  }
  window.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !dialog.open &&
      !$("spin").closest("[inert]") &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      $<HTMLButtonElement>("spin").click();
    }
  });
  try {
    await mount($("board"), {
      autoStart: false,
      // The native chest row extends below the reel mask in the foreground pass.
      bottomOverflowPx: reducedMotion ? 0 : 180,
      initialState,
    });
    const entry = resolveSessionEntry(controller.state!);
    view.app.ticker.maxFPS = 60;
    loader?.update(85, 100);
    const [reelhouse, fonts] = await paylineAssets;
    const nativePayline = !reducedMotion && reelhouse.status === "fulfilled"
      ? createReelhouse(view.app, false, resources) : undefined;
    payline = createTavernPayline(view.app.stage, game, nativePayline, fonts.status === "fulfilled");
    effects = await effectsReady;
    loader?.update(90, 100);
    $("loading").remove();
    {
      const shell = root.querySelector<HTMLElement>(".game-shell")!;
      const hud = shell.querySelector<HTMLElement>(".tavern-hud")!;
      const opening = document.createElement("button");
      opening.type = "button";
      opening.className = "opening-continue";
      opening.textContent = "Press to continue";
      opening.hidden = true;
      opening.disabled = true;
      shell.dataset.opening = "true";
      hud.inert = true;
      if (controller.state) $("balance").textContent = money(controller.state.balance);
      shell.append(opening);
      const landing = effects?.showOpening();
      await landing;
      loader?.update(95, 100);
      await loader?.ready();
      const mascotReady = (async () => {
        // Paint the interactive landing before warming an invisible extra renderer.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const openingFinished = effects?.startOpening();
        if (!effects && !reducedMotion) placeOverlayMascot();
        if (!reducedMotion && !stage.hasAttribute("data-mascot-behind-board"))
          await prepareOverlayMascot();
        await openingFinished;
      })();
      void resources.loadBundle("ui").catch((error) => console.warn("Tavern UI font unavailable", error));
      for (const { image } of shopOptions) {
        const preview = new Image();
        preview.decoding = "async";
        preview.src = asset(image);
      }
      if (entry.scene !== "base") {
        shell.dataset.entryScene = entry.scene;
        await waitForContinue(shell, opening, mascotReady);
        await mascotReady;
        opening.remove();
        delete shell.dataset.opening;
        shell.dataset.mode = entry.featureMode ?? "base";
        if (entry.scene === "feature") {
          if (controller.state!.feature) sync();
          effects?.restoreFeature(controller.state!.feature);
          if (entry.resumeStep === "intro") view.hideSymbols();
        } else {
          view.hideSymbols();
          await effects?.prepareTotalWin();
        }
        view.app.start();
        view.app.render();
        modal(
          '<h2>Resume Active Game?</h2><p>You have an active round in progress</p><button id="recover" class="primary">Resume</button>',
          false, "resume",
        );
        $("recover").onclick = () => {
          dialog.close();
          if (controller.phase === "ready" && controller.state?.feature) {
            delete shell.dataset.opening;
            opening.remove();
            effects?.restoreFeature(controller.state.feature);
            view.app.start();
            hud.inert = false;
            sync();
            scheduleNextSpin();
          } else void run("spin", true, true);
        };
        return;
      }
      const continued = waitForContinue(shell, opening, mascotReady);
      await continued;
      await mascotReady;
      // The landing hides the reels and mascot. Upload them only when entering,
      // before starting the reveal animation, so they cannot delay its first paint.
      view.app.render();
      overlayMascot?.prepare();
      opening.remove();
      shell.dataset.entryScene = "base";
      const reveal = scene?.openingReveal;
      const celebrateOpening = !controller.state?.feature && controller.phase === "ready";
      let revealed: Promise<void> | undefined;
      delete shell.dataset.opening;
      if (reveal && !reducedMotion) {
        shell.dataset.entering = "before-mascot";
        revealed = revealScene(reveal, scene.openingDimmerOpacity ?? 0, (brightness, symbolOpacity, elapsedMs) => {
          shell.style.setProperty("--opening-brightness", String(brightness));
          shell.style.setProperty("--opening-symbol-opacity", String(symbolOpacity));
          shell.style.setProperty("--opening-symbol-blur", `${(1 - symbolOpacity) * 2}px`);
          effects?.setOpeningBrightness(brightness);
          if (elapsedMs >= reveal.mascotDelayMs && shell.dataset.entering === "before-mascot") {
            shell.dataset.entering = "true";
            effects?.revealOpeningMascot();
            if (celebrateOpening) celebrate(reveal.playbackRate);
          }
        });
      }
      view.app.start();
      const entered = effects?.enterGame(reveal?.playbackRate);
      if (!revealed && celebrateOpening) celebrate();
      if (!controller.state?.feature) sync();
      await Promise.all([entered, revealed]);
      delete shell.dataset.entering;
      shell.style.removeProperty("--opening-brightness");
      shell.style.removeProperty("--opening-symbol-opacity");
      shell.style.removeProperty("--opening-symbol-blur");
      hud.inert = false;
    }
    sync();
    if (entry.resumeStep === "intro" && controller.phase === "recovery") {
      void run("spin", true, true);
    } else if (controller.phase === "recovery" || controller.state?.feature) {
      modal(
        '<h2>Resume Active Game?</h2><p>You have an active round in progress</p><button id="recover" class="primary">Resume</button>',
        false,
        "resume",
      );
      $("recover").onclick = () => {
        dialog.close();
        if (controller.phase === "recovery") void run("spin", true, entry.requiresResume);
      };
    } else {
      scheduleNextSpin();
    }
  } catch {
    showLoadingError();
  }
}
