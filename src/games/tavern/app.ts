import basePresentation from "./base-presentation.config.json";
import { bindHoldShortcut } from "../../framework/ui/hold-shortcut.ts";
import { ApiError } from "../../framework/network/json-client.ts";
import "./theme.css";
import { createSlotSession } from "../../framework/slot-core/index.ts";
import { gameRuntime } from "../../framework/app/game-runtime.ts";
import { resolveSessionEntry } from "../../framework/app/session-entry.ts";
import { createGameTransport } from "../../framework/transport/proposal.ts";
import { formatMoney } from "../../framework/ui/index.ts";
import { loadTavernSymbols, paytableIcon, staticSymbolImage } from "./skin.ts";
import { openInfoScreen } from "../../framework/ui/info-screen.ts";
import info from "./info.json" with { type: "json" };
import { createTavernPayline } from "./payline.ts";
import {
  createReelhouse,
  loadReelhouse,
  mountTavernEffects,
} from "./effects.ts";
import { loadTavernBitmapFonts, renderAmount } from "./typography.ts";
import { artRegion, hudIcon, tavernAsset as asset } from "./art.ts";
import { applySceneLayers, revealScene, revealThroughVeil, waitForContinue, type SceneAnchor } from "../../framework/presentation/scene.ts";
import type { BrandLoader } from "../../framework/presentation/brand-loading.ts";
import { mountBetPicker, mountRoundPicker, updateBetTrack } from "../../framework/ui/index.ts";
import { countPayout } from "../../framework/presentation/payout.ts";
import { loadTavernAudio } from "./audio.ts";
import { createTavernSoundscape } from "./soundscape.ts";
import { mountMascot } from "./mascot.ts";
import { observeLayoutMode } from "../../framework/presentation/layout-mode.ts";
import type {
  Chance,
  Chest,
  FeatureState,
  GameDefinition,
  MockBonusScenario,
  Outcome,
  Position,
  ReelMotion,
} from "../../framework/domain/contracts.ts";


export async function mountTavern(root: HTMLElement, game: GameDefinition, loader?: BrandLoader) {
  const bonusPreview = new URLSearchParams(location.search).get("cheat") === "1";
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
 <main class="game-shell tavern-shell" data-mode="base"${matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : " data-native-scene"}>
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
     <button id="bet-picker" type="button" class="hud-money hud-bet-amount" aria-label="Bet menu" aria-controls="bet-panel" aria-expanded="false" popovertarget="bet-panel" disabled><span id="bet-label">Bet</span><strong id="bet">1.00</strong><span id="chance-cost" hidden></span><span id="bet-track" role="meter" aria-label="Bet level" aria-valuemin="0"></span></button>
     <div class="bet-arrows"><button id="bet-up" aria-label="Increase bet">${hudIcon("bet-up")}</button><button id="bet-down" aria-label="Decrease bet">${hudIcon("bet-down")}</button></div>
    </div>
    <div class="hud-spin-control">
     <button id="spin" class="spin-button" popovertarget="auto-panel" popovertargetaction="hide" disabled aria-label="Spin">${hudIcon("spin")}</button>
     <button id="auto-add" type="button" class="auto-add" aria-label="Add ${controls?.autoTopUp ?? 0} autoplay spins" hidden>+${controls?.autoTopUp ?? 0}</button>
    </div>
    <div class="hud-quick"><button id="auto" aria-label="Autoplay">${hudIcon("autoplay")}</button><button id="skip-bonus" class="skip-bonus" type="button" aria-label="Skip bonus" disabled>${hudIcon("skip")}</button><button id="speed" aria-label="Turbo" aria-pressed="false">${hudIcon("turbo")}</button></div>
   </div>
   <div class="hud-aux"><button id="rules" aria-label="Rules and paytable">ⓘ</button><button id="sound" aria-label="Toggle sound" aria-pressed="false">♫</button></div>
   <div id="auto-panel" class="tavern-hud-panel"></div>
   <div id="bet-panel" class="tavern-hud-panel" popover="auto" aria-label="Bet menu"><strong>Bet menu</strong><div class="bet-picker-options"></div></div>
   ${gameMenuEnabled ? `<div id="hud-menu-panel" class="tavern-hud-panel" popover="auto" aria-label="Game menu">
     <button id="menu-rules" type="button" aria-label="Game Rules">${hudIcon("info")} Info</button>
     <div class="menu-volume"><button id="effects-icon" type="button" aria-label="Toggle sound effects">${hudIcon("effects-muted")}</button><input id="effects-volume" type="range" min="0" max="100" aria-label="Sound effects volume"></div>
     <div class="menu-volume"><button id="music-icon" type="button" aria-label="Toggle music">${hudIcon("music-muted")}</button><input id="music-volume" type="range" min="0" max="100" aria-label="Music volume"></div>
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
  // Reference v13: the scene slowly pushes in (1 -> 1.05, 4 s linear) while a scatter reel is
  // anticipated, then eases back after 100 ms (300 ms power4.out).
  let anticipationPush: Animation | undefined;
  const anticipationZoom = (active: boolean) => {
    if (active) {
      anticipationPush?.cancel();
      anticipationPush = stage.animate(
        [{ transform: "scale(1)", transformOrigin: "50% 50%" }, { transform: "scale(1.05)", transformOrigin: "50% 50%" }],
        { duration: 4000, easing: "linear", fill: "forwards", composite: "add" },
      );
      return;
    }
    const push = anticipationPush;
    if (!push) return;
    anticipationPush = undefined;

    push.pause();
    const scale = Number(push.effect?.getComputedTiming().progress ?? 1) * 0.05 + 1;
    push.cancel();
    stage.animate(
      [{ transform: `scale(${scale})`, transformOrigin: "50% 50%" }, { transform: "scale(1)", transformOrigin: "50% 50%" }],
      { delay: 100, duration: 300, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards", composite: "add" },
    );
  };
  if (scene) applySceneLayers(stage, scene.layers);
  // Reference v13 picks desktop / landscape / portrait from the game viewport size. The CSS
  // reads data-layout from <html> (dialogs and overlays included) and the scene follows it.
  // The reference measures a full-viewport layer (.main-wrap); the shell has a min-height,
  // so measure an invisible fixed probe that always equals the game viewport.
  const gameShell = root.querySelector<HTMLElement>(".game-shell")!;
  let layoutMode: ReturnType<typeof observeLayoutMode> | undefined;
  if (game.presentation.layout) {
    const probe = document.createElement("div");
    probe.className = "layout-probe";
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, { position: "fixed", inset: "0", visibility: "hidden", pointerEvents: "none" });
    root.append(probe);
    layoutMode = observeLayoutMode(probe, game.presentation.layout, [gameShell, document.documentElement]);
  }
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
  // Reference sound director: ambience + three music layers per mode and the cue rules.
  const sound = createTavernSoundscape(audio);
  // Reference defaults: sound and music at 0.5, both on; they start with Press to continue.
  audio.setLevel("effects", 0.5);
  audio.setLevel("music", 0.5);
  function syncMusic(bonus: boolean) {
    sound.mode(bonus);
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
  const revealBonusScene = () => !reducedMotion && scene?.bonusSceneVeil
    ? revealThroughVeil(stage, scene.bonusSceneVeil)
    : undefined;
  function emphasize(element: HTMLElement | null) {
    if (reducedMotion) return;
    element?.animate([
      { scale: "1" },
      { scale: "1.06 0.98", offset: 0.38 },
      { scale: "1" },
    ], { duration: 260, easing: "ease-out" });
  }
  /**
   * Every "Press to continue" zooms in, settles back, then disappears. With fadeMs the
   * button leaves within that time and the click resolves at once, so a scene outro can
   * start on the same click.
   */
  function continueWithMotion(
    surface: HTMLElement, button: HTMLButtonElement, ready?: Promise<unknown>, fadeMs?: number,
  ) {
    return waitForContinue(surface, button, ready, () => {
      if (reducedMotion) {
        button.style.visibility = "hidden";
        return;
      }
      const motion = fadeMs === undefined
        ? button.animate([
          { scale: 1, opacity: 1 },
          { scale: 1.14, opacity: 1, offset: 0.3 },
          { scale: 0.92, opacity: 1, offset: 0.6 },
          { scale: 1.18, opacity: 0 },
        ], { duration: 420, easing: "ease-out", fill: "forwards" })
        : button.animate([
          { scale: 1, opacity: 1 },
          { scale: 1.14, opacity: 1, offset: 0.35 },
          { scale: 1.06, opacity: 0 },
        ], { duration: fadeMs, easing: "ease-out", fill: "forwards" });
      return fadeMs === undefined ? motion.finished : undefined;
    });
  }
  let overlayMascot: Awaited<ReturnType<typeof mountMascot>> | undefined;
  let overlayMount: Promise<void> | undefined;
  let mascotAnchor: SceneAnchor | undefined;
  let overlayVisible = false;
  function prepareOverlayMascot() {
    return overlayMount ??= mountMascot($("mascot"), resources, onMascotEvent).then((mounted) => {
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
  let payline: ReturnType<typeof createTavernPayline>;
  let effects: Awaited<ReturnType<typeof mountTavernEffects>> | undefined;
  // Reference v13 characterEvent: giggle -> td_girl_gigle, mug -> td_girl_takes_mug.
  const mascotSounds: Record<string, string> = { giggle: "td_girl_gigle", mug: "td_girl_takes_mug" };
  const onMascotEvent = (name: string) => {
    const clip = mascotSounds[name];
    if (clip) audio?.cue(clip);
  };
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
    layoutMode,
    onMascotEvent,
    (type, name) => {
      if (type === "chestActivate") sound.chestActivate();
      else if (name) sound.reelhouseEvent(name);
    },
  ).catch((error) => {
    console.warn("Tavern scene animations unavailable", error);
    // Fall back to the DOM art (it fetches the hd atlas pages only now).
    root.querySelector(".tavern-shell")?.removeAttribute("data-native-scene");
    return undefined;
  });
  const paylineAssets = Promise.allSettled([
    reducedMotion ? Promise.resolve() : loadReelhouse(resources),
    loadTavernBitmapFonts(resources),
  ]);
  let presentingFeature: FeatureState | null = null;
  /** A winning result is being presented: Spin (and its Skip role) waits until it ends. */
  let basePresentationSkippable = false;
  let showRecoveredWin = false;
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
    sound.betLevel(index, game.bets.length);
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
    $("win-value").hidden = displayWin === 0 && !showRecoveredWin;
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
    const chanceActive = !feature && chance !== "standard";
    const shownBet = money(feature ? (state?.round?.bet ?? presentingBet) : bet);
    const chanceName = chance === "extra" ? "Extra Chance" : "Super Chance";
    const cost = money(bet * game.demo.chancePrices[chance]);
    $("bet-label").textContent = "Bet";
    $("bet").textContent = shownBet;
    $("chance-cost").hidden = !chanceActive;
    $("chance-cost").textContent = chanceActive ? `${chanceName} · Cost ${cost}` : "";
    $("bet-picker").setAttribute("aria-label", chanceActive
      ? `Bet menu, current bet ${shownBet}, ${chanceName}, cost ${cost} per spin`
      : `Bet menu, current bet ${shownBet}`);
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
    const skip = canSkipSpin();
    const spin = $<HTMLButtonElement>("spin");
    spin.disabled = !autoRunning && (nextFreeSpin || (busy && !skip));
    spin.classList.toggle("spinning", busy && controller.phase !== "recovery");
    const unlimited = autoRemaining === Infinity;
    spin.innerHTML = autoRunning
      ? `<span class="auto-count">${unlimited ? "∞" : autoRemaining}</span>`
      : skip ? hudIcon("skip") : hudIcon("spin") + hudIcon("autoplay-ready");
    spin.setAttribute("aria-label", autoRunning
      ? (unlimited ? "Stop unlimited autoplay" : `Stop autoplay, ${autoRemaining} spins left`)
      : skip ? "Skip" : busy || nextFreeSpin ? "Round in progress" : autoPicker.isOpen() && autoRemaining > 0 ? "Start autoplay" : "Spin");
    $("auto-add").hidden = !autoRunning || unlimited || !controls?.autoTopUp;
    autoPicker.setSelected(autoRunning ? 0 : autoRemaining);
    $("speed").setAttribute("aria-pressed", String(turbo));
    $("sound").setAttribute("aria-pressed", String(!audio.muted));
  }
  function modal(content: string, dismissible = true, look = "", onBack?: () => void) {
    delete dialog.dataset.returning;
    delete dialog.dataset.sceneReveal;
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
  /**
   * Base-game state popups (insufficient balance, connection loss, reconnect, retry) share the
   * Resume Active Game look. Actions are buttons; a `null` handler shows a disabled button.
   */
  interface NoticeAction { id: string; label: string; secondary?: boolean; onClick: (() => void) | null }
  function notice(kind: string, title: string, body: string, actions: NoticeAction[]) {
    modal(
      `<h2>${title}</h2><p>${body}</p><div class="notice-actions">${actions.map((action) =>
        `<button id="${action.id}" type="button" class="${action.secondary ? "notice-secondary" : "primary notice-primary"}"${action.onClick ? "" : " disabled"}>${action.label}</button>`).join("")}</div>`,
      false, "resume",
    );
    dialog.dataset.notice = kind;
    for (const action of actions) if (action.onClick) $(action.id).onclick = action.onClick;
  }
  const closeNotice = (kind?: string) => {
    if (dialog.open && dialog.dataset.notice && (!kind || dialog.dataset.notice === kind)) dialog.close();
  };
  dialog.addEventListener("close", () => { delete dialog.dataset.notice; });
  const spinCost = (action: "spin" | "buy-tavern" | "buy-drop") =>
    game.bets[betIndex] * (action === "spin"
      ? game.demo.chancePrices[chance]
      : game.demo.buyPrices[action === "buy-drop" ? "drop" : "tavern"]);
  function showInsufficientBalance() {
    stopAuto();
    notice("balance", "Insufficient Balance",
      "Your balance is too low for this bet. Lower the bet or add funds to continue.",
      [{ id: "notice-ok", label: "OK", onClick: () => dialog.close() }]);
  }
  /** Network failures: the paid request may already be recorded, so Retry re-sends the same one. */
  function showConnectionLost(pending: boolean, retry: () => void) {
    notice("connection", "Connection Lost",
      pending
        ? "We could not confirm your last round. Your bet is safe: Retry fetches the same result without placing another bet."
        : "Please check your internet connection and try again.",
      [{ id: "retry", label: "Retry", onClick: () => {
        if (!navigator.onLine) { showReconnecting(retry); return; }
        dialog.close();
        retry();
      } }]);
  }
  function showReconnecting(retry: () => void) {
    notice("reconnecting", "Reconnecting…",
      "Waiting for your internet connection. The game continues automatically when you are back online.",
      [{ id: "retry", label: "Retry", onClick: null }]);
    const resume = () => {
      if (dialog.dataset.notice !== "reconnecting") return;
      dialog.close();
      retry();
    };
    addEventListener("online", resume, { once: true });
  }
  // Losing the connection while idle shows the reconnect state; it closes itself when back online.
  addEventListener("offline", () => {
    if (dialog.open && dialog.dataset.look !== "resume") return;
    if (dialog.open && dialog.dataset.notice !== "connection") return;
    showReconnecting(() => {
      if (controller.phase === "recovery") void run("spin", true);
    });
  });
  dialog.addEventListener("cancel", (event) => {
    if (closeModal.hidden || onModalBack) {
      event.preventDefault();
      onModalBack?.();
    }
  });
  dialog.addEventListener("close", () => scheduleNextSpin());
  const winTier = (amount: number, bet: number) =>
    game.demo.winTiers.filter((tier) => amount >= bet * tier.multiplier).at(-1);
  // Tier cues of the reference wincap sequence.
  const winTierCues: Record<string, string> = {
    big: "td_wincap_bigwin", super: "td_wincap_superwin", mega: "td_wincap_megawin",
    epic: "td_wincap_epicwin", max: "td_wincap_maxwin",
  };
  let winSkip: (() => void) | undefined;
  let skipPresentationWait: (() => void) | undefined;

  function canSkipSpin() {
    return controller.phase === "presenting" && !dialog.open &&
      (!!winSkip || (basePresentationSkippable && !skipped && (!view.isMoving || view.allowForceStop)));
  }
  function waitForWin(ms: number) {
    if (skipped || ms <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        skipPresentationWait = undefined;
        resolve();
      };
      const timer = setTimeout(finish, ms);
      skipPresentationWait = finish;
    });
  }
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
    // The Spine screen replaces the DOM text; hide it before the renderer is ready (no flash).
    if (effects) art.dataset.spinePending = "";
    overlay.append(title, art, value);
    overlay.style.pointerEvents = "auto";
    overlay.addEventListener("click", () => winSkip?.());
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
    // The Spine screen replaces the DOM text; hide it before the renderer is ready (no flash).
    if (effects) art.dataset.spinePending = "";
    const value = document.createElement("span");
    value.className = "win-celebration-value";
    renderAmount(value, money(0), "td_gold");
    overlay.append(title, art, value);
    root.append(overlay);
    // Higher Spine clips already include the lower win tiers. Play the clip of the final
    // tier once; its authored events (big, super, mega, epic, max) announce each tier.
    const finalClip = stages[stages.length - 1].clip;
    const duration = effects?.winScreenTiming(finalClip).duration ?? 1.5;
    const authored = effects?.winScreenEvents(finalClip) ?? [];
    const events = authored.length ? authored : stages.map((stage, index) => ({
      name: stage.clip.replace(/win$/, ""), time: index * duration / stages.length,
    }));
    // The amount counts continuously across all tiers, like the reference tween.
    const countSeconds = Math.min(duration, scene?.winScreen?.countSeconds?.[finalClip] ?? duration);
    const start = performance.now();
    let skippedSeconds = 0;
    const clock = () => effects ? effects.screenTime() : (performance.now() - start) / 1000 + skippedSeconds;
    let time = 0;
    let level = -1;
    let pending = -1;
    let flush = 0;
    let counted = false;
    let countForced = false;
    let screenDone = false;
    const levelCues: string[] = [];
    const applyLevel = () => {
      flush = 0;
      const rank = pending;
      pending = -1;
      // Skip can pass several events in one frame. Announce only the highest new tier.
      if (rank <= level) return;
      level = rank;
      const stage = stages[Math.min(rank, stages.length - 1)];
      if (title.textContent !== stage.label) title.textContent = stage.label;
      for (const cue of levelCues.splice(0)) audio.fade(cue, 150);
      const cue = winTierCues[events[rank].name] ?? winTierCues.big;
      audio.cue(cue);
      levelCues.push(cue);
      void effects?.shockwave([view.app]);
      if (effects) effects.pulseScreenAmount();
      else emphasize(value);
    };
    const onTierEvent = (name: string) => {
      const rank = events.findIndex((event) => event.name === name);
      if (rank < 0 || rank <= level) return;
      pending = Math.max(pending, rank);
      flush ||= requestAnimationFrame(applyLevel);
    };
    const unsubscribe = effects?.onScreenEvent(onTierEvent);
    const finishCount = () => {
      if (counted) return;
      counted = true;
      audio.fade("count", 200);
      audio.cue("countEnd");
      audio.cue("td_wincap_end");
      for (const cue of levelCues.splice(0)) audio.fade(cue, 500);
    };
    // Skip moves forward to the next authored tier, never backwards. On the final tier it
    // only completes the amount; the clip keeps its authored ending.
    winSkip = () => {
      const now = Math.max(time, clock());
      const next = events.find((event) => event.time > now + 0.001);
      if (!next) {
        countForced = true;
        return;
      }
      if (effects) effects.seekScreen(next.time);
      else skippedSeconds += next.time - now;
    };
    sync();
    audio.cue("td_wincap_start");
    audio.cue("count", true);
    const screen = (effects?.showScreen(art, finalClip, { amount: money(0) }) ?? delay(duration * 1000))
      .finally(() => { screenDone = true; });
    try {
      const counting = new Promise<void>((resolve) => {
        const tick = () => {
          time = Math.max(time, Math.min(duration, clock()), screenDone ? duration : 0);
          if (!effects) for (const [rank, event] of events.entries()) if (event.time <= time) onTierEvent(events[rank].name);
          const countTime = countForced ? countSeconds : time;
          const shown = countTime >= countSeconds ? amount : Math.round(amount * countTime / countSeconds);
          const formatted = money(shown);
          renderAmount(value, formatted, "td_gold");
          effects?.setScreenAmount(formatted);
          if (countTime >= countSeconds) finishCount();
          if (time < duration) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await Promise.all([screen, counting]);
    } finally {
      winSkip = undefined;
      sync();
      unsubscribe?.();
      if (flush) cancelAnimationFrame(flush);
      finishCount();
    }
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
    // Reference v13: autoplay starts the next base round as soon as the previous one ends
    // (autobetTimeoutDuration 0); each free spin waits 500 ms (turbo 300) before dropping,
    // and the first one also waits for the bonus-enter tail (feature.startDelayMs).
    void noWinReelsStoppedAt;
    const delay = feature?.remaining ? nextSpinDelay(turbo ? 300 : 500) : 0;
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
    if (checkpoint?.staticResult && checkpoint.curStep === "base") {
      view.setBoard(outcome.state.board);
      await controller.completePresentation();
      displayWin = checkpoint.displayWinMinor ?? outcome.spinWin;
      showRecoveredWin = true;
      sync();
      return;
    }
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
        const ordinary = !presentingFeature && !outcome.entry && checkpoint?.curStep !== "intro";
        basePresentationSkippable = ordinary;
        sync();
        let anticipating = false;
        sound.reveal();
        if (checkpoint?.staticResult) view.setBoard(outcome.state.board);
        else await view.stop(outcome.state.board, effects?.playSceneEffects, {
          reel: (reel) => sound.reelStop(reel, turbo),
          symbol: (id) => {
            if (anticipating && !turbo && !skipped) sound.anticipationSymbolReveal();
            if (id === game.presentation.drop.anticipation?.symbolId) sound.scatterLand(turbo || skipped);
          },
          anticipation: (active) => {
            anticipating = active;
            sound.anticipation(active);
            anticipationZoom(active);
          },
        });
        const plainNoWin = outcome.spinWin === 0 && outcome.wins.length === 0 &&
          !outcome.entry && !outcome.retrigger && !outcome.completion && !outcome.capped;
        noWinReelsStoppedAt = plainNoWin ? performance.now() : undefined;
        basePresentationSkippable = ordinary && !plainNoWin;
        sync();
        if (!plainNoWin) {
          if (ordinary) {
            const check = game.presentation.checkWinDelayMs;
            await waitForWin((turbo ? check?.turbo : check?.normal) ?? 0);
          } else await waitAfterReels(spinTurbo);
        }
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
        const animateWins = async () => {
          // Reference v13 animateBoardWins: lines accumulate (earlier lines stay lit); each
          // symbol of a line starts its win 40 ms after the previous (turbo/skip 5 ms), a line
          // ends with 150 ms (normal only) and the last line holds 500 ms.
          const lit: Position[] = [];
          for (const [index, win] of outcome.wins.entries()) {
            const fast = () => turbo || skipped;
            if (ordinary && skipped) break;
            sound.lineWin(win.amount / outcome.bet, turbo);
            payline.show(win, game.lines[win.line], money(win.amount), win.amount >= outcome.bet * 20, fast());
            for (const position of win.positions)
              if (!lit.some((p) => p.reel === position.reel && p.row === position.row)) lit.push(position);
            for (const position of win.positions) {
              if (ordinary && skipped) break;
              void view.focusWins(lit, [position]);
              const time = basePresentation.lineSymbolMs[fast() ? "turbo" : "normal"];
              await (ordinary ? waitForWin(time) : delay(time));
            }
            if (!fast()) await (ordinary ? waitForWin(basePresentation.lineGapMs) : delay(150));
            if (index === outcome.wins.length - 1)
              await (ordinary ? waitForWin(basePresentation.lastLineHoldMs[fast() ? "turbo" : "normal"]) : delay(500));
          }
          if (scatter.length && (outcome.entry || !skipped)) {
            await view.waitForLandings(scatter);
            // Reference bonusEnter: 380 ms, then the mascot win with the Scatters.
            // bonusRetrigger: 500 ms (turbo 300). Other Scatters do not cheer.
            if (outcome.entry || outcome.retrigger) {
              await delay(outcome.entry ? 380 : turbo || skipped ? 300 : 500);
              celebrate();
              sound.scatterWin();
            }
            await view.focusWins(scatter);
          }
          view.clearHighlight();
          if (ordinary && skipped) payline.clear();
        };
        let previousFrame = performance.now();
        let countProgress = 0;
        const countWin = plainNoWin ? undefined : new Promise<void>((resolve) => {
          const tick = () => {
            const now = performance.now();
            const countMs = ordinary ? basePresentation.countMs[turbo ? "turbo" : "normal"] : turbo ? 179 : 650;
            countProgress += (now - previousFrame) / countMs;
            previousFrame = now;
            const t = skipped ? 1 : Math.min(1, countProgress);
            displayWin = Math.round(outcome.spinWin * (1 - (1 - t) ** 3));
            syncWin(presentingFeature);
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          tick();
        });
        await Promise.all([animateWins(), countWin, effects?.waitForChestActivations()]);
        basePresentationSkippable = false;
        countingFeatureBase = undefined;
        sync();
        if (outcome.retrigger) {
          effects?.shake();
          await showWinCelebration("Retrigger", `+${outcome.retrigger} Free Spins`, "addfs");
        }
      }
      if (outcome.entry) {
        stopAuto();
        sound.bonusIntro();
        audio.cue("entry");
        await effects?.prepareBonusIntro();
        stage.dataset.bonusIntro = "true";
        modal(
          `<div class="tavern-screen-art bonus-intro-art"${effects ? " data-spine-pending" : ""}></div>
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
        const intro = effects?.showScreen(introArt, bonusClip + "_intro", {
          count: outcome.state.feature!.remaining,
          outro: bonusClip + "_outro",
        });
        await continueWithMotion(dialog, $<HTMLButtonElement>("continue"), intro, 250);
        if (effects) void effects.shockwave([view.app]);
        else emphasize(dialog.querySelector<HTMLElement>(".bonus-preview"));
        await effects?.endScreen(bonusClip + "_outro");
        const reveal = revealBonusScene();
        dialog.close();
        // The trigger symbols leave with the normal reel. Prepare the empty
        // feature grid only when the player moves past the bonus announcement.
        prepareFeatureEntry();
        displayWin = 0;
        presentingFeature = outcome.state.feature;
        // The Spine key grid and the reel canvas must measure the same bonus layout.
        stage.parentElement!.dataset.mode = outcome.entry;
        const bonusEntry = effects?.enterBonus();
        sync();
        delete stage.dataset.bonusIntro;
        audio.cue("entryEnd");
        sound.bonusEnter();
        syncMusic(true);
        await Promise.all([bonusEntry, reveal]);
      }
    } else if (checkpoint?.curStep === "show-chest" || checkpoint?.curStep === "open-chest") {
      presentingFeature = outcome.state.feature;
      sync();
      if (checkpoint.curStep === "show-chest") {
        await waitBeforeFeatureResult();
        sound.chestFinalWinIntro();
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
        sound.chestOpen();
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
        sound.chestFinalWinIntro();
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
        await effects?.revealChests(money(c.accumulated));
        if (!effects) stage.dataset.chestReveal = "true";
        await delay(2000);
        for (const [index, { chest, reel }] of unlocked.entries()) {
          sound.chestOpen();
          if (effects) await effects.openChest(reel, chest.multiplier!);
          else $("chests").children[reel].outerHTML = chestMarkup(chest, reel, true);
        }
        let runningAmount = c.accumulated;
        for (const [index, { chest, reel }] of unlocked.entries()) {
          const nextAmount = Math.min(runningAmount * chest.multiplier!, c.featureAward);
          sound.multiplierAdd();
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
      // Reference bonusExit: the mascot cheers only from a mega win (75x).
      if (c.featureAward >= outcome.bet * 75) celebrate();
      // Reference bonusExit: the win screen only from a mega win (75x), or at the cap.
      if (c.featureAward >= outcome.bet * 75 || c.capped)
        await showWinSequence(c.featureAward, outcome.bet, c.capped);
      await effects?.prepareTotalWin();
      view.hideSymbols();
      $("chests").hidden = true;
      const shell = stage.parentElement!;
      shell.dataset.totalWin = "shown";
      modal(
        `<div class="tavern-screen-art total-win-screen"${effects ? " data-spine-pending" : ""}></div>
        <h2>${artRegion("totalWin", "total-win-art")}<span class="visually-hidden">Total Win</span></h2>
        <strong class="result-total bonus-paid" aria-live="polite">${money(c.featureAward)}</strong>
        <button id="continue" class="scene-continue">Press to continue</button>`,
        false,
        "total-win",
      );
      const amount = money(c.featureAward);
      renderAmount(dialog.querySelector<HTMLElement>(".result-total")!, amount, "td_gold");
      sound.totalWinIntro();
      const resultArt = dialog.querySelector<HTMLElement>(".tavern-screen-art")!;
      const enter = effects?.showScreen(resultArt, "total_win_start", {
        amount, idle: "total_win_idle", outro: "total_win_end",
      });
      const outroTiming = scene?.totalWinOutro ?? { continueFadeMs: 250, backgroundEnterMs: 200, reelEnterMs: 500 };
      // One accepted click starts the outro; the Continue art fades while the scene leaves.
      // Continue appears only after total_win_start, so the live overlay is known by then.
      await continueWithMotion(dialog, $<HTMLButtonElement>("continue"), enter, outroTiming.continueFadeMs);
      const clickedAt = performance.now();
      const liveReturn = effects?.hasLiveTotalWin();
      audio.cue("totalOutro");
      if (!effects) emphasize(dialog.querySelector<HTMLElement>(".result-total"));
      const leaving = effects?.startTotalWinOutro(outroTiming.backgroundEnterMs, [view.app]);
      // The confirmation is the same checkpoint request as before. Scene timing follows the
      // click; the balance only counts up after this request has returned.
      const balanceBefore = controller.state!.balance;
      const confirming = checkpoint
        ? controller.completePresentation().then(() => {
          outcome.state.balance = controller.state!.balance;
          outcome.paidAward = Math.max(0, outcome.state.balance - balanceBefore);
        })
        : Promise.resolve();
      confirming.catch(() => undefined);
      if (liveReturn) {
        dialog.dataset.returning = "true";
        await delay(Math.max(0, outroTiming.reelEnterMs - (performance.now() - clickedAt)));
      } else {
        await leaving;
        dialog.close();
        await confirming;
      }
      presentingFeature = null;
      displayWin = liveReturn ? 0 : c.roundAward;
      // The base and bonus machine have different top offsets. Apply the base layout
      // before the Spine frame is positioned so the frame and symbols enter together.
      shell.dataset.mode = "base";
      shell.dataset.totalWin = "returning";
      const reveal = revealBonusScene();
      if (reveal && liveReturn) dialog.dataset.sceneReveal = "true";
      const entering = effects?.returnFromTotalWin();
      view.setBoard(outcome.state.board);
      sync();
      // Until the payout counts up, keep showing the balance from before this round's award.
      if (liveReturn) $("balance").textContent = money(checkpoint ? balanceBefore : outcome.state.balance - outcome.paidAward);
      if (liveReturn) {
        await Promise.all([confirming, delay(500)]);
        const balance = outcome.state.balance;
        const beforeAward = balance - outcome.paidAward;
        $("balance").textContent = money(beforeAward);
        await Promise.all([
          leaving,
          entering,
          reveal,
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
        delete dialog.dataset.sceneReveal;
      } else await Promise.all([entering, reveal]);
      delete shell.dataset.totalWin;
    } else if (outcome.capped) {
      stopAuto();
      await showWinSequence(outcome.spinWin, outcome.bet, true);
    } else if (tier && !outcome.entry && outcome.spinWin >= outcome.bet * 10) {
      // Reference boardWin: the win screen from a nice win (10x); 5x wins only count up.
      // Reference boardWin: the mascot cheers from a super win (50x) up, below the max win.
      if (outcome.spinWin >= outcome.bet * 50) celebrate();
      await showWinSequence(outcome.spinWin, outcome.bet);
    }
    await controller.completePresentation();
    const next = controller.nextPresentation();
    if (next) { await present(next, spinTurbo); return; }
    if (autoRunning && autoRemaining !== Infinity) {
      autoRemaining--;
      autoRunning = autoRemaining > 0;
    }
    // Reference finalWin: the whole round's award in bets, once the round has ended.
    if (!controller.state?.feature)
      sound.finalWin((outcome.completion?.roundAward ?? outcome.spinWin) / outcome.bet);
    sync();
    syncMusic(!!controller.state?.feature);
    scheduleNextSpin(noWinReelsStoppedAt);
  }
  async function run(
    action: "spin" | "buy-tavern" | "buy-drop",
    recover = false,
    startupResume = false,
    mockBonus?: MockBonusScenario,
  ) {
    if (!recover && action !== "spin" && !bonusPreview) {
      notice("coming-soon", basePresentation.bonusUnavailable.title,
        basePresentation.bonusUnavailable.body,
        [{ id: "notice-ok", label: "OK", onClick: () => dialog.close() }]);
      return;
    }
    if (!recover && controller.phase !== "ready") {
      if (!canSkipSpin()) return;
      if (winSkip) {
        winSkip();
        return;
      }
      skipped = true;
      skipPresentationWait?.();
      view.skip();
      effects?.skip();
      sync();
      return;
    }
    clearSpinTimer();
    if (!recover && !controller.state?.feature && controller.state &&
        spinCost(action) > controller.state.balance) {
      showInsufficientBalance();
      sync();
      return;
    }
    if (!recover && !navigator.onLine) {
      stopAuto();
      // Back online only closes the popup: a new bet always needs the player's own press.
      showReconnecting(() => undefined);
      return;
    }
    showRecoveredWin = false;
    displayWin = 0;
    syncWin(controller.state?.feature);
    const spinTurbo = turbo;
    audio.unlock();
    skipped = false;
    payline?.clear();
    if (!recover) {
      view.start(turbo, reelMotion);
      effects?.spin();
      if (!controller.state?.feature) sound.betStart();
      audio.cue("start");
    }
    const work = recover
      ? controller.recover(!startupResume)
      : controller.execute({
          action,
          bet: controller.state?.round?.bet || game.bets[betIndex],
          chance: controller.state?.feature ? "standard" : chance,
          ...(mockBonus ? { mockBonus } : {}),
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
        } else if (!outcome.entry && outcome.checkpoint?.curStep !== "base") view.hideSymbols();
        shell.querySelector<HTMLElement>(".tavern-hud")!.inert = false;
      }
      try {
        await present(outcome, spinTurbo);
      } finally {
        basePresentationSkippable = false;
        sync();
      }
    } catch (error) {
      stopAuto();
      if (controller.state) {
        view.setBoard(controller.state.board);
        if (controller.state.feature?.played === 0) prepareFeatureEntry();
      }
      const pending = controller.phase === "recovery";
      const code = error instanceof ApiError ? error.code : error instanceof Error ? error.message : "";
      if (/INSUFFICIENT/.test(code)) showInsufficientBalance();
      else if (pending || (error instanceof TypeError) ||
          (error instanceof Error && /Timeout|Abort/.test(error.name)) || /NETWORK|TIMEOUT|OFFLINE/.test(code))
        showConnectionLost(pending, () => {
          if (pending) void run("spin", true, startupResume);
        });
      else
        notice("declined", "Please Try Again",
          "The server could not accept this request. Your balance has not changed.",
          [{ id: "retry", label: "OK", onClick: () => dialog.close() }]);
      sync();
    }
  }
  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    if (button.id === "buy") sound.buttonClick(true);
    else if (button.matches("#auto, #auto-add, #speed, #menu, #menu-rules, #bet-picker, #confirm-buy, #notice-ok, .close-modal, [data-buy], [data-chance], .bet-picker-options button"))
      sound.buttonClick();
  }, { capture: true });
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
    if (!audio.muted) syncMusic(!!controller.state?.feature);
    sync();
  };
  $("auto").onclick = () => {
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
  let debugMode = "drop";
  let debugScenario: MockBonusScenario = { spins: 1, chests: [true, false, false, false, false], winTier: "big" };
  function openDebugBonus() {
    const tiers = [["normal", "No Big Win"], ["big", "Big Win"], ["super", "Super Win"],
      ["mega", "Mega Win"], ["epic", "Epic Win"], ["max", "Max Win"]] as const;
    modal(`<h2>Bonus debug</h2>
      <form id="debug-bonus-form" class="debug-bonus-form">
        <label>Bonus <select name="mode"><option value="drop">Drop</option><option value="tavern">Tavern</option></select></label>
        <label>Free spins <input name="spins" type="number" min="1" max="${game.demo.maxFeatureSpins}" step="1" value="${debugScenario.spins}" required></label>
        <fieldset><legend>Chests to open (×2 each)</legend><div class="debug-chests">
          ${debugScenario.chests.map((enabled, reel) => `<label><input type="checkbox" name="chest-${reel}" aria-label="Chest ${reel + 1}"${enabled ? " checked" : ""}>${reel + 1}</label>`).join("")}
        </div></fieldset>
        <label>Final win tier <select name="win-tier">${tiers.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
        <button class="primary" type="submit">Run test bonus</button>
      </form>
      <h2>Error states</h2>
      <div class="debug-faults">
        <button type="button" data-fault="low-balance">Set balance to ${money(game.bets[0])}</button>
        <button type="button" data-fault="restore-balance">Restore balance to ${money(game.demo.initialBalance)}</button>
        <button type="button" data-fault="drop-response">Lose the next spin's reply</button>
        <button type="button" data-fault="fail-request">Fail the next spin request</button>
        <button type="button" data-fault="offline">Go offline for 8 seconds</button>
      </div>
      <p class="debug-faults-note">After choosing a spin fault, close this menu and press Spin.</p>`, true, "debug-bonus", () => { openShop(); $("open-bonus-debug").focus(); });
    for (const button of dialog.querySelectorAll<HTMLButtonElement>("[data-fault]"))
      button.onclick = () => void runDebugFault(button.dataset.fault!);
    const form = $<HTMLFormElement>("debug-bonus-form");
    form.querySelector<HTMLSelectElement>('[name="mode"]')!.value = debugMode;
    form.querySelector<HTMLSelectElement>('[name="win-tier"]')!.value = debugScenario.winTier;
    form.onsubmit = (event) => {
      event.preventDefault();
      if (controller.phase !== "ready" || controller.state?.feature) return;
      const values = new FormData(form);
      debugMode = String(values.get("mode"));
      debugScenario = {
        spins: Number(values.get("spins")),
        chests: debugScenario.chests.map((_, reel) => values.has(`chest-${reel}`)),
        winTier: values.get("win-tier") as MockBonusScenario["winTier"],
      };
      dialog.close();
      void run(debugMode === "tavern" ? "buy-tavern" : "buy-drop", false, false, debugScenario);
    };
  }
  /** Mock review only: reproduce the base-game error states from the Bonus debug menu. */
  async function runDebugFault(fault: string) {
    if (controller.phase !== "ready" || controller.state?.feature) return;
    if (fault === "low-balance" || fault === "restore-balance") {
      try {
        await transport.debugSetBalance?.(fault === "low-balance" ? game.bets[0] : game.demo.initialBalance);
        location.reload();
      } catch (error) {
        console.warn("Debug balance unavailable", error);
      }
      return;
    }
    dialog.close();
    if (fault === "offline") {
      const real = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      dispatchEvent(new Event("offline"));
      setTimeout(() => {
        delete (navigator as { onLine?: boolean }).onLine;
        if (!real) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
        dispatchEvent(new Event("online"));
      }, 8000);
      return;
    }
    transport.debugFault = fault as "fail-request" | "drop-response";
  }
  function openShop() {
    const showBonusDebug = bonusPreview && transport.mockBonusEnabled;
    modal(
      `<h2 class="visually-hidden">Feature buy</h2>
      ${showBonusDebug ? '<button id="open-bonus-debug" class="shop-debug-entry" type="button">Bonus debug</button>' : ""}
      <div class="shop-grid">${shopOptions
        .map(
          (option) => `
        <div class="shop-tile">
          <button data-${option.kind}="${option.id}" class="shop-card ${option.kind}"${shopPrice(option) > controller.state!.balance ? " disabled" : ""}>
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
    if (showBonusDebug) $("open-bonus-debug").onclick = openDebugBonus;
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
    sound.buttonClick(true);
    if (controller.phase !== "ready" || controller.state?.feature) return;
    stopAuto();
    if (chance !== "standard") {
      chance = "standard";
      sync();
      return;
    }
    openShop();
  };
  const fillInfo = (text: string, values: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
  /** Reference info page; numbers come from the live game configuration. */
  function rules() {
    const rtp = info.rtp as string | null;
    const multipliers = [...new Set([...game.demo.chestMultipliers.tavern, ...game.demo.chestMultipliers.drop])]
      .sort((a, b) => a - b);
    const values = {
      reels: game.reels, rows: game.rows, rtp: rtp ?? "",
      maxWin: game.demo.capMultiplier.toLocaleString("en-US"),
      extraPrice: game.demo.chancePrices.extra, superPrice: game.demo.chancePrices.super,
      multipliers: multipliers.join(", "), retriggerSpins: game.demo.retriggerSpins,
      dropSpins: game.demo.featureSpins.drop, dropMinMultiplier: Math.min(...game.demo.chestMultipliers.drop),
    };
    void openInfoScreen({
      headings: info.headings,
      rules: fillInfo(info.rules, { ...values, rtpLine: rtp ? fillInfo(info.rtpLine, values) : "" }),
      paytableNote: info.paytableNote,
      paytable: info.paytable.map((group) => group.flatMap((id) => {
        const symbol = game.symbols.find((item) => item.id === id);
        if (!symbol) return [];
        const pays = Object.entries(symbol.pays)
          .map(([count, pay]) => ({ count: Number(count), multiplier: Number(pay) / 100 }))
          .filter((pay) => pay.multiplier > 0)
          .sort((a, b) => a.count - b.count);
        return [{ image: "./assets/" + staticSymbolImage(id), pays }];
      })),
      waysToWin: info.waysToWin,
      paylines: { reels: game.reels, rows: game.rows, lines: game.lines },
      features: fillInfo(info.features, values),
      general: fillInfo(info.general, { copyrightLine: info.copyright ? " " + info.copyright : "" }),
      version: info.version,
      closeIcon: hudIcon("close"),
      imageUrl: (path) => asset(path.replace(/^\.\/assets\//, "")),
    });
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
    const syncVolumeIcons = () => {
      for (const name of ["effects", "music"] as const)
        $(name + "-icon").innerHTML = hudIcon(audio.level(name) > 0 ? name : `${name}-muted`);
    };
    // As in the reference menu, the icon mutes its channel or restores the last level.
    const lastLevel = { effects: audio.level("effects") || 1, music: audio.level("music") || 1 };
    for (const channel of ["effects", "music"] as const) {
      const slider = $<HTMLInputElement>(channel + "-volume");
      const apply = (level: number) => {
        audio.unlock();
        audio.muted = false;
        audio.setLevel(channel, level);
        if (level > 0) lastLevel[channel] = level;
        slider.value = String(Math.round(level * 100));
        syncVolumeIcons();
        syncMusic(!!controller.state?.feature);
      };
      slider.value = String(Math.round(audio.level(channel) * 100));
      slider.oninput = () => apply(Number(slider.value) / 100);
      $(channel + "-icon").onclick = () => apply(audio.level(channel) > 0 ? 0 : lastLevel[channel]);
    }
    syncVolumeIcons();
  }
  // Long KRW amounts (e.g. ₩2,000,000,000 at the max win cap) must not run under the
  // neighbouring bet arrows on narrow phones: shrink the amount to the free space.
  const fitMoney = (el: HTMLElement) => {
    el.style.fontSize = "";
    if (!el.getClientRects().length) return;
    const r = el.getBoundingClientRect();
    let left = -Infinity;
    let right = Infinity;
    for (const button of root.querySelectorAll<HTMLElement>(".tavern-hud button")) {
      const target = (button.firstElementChild as HTMLElement | null) ?? button;
      const b = target.getBoundingClientRect();
      if (!b.width || b.bottom <= r.top || b.top >= r.bottom || button.contains(el)) continue;
      if (b.left >= r.left + r.width / 2) right = Math.min(right, b.left - 3);
      else if (b.right <= r.right - r.width / 2) left = Math.max(left, b.right + 3);
    }
    const overflow = Math.max(r.right - right, left - r.left, 0);
    if (overflow <= 0) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${Math.max(size * 0.6, size * (r.width - overflow) / r.width)}px`;
  };
  const moneyFields = ["balance", "spin-win-amount", "bet"].map((id) => $(id));
  const refitMoney = () => moneyFields.forEach(fitMoney);
  const moneyObserver = new MutationObserver((records) =>
    new Set(records.map((record) => moneyFields.find((field) => field.contains(record.target))))
      .forEach((field) => field && fitMoney(field)));
  moneyFields.forEach((field) =>
    moneyObserver.observe(field, { childList: true, characterData: true, subtree: true }));
  window.addEventListener("resize", () => requestAnimationFrame(refitMoney));
  let turboBeforeHold: boolean | undefined;
  runtime.lifetime.add(bindHoldShortcut(window, {
    code: "Space",
    holdMs: basePresentation.spaceHoldMs,
    enabled(event) {
      return !document.querySelector("dialog[open]") && !$("spin").closest("[inert]") &&
        !(event.target instanceof HTMLElement &&
          event.target.closest("input, select, textarea, [contenteditable], button:not(#spin)"));
    },
    press() {
      const spin = $<HTMLButtonElement>("spin");
      if (!spin.disabled && spin.getClientRects().length) spin.click();
    },
    hold(active) {
      if (active) {
        if ($<HTMLButtonElement>("speed").disabled || dialog.open) return;
        turboBeforeHold = turbo;
        turbo = true;
      } else {
        if (turboBeforeHold === undefined) return;
        turbo = turboBeforeHold;
        turboBeforeHold = undefined;
      }
      view.setTurbo(turbo);
      sync();
    },
  }));
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
      // Reference startGame: the Continue press starts the entry sting, ambience and music.
      opening.addEventListener("click", () => {
        audio.unlock();
        audio.muted = false;
        syncMusic(!!controller.state?.feature);
        sync();
      }, { once: true });
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
        await continueWithMotion(shell, opening, mascotReady);
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
      const continued = continueWithMotion(shell, opening, mascotReady);
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
        // Like reference v13, the only entry dim is the reelhouse `fade` slot of 1_game_enter
        // (held, then cleared by 0.87 s). The board stays visible under it; nothing else darkens.
        revealed = revealScene(reveal, 0, (_brightness, _symbolOpacity, elapsedMs) => {
          if (elapsedMs >= reveal.mascotDelayMs && shell.dataset.entering === "before-mascot") {
            shell.dataset.entering = "true";
            effects?.revealOpeningMascot();
            // Reference: playCharacterWin with 1_game_enter while the mascot fades in from
            // 0.3 s; the hidden mascot is not updated, so the win starts as it appears.
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
      hud.inert = false;
    }
    sync();
    if ((entry.resumeStep === "intro" || entry.resumeStep === "base") && controller.phase === "recovery") {
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
