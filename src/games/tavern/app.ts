import "./theme.css";
import { createSlotSession } from "../../framework/session.ts";
import { HttpTransport } from "../../framework/transport/http.ts";
import { loadTavernSymbols, paytableIcon } from "./skin.ts";
import { createTavernPayline } from "./payline.ts";
import {
  createReelhouse,
  loadReelhouse,
  mountTavernEffects,
} from "./effects.ts";
import { loadTavernBitmapFonts, renderAmount } from "./typography.ts";
import { artRegion, hudIcon, tavernAsset as asset } from "./art.ts";
import { applySceneLayers, type SceneAnchor } from "../../framework/presentation/scene.ts";
import type { BrandLoader } from "../../framework/presentation/brand-loading.ts";
import { mountRoundPicker, updateBetTrack } from "../../framework/presentation/hud-controls.ts";
import { countPayout, flyPayout } from "../../framework/presentation/payout.ts";
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


const money = (n: number) =>
  (n / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export async function mountTavern(root: HTMLElement, game: GameDefinition, loader?: BrandLoader) {
  const controls = game.presentation.controls;
  const gameMenuEnabled = controls?.menu ?? false;
  const showAnimatorViewer =
    import.meta.env.DEV ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  root.innerHTML = `
 <main class="game-shell tavern-shell" data-mode="base">
  <header class="tavern-top">
    <span><span id="game-title"></span> <small>Demo</small></span>
    ${showAnimatorViewer ? '<a class="assets-link" href="./?game=viewer">Animator Viewer</a>' : ""}
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
   <p id="status" class="tavern-status" role="status" aria-live="polite">Connecting to demo server…</p>
  </section>
  <section class="tavern-hud" aria-label="Game controls">
   <button id="buy" class="feature-button" aria-label="Feature buy">${hudIcon("feature-buy")}</button>
   <div class="hud-bar">
    ${gameMenuEnabled ? `<button id="menu" class="hud-menu" aria-label="Open menu" popovertarget="hud-menu-panel">${hudIcon("menu")}</button>` : ""}
    <div class="hud-money hud-balance"><span>Balance</span><strong id="balance">—</strong></div>
    <div class="hud-money win-value" id="win-value" hidden><span id="win-label">Win</span><strong id="win-amount">0.00</strong></div>
    <div id="free-spins" hidden><span>Free spins</span> <strong id="feature-progress">0</strong></div>
    <div class="hud-bet">
     <div class="hud-money hud-bet-amount"><span id="bet-label">Bet</span><strong id="bet">1.00</strong><div id="bet-track" role="meter" aria-label="Bet level" aria-valuemin="0"></div></div>
     <div class="bet-arrows"><button id="bet-up" aria-label="Increase bet">${hudIcon("bet-up")}</button><button id="bet-down" aria-label="Decrease bet">${hudIcon("bet-down")}</button></div>
    </div>
    <button id="spin" class="spin-button" disabled aria-label="Spin">${hudIcon("spin")}<small class="visually-hidden">SPIN</small></button>
    <div class="hud-quick"><button id="auto" aria-label="Autoplay">${hudIcon("autoplay")}</button><button id="speed" aria-label="Turbo" aria-pressed="false">${hudIcon("turbo")}</button></div>
   </div>
   <div class="hud-aux"><button id="rules" aria-label="Rules and paytable">ⓘ</button><button id="sound" aria-label="Toggle sound" aria-pressed="false">♫</button></div>
   <div id="auto-panel" class="tavern-hud-panel"></div>
   ${gameMenuEnabled ? `<div id="hud-menu-panel" class="tavern-hud-panel" popover="auto" aria-label="Game menu">
     <button id="menu-rules" type="button" aria-label="Game Rules">${hudIcon("info")} Info</button>
     <button id="menu-share" type="button">${hudIcon("share")} Share</button>
     <label><span id="effects-icon">${hudIcon("effects-muted")}</span><input id="effects-volume" type="range" min="0" max="100" aria-label="Sound effects volume"></label>
     <label><span id="music-icon">${hudIcon("music-muted")}</span><input id="music-volume" type="range" min="0" max="100" aria-label="Music volume"></label>
   </div>` : ""}
  </section>
 </main>
 <dialog id="dialog" class="tavern-dialog"><div class="modal-inner"><button class="close-modal" aria-label="Close dialog">×</button><div id="modal-content"></div></div></dialog>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  $("game-title").textContent = game.title;
  const scene = game.presentation.scene;
  const stage = root.querySelector<HTMLElement>(".stage")!;
  if (scene) applySceneLayers(stage, scene.layers);
  const audioReady = loadTavernAudio();
  const showLoadingError = () => {
    $("status").textContent = "Could not load the game. Reload to try again.";
    const boardLoading = $("loading");
    if (boardLoading) boardLoading.textContent = "Reload to retry";
    loader?.fail();
  };
  let symbols;
  try {
    symbols = await loadTavernSymbols();
    loader?.update(2, 4);
  } catch {
    showLoadingError();
    return;
  }
  const audio = await audioReady;
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
    mount,
  } = createSlotSession(game, new HttpTransport(game.routing.apiBase), symbols, localStorage);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let overlayMascot: Awaited<ReturnType<typeof mountMascot>> | undefined;
  let overlayMount: Promise<void> | undefined;
  let mascotAnchor: SceneAnchor | undefined;
  let overlayVisible = false;
  function placeOverlayMascot(anchor?: SceneAnchor | null) {
    const visible = anchor !== null;
    if (anchor) mascotAnchor = anchor;
    if (overlayMascot) {
      if (visible !== overlayVisible) overlayMascot.setActive(visible);
      if (visible && mascotAnchor) overlayMascot.place(mascotAnchor);
    }
    overlayVisible = visible;
    if (visible && !overlayMount) {
      overlayMount = mountMascot($("mascot")).then((mounted) => {
        overlayMascot = mounted;
        if (mascotAnchor) mounted.place(mascotAnchor);
        mounted.setActive(overlayVisible);
      }).catch((error) => console.warn("Tavern mascot unavailable", error));
    }
  }
  const reelMotion: ReelMotion = game.presentation.spinType;
  let betIndex = game.bets.indexOf(game.defaultBet),
    chance: Chance = "standard",
    turbo = false,
    autoRemaining = 0,
    skipped = false,
    autoTimer: ReturnType<typeof setTimeout> | null = null;
  let displayWin = 0;
  let lastShareableWin: { amount: number; bet: number } | undefined;
  let payline: ReturnType<typeof createTavernPayline>;
  let effects: Awaited<ReturnType<typeof mountTavernEffects>> | undefined;
  function celebrate() {
    if (overlayVisible) overlayMascot?.win();
    effects?.celebrateMascot();
  }
  const effectsReady = reducedMotion ? Promise.resolve(undefined) : mountTavernEffects(
    stage,
    root.querySelector<HTMLElement>(".frame-art")!,
    $("board"),
    $("scene-table"),
    scene,
    placeOverlayMascot,
  ).catch((error) => {
    console.warn("Tavern scene animations unavailable", error);
    return undefined;
  });
  const paylineAssets = Promise.allSettled([
    reducedMotion ? Promise.resolve() : loadReelhouse(),
    loadTavernBitmapFonts(),
  ]);
  let presentingFeature: FeatureState | null = null;
  let presentingBet = game.bets[betIndex];
  const dialog = $<HTMLDialogElement>("dialog");
  const autoPicker = mountRoundPicker(
    $("auto-panel"), $<HTMLButtonElement>("auto"), controls?.autoRounds ?? [10, 25, 50],
    (round) => {
      if (controller.phase !== "ready" || controller.state?.feature) return;
      autoRemaining = round;
      sync();
      if (round) void run("spin");
    },
  );
  const featureIcon = hudIcon("feature-buy");
  const keyArt = artRegion("key", "key-art");
  const status = (text: string) => {
    $("status").textContent = text;
  };
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
    $("bet").textContent = money(
      feature
        ? (state?.round?.bet ?? presentingBet)
        : bet * game.demo.chancePrices[chance],
    );
    const mode = feature?.mode || "base";
    root.querySelector<HTMLElement>(".game-shell")!.dataset.mode = mode;
    $("free-spins").hidden = !feature;
    $("feature-progress").textContent = String(feature?.remaining ?? 0);
    syncBonusArt(feature);
    effects?.sync(feature ?? null);
    $("buy").innerHTML =
      chance === "standard" || feature ? featureIcon : "Disable";
    $("buy").setAttribute(
      "aria-label",
      chance === "standard" || feature ? "Feature buy" : "Disable chance",
    );
    $("win-value").hidden = !feature && displayWin === 0;
    $("win-label").textContent = feature ? "Total win" : "Win";
    $("win-amount").textContent = money(feature?.accumulated ?? displayWin);
    $<HTMLButtonElement>("auto").disabled = !!feature;
    const betLocked = busy || !!feature;
    $<HTMLButtonElement>("buy").disabled = betLocked;
    $<HTMLButtonElement>("bet-down").disabled = betLocked || betIndex === 0;
    $<HTMLButtonElement>("bet-up").disabled = betLocked || betIndex === game.bets.length - 1;
    $<HTMLButtonElement>("spin").disabled =
      nextFreeSpin ||
      controller.phase === "loading" ||
      controller.phase === "recovery";
    $("spin").classList.toggle(
      "spinning",
      busy && controller.phase !== "recovery",
    );
    const skip = busy || nextFreeSpin;
    $("spin").innerHTML = `${skip ? hudIcon(nextFreeSpin ? "skip" : "stop") : hudIcon("spin") + hudIcon("autoplay-ready")}<small class="visually-hidden">${skip ? "SKIP" : "SPIN"}</small>`;
    $("auto").innerHTML = autoRemaining ? String(autoRemaining) : hudIcon("autoplay");
    $("auto").setAttribute("aria-pressed", String(autoRemaining > 0));
    $("auto").setAttribute(
      "aria-label",
      autoRemaining ? "Stop autoplay" : "Autoplay",
    );
    $("speed").setAttribute("aria-pressed", String(turbo));
    $("sound").setAttribute("aria-pressed", String(!audio.muted));
  }
  function modal(content: string, dismissible = true, look = "") {
    dialog.dataset.look = look;
    $("modal-content").innerHTML = content;
    $<HTMLButtonElement>("dialog").querySelector<HTMLButtonElement>(
      ".close-modal",
    )!.hidden = !dismissible;
    if (!dialog.open) dialog.showModal();
  }
  dialog
    .querySelector(".close-modal")!
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (dialog.querySelector<HTMLButtonElement>(".close-modal")!.hidden)
      event.preventDefault();
  });
  dialog.addEventListener("close", scheduleNextSpin);
  const winTier = (amount: number, bet: number) =>
    game.demo.winTiers.filter((tier) => amount >= bet * tier.multiplier).at(-1);
  const winAnimation = (label: string) =>
    label === "NICE WIN" ? "smallwin" : label.toLowerCase().replace(/\s/g, "");
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  async function showWinCelebration(label: string, text: string, clip: string) {
    audio.cue(clip);
    const overlay = document.createElement("div");
    overlay.className = "win-celebration";
    overlay.setAttribute("role", "status");
    const title = document.createElement("strong");
    title.textContent = label;
    const value = document.createElement("span");
    value.className = "win-celebration-value";
    renderAmount(value, text, "td_gold");
    const art = document.createElement("div");
    art.className = "tavern-screen-art";
    overlay.append(title, art, value);
    root.append(overlay);
    if (effects) {
      await effects.showScreen(art, clip, { amount: clip === "addfs" ? undefined : text });
      await effects.endScreen();
    } else {
      await delay(900);
    }
    overlay.remove();
  }
  function clearSpinTimer() {
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = null;
  }
  function stopAuto() {
    autoPicker.close();
    autoRemaining = 0;
    clearSpinTimer();
    sync();
  }
  function scheduleNextSpin() {
    const feature = controller.state?.feature;
    if (
      autoTimer !== null ||
      dialog.open ||
      controller.phase !== "ready" ||
      !(feature?.remaining || autoRemaining)
    )
      return;
    const delay = turbo ? 357 : feature?.played === 0 ? 1400 : 900;
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (!dialog.open && controller.phase === "ready") void run("spin");
    }, nextSpinDelay(delay));
  }
  async function present(outcome: Outcome) {
    presentingBet = outcome.bet;
    presentingFeature = outcome.entry
      ? null
      : (outcome.finalFeature ?? outcome.state.feature);
    let scatterLanded = 0;
    await view.stop(outcome.state.board, effects?.playSceneEffects, {
      reel: (reel) => audio.cue(`reel${reel}`),
      symbol: (id) => {
        if (id === game.presentation.drop.anticipation?.symbolId)
          audio.cue(`scatter${Math.min(scatterLanded++, 3)}`);
      },
      anticipation: (active) => active ? audio.cue("anticipation", true) : audio.stop("anticipation"),
    });
    const scatter =
      outcome.entry || outcome.retrigger
        ? outcome.state.board.flatMap((column, reel) =>
            column.flatMap((id, row) =>
              id === "bonus" ? [{ reel, row }] : [],
            ),
          )
        : [];
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
      if (scatter.length && (outcome.entry || !skipped))
        await view.focusWins(scatter);
      view.clearHighlight();
    };
    const from = performance.now();
    const countWin = new Promise<void>((resolve) => {
      const tick = () => {
        const t = skipped
          ? 1
          : Math.min(1, (performance.now() - from) / (turbo ? 179 : 650));
        displayWin = Math.round(outcome.spinWin * (1 - (1 - t) ** 3));
        const shown = presentingFeature
          ? presentingFeature.accumulated - outcome.spinWin + displayWin
          : displayWin;
        $("win-value").hidden = !presentingFeature && shown === 0;
        $("win-amount").textContent = money(shown);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
    await Promise.all([animateWins(), countWin]);
    if (outcome.wins.length) {
      celebrate();
      status(
        `${outcome.wins.length} WINNING ${outcome.wins.length === 1 ? "LINE" : "LINES"} · ${money(outcome.spinWin)}`,
      );
    } else status("");
    if (outcome.retrigger) {
      audio.cue("retrigger");
      status(`RETRIGGER · +${outcome.retrigger} FREE SPINS`);
      effects?.shake();
      await showWinCelebration("Retrigger", `+${outcome.retrigger} Free Spins`, "addfs");
    }
    const tier = winTier(outcome.spinWin, outcome.bet);
    if (outcome.entry) {
      stopAuto();
      audio.cue("entry");
      prepareFeatureEntry();
      await effects?.prepareBonusIntro();
      modal(
        `<div class="tavern-screen-art"></div>
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
      await new Promise<void>((resolve) => {
        $<HTMLButtonElement>("continue").onclick = async (event) => {
          (event.currentTarget as HTMLButtonElement).disabled = true;
          await effects?.endScreen(bonusClip + "_outro");
          dialog.close();
          resolve();
        };
      });
      presentingFeature = outcome.state.feature;
      sync();
      audio.cue("entryEnd");
      syncMusic(true);
    }
    if (outcome.completion) {
      stopAuto();
      await waitBeforeFeatureResult();
      const c = outcome.completion;
      const chests = outcome.finalFeature?.chests ?? [];
      const unlocked = chests.map((chest, reel) => ({ chest, reel }))
        .filter(({ chest }) => chest.unlocked && chest.multiplier != null);
      if (unlocked.length) {
        if (music) audio.stop(music);
        music = "";
        audio.cue("chestIntro");
        await effects?.revealChests();
        modal(
          `<h2 class="visually-hidden">Chest multipliers</h2>
          <strong class="result-total bonus-paid" aria-live="polite">${money(c.accumulated)}</strong>
          <div class="reveal-chests">${chests.map((chest, reel) => chestMarkup(chest, reel)).join("")}<div class="tavern-chest-art"></div></div>`,
          false,
          "chest",
        );
        const result = dialog.querySelector<HTMLElement>(".result-total")!;
        const container = dialog.querySelector(".reveal-chests")!;
        const art = container.querySelector<HTMLElement>(".tavern-chest-art")!;
        const setAmount = (value: number) => renderAmount(result, money(value), "td_gold");
        setAmount(c.accumulated);
        for (const [index, { chest, reel }] of unlocked.entries()) {
          const closed = container.children[reel] as HTMLElement;
          if (effects) closed.dataset.spineChest = "true";
          audio.cue(`chest${Math.min(index, 3)}`);
          await effects?.openChest(art, reel);
          closed.outerHTML = chestMarkup(chest, reel, true);
          const opened = container.children[reel] as HTMLElement;
          if (effects) opened.dataset.spineChest = "true";
          renderAmount(opened.querySelector<HTMLElement>(".chest-multiplier")!, `×${chest.multiplier}`, "td_gold");
        }
        let runningAmount = c.accumulated;
        for (const [index, { chest, reel }] of unlocked.entries()) {
          const multiplier = container.children[reel].querySelector<HTMLElement>(".chest-multiplier")!;
          const nextAmount = Math.min(runningAmount * chest.multiplier!, c.featureAward);
          audio.cue(`multiplier${index}`);
          const animation = effects?.finishChest(reel);
          await flyPayout(multiplier, result, 500);
          multiplier.style.visibility = "hidden";
          if (runningAmount !== nextAmount) audio.cue("count");
          await countPayout(runningAmount, nextAmount, 420, setAmount);
          audio.stop("count");
          if (runningAmount !== nextAmount) audio.cue("countEnd");
          await animation;
          runningAmount = nextAmount;
        }
        setAmount(c.featureAward);
        await effects?.endScreen();
        dialog.close();
        for (const tier of game.demo.winTiers) {
          const clip = winAnimation(tier.label);
          if (["bigwin", "superwin", "megawin", "epicwin"].includes(clip) &&
              c.featureAward >= outcome.bet * tier.multiplier)
            await showWinCelebration(tier.label, money(c.featureAward), clip);
        }
        if (c.capped) await showWinCelebration("MAX WIN", money(c.featureAward), "maxwin");
      }
      await effects?.prepareTotalWin();
      view.hideSymbols();
      $("chests").hidden = true;
      modal(
        `<div class="tavern-screen-art"></div>
        <h2>${artRegion("totalWin", "total-win-art")}<span class="visually-hidden">Total Win</span></h2>
        <strong class="result-total bonus-paid" aria-live="polite">${money(c.featureAward)}</strong>
        <button id="continue" class="scene-continue">Press to continue</button>`,
        false,
        "bonus",
      );
      const amount = money(c.featureAward);
      renderAmount(dialog.querySelector<HTMLElement>(".result-total")!, amount, "td_gold");
      audio.cue("totalIntro");
      const resultArt = dialog.querySelector<HTMLElement>(".tavern-screen-art")!;
      const enter = effects?.showScreen(resultArt, "total_win_start", {
        amount, idle: "total_win_idle", outro: "total_win_end",
      });
      await new Promise<void>((resolve) => {
        const button = $<HTMLButtonElement>("continue");
        const hold = game.presentation.feature?.totalWinHoldMs;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const close = async () => {
          if (button.disabled) return;
          button.disabled = true;
          clearTimeout(timer);
          await enter;
          audio.cue("totalOutro");
          await effects?.endScreen("total_win_end");
          dialog.close();
          resolve();
        };
        button.onclick = () => void close();
        if (hold) void Promise.resolve(enter).then(() => {
          if (!button.disabled) timer = setTimeout(() => void close(), hold);
        });
      });
      view.setBoard(outcome.state.board);
      displayWin = c.roundAward;
    } else if (outcome.capped) {
      stopAuto();
      status("MAX WIN · " + money(outcome.paidAward));
      await showWinCelebration("MAX WIN", money(outcome.paidAward), "maxwin");
    } else if (tier && !outcome.entry) {
      status(tier.label + " · " + money(outcome.spinWin));
      await showWinCelebration(tier.label, money(outcome.spinWin), winAnimation(tier.label));
    }
    if (outcome.paidAward > 0 && !outcome.state.feature)
      lastShareableWin = { amount: outcome.completion?.roundAward ?? outcome.paidAward, bet: outcome.bet };
    controller.completePresentation();
    if (autoRemaining) autoRemaining--;
    sync();
    syncMusic(!!controller.state?.feature);
    scheduleNextSpin();
  }
  async function run(
    action: "spin" | "buy-tavern" | "buy-drop",
    recover = false,
  ) {
    if (!recover && controller.phase !== "ready") {
      skipped = true;
      view.skip();
      effects?.skip();
      return;
    }
    clearSpinTimer();
    audio.unlock();
    skipped = false;
    view.start(turbo, reelMotion);
    effects?.spin();
    audio.cue("start");
    status(
      recover
        ? "Recovering the pending result…"
        : reelMotion === "drop"
          ? ""
          : "The reels are turning…",
    );
    const work = recover
      ? controller.recover()
      : controller.execute({
          action,
          bet: controller.state?.round?.bet || game.bets[betIndex],
          chance: controller.state?.feature ? "standard" : chance,
        });
    sync();
    try {
      await present(await work);
    } catch (error) {
      stopAuto();
      if (controller.state) {
        view.setBoard(controller.state.board);
        if (controller.state.feature?.played === 0) prepareFeatureEntry();
      }
      const pending = controller.phase === "recovery";
      status(
        pending
          ? "Connection interrupted. Your request is saved."
          : "Request declined. No new spin is running.",
      );
      modal(
        `<span class="eyebrow">${pending ? "PENDING ROUND" : "REQUEST DECLINED"}</span><h2>${pending ? "Recover your result" : "Please try again"}</h2><p>${pending ? "Retry retrieves the same request without placing another bet." : error instanceof Error ? error.message : "Server unavailable"}</p><button id="retry" class="primary">${pending ? "RECOVER RESULT" : "CONTINUE"}</button>`,
        false,
      );
      $("retry").onclick = () => {
        dialog.close();
        if (pending) void run("spin", true);
      };
      sync();
    }
  }
  $("spin").onclick = () => void run("spin");
  $("bet-down").onclick = () => {
    audio.cue("bet");
    betIndex = Math.max(0, betIndex - 1);
    sync();
  };
  $("bet-up").onclick = () => {
    audio.cue("bet");
    betIndex = Math.min(game.bets.length - 1, betIndex + 1);
    sync();
  };
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
    if (autoRemaining) {
      stopAuto();
      return;
    }
    if (controller.phase !== "ready" || controller.state?.feature) return;
    audio.cue("click");
    autoPicker.toggle(0);
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
     <span class="shop-bolts" aria-hidden="true">${"ϟ".repeat(option.bolts)}<i>${"ϟ".repeat(5 - option.bolts)}</i></span>`;
  function openShop() {
    modal(
      `<h2 class="visually-hidden">Feature buy</h2>
      <div class="shop-grid">${shopOptions
        .map(
          (option) => `
        <button data-${option.kind}="${option.id}" class="shop-card ${option.kind}">
          ${shopArt(option)}
          <strong>${option.title}</strong>
          <b>${money(shopPrice(option))}</b>
          <span class="shop-action">${option.kind === "chance" ? "Activate" : "Buy"}</span>
        </button>`,
        )
        .join("")}</div>
      <div class="shop-bet">
        <div class="hud-money"><span>Balance</span><strong>${money(controller.state!.balance)}</strong></div>
        <button id="shop-bet-down" aria-label="Decrease feature bet" ${betIndex === 0 ? "disabled" : ""}>${hudIcon("bet-down")}</button>
        <div class="hud-money"><span>Bet</span><strong>${money(game.bets[betIndex])}</strong></div>
        <button id="shop-bet-up" aria-label="Increase feature bet" ${betIndex === game.bets.length - 1 ? "disabled" : ""}>${hudIcon("bet-up")}</button>
      </div>`,
      true,
      "shop",
    );
    $("shop-bet-down").onclick = () => {
      betIndex--;
      sync();
      openShop();
      $("shop-bet-down").focus();
    };
    $("shop-bet-up").onclick = () => {
      betIndex++;
      sync();
      openShop();
      $("shop-bet-up").focus();
    };
    for (const option of shopOptions) {
      dialog.querySelector<HTMLButtonElement>(
        `[data-${option.kind}="${option.id}"]`,
      )!.onclick = () => confirmFeature(option);
    }
  }
  function confirmFeature(option: ShopOption) {
    const summary =
      option.kind === "chance"
        ? "Increase the chance of triggering a bonus on each spin."
        : `Enter the bonus with ${game.demo.featureSpins[option.id]} free spins and unlock chest multipliers.`;
    modal(
      `<div class="shop-card shop-confirm">
        ${shopArt(option)}<h2>${option.title}</h2><p>${summary}</p>
        <b>${money(shopPrice(option))}</b>
        <button id="confirm-buy" class="shop-action">Confirm</button>
      </div>`,
      true,
      "shop-confirm",
    );
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
          ? `<strong>Win $${money(win.amount)}</strong><p>Bet $${money(win.bet)}</p><button id="copy-win" type="button">Copy result</button>`
          : "<strong>Nothing to share yet</strong><p>Play a round and your cards show up here.</p>"}</div>`,
        true, "share",
      );
      if (win) $("copy-win").onclick = async () => {
        const button = $("copy-win");
        try {
          await navigator.clipboard.writeText(`Tavern Drop · Win $${money(win.amount)} · Bet $${money(win.bet)}`);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Clipboard unavailable";
        }
      };
    };
  }
  dialog.addEventListener("cancel", (event) => {
    if (dialog.querySelector<HTMLButtonElement>(".close-modal")!.hidden)
      event.preventDefault();
  });
  window.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !dialog.open &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      $<HTMLButtonElement>("spin").click();
    }
  });
  try {
    await mount($("board"));
    loader?.update(3, 4);
    view.app.ticker.maxFPS = 45;
    const [reelhouse, fonts] = await paylineAssets;
    const nativePayline = !reducedMotion && reelhouse.status === "fulfilled"
      ? createReelhouse(view.app) : undefined;
    payline = createTavernPayline(view.app.stage, game, nativePayline, fonts.status === "fulfilled");
    effects = await effectsReady;
    if (!effects && !reducedMotion) placeOverlayMascot();
    $("loading").remove();
    const openingKey = game.id + ".opening";
    if (
      effects && controller.phase === "ready" && !controller.state?.feature &&
      !sessionStorage.getItem(openingKey)
    ) {
      const shell = root.querySelector<HTMLElement>(".game-shell")!;
      const opening = document.createElement("button");
      const openingTerms = document.createElement("span");
      opening.type = "button";
      opening.className = "opening-continue";
      opening.textContent = "Press to continue";
      openingTerms.className = "opening-terms";
      openingTerms.textContent = `Demo max ${game.demo.capMultiplier.toLocaleString("en-US")}×`;
      shell.dataset.opening = "true";
      shell.append(openingTerms, opening);
      effects.showOpening();
      loader?.ready();
      await new Promise<void>((resolve) => {
        opening.addEventListener("click", () => resolve(), { once: true });
      });
      opening.remove();
      openingTerms.remove();
      sessionStorage.setItem(openingKey, "seen");
      await effects.enterGame();
      delete shell.dataset.opening;
    } else loader?.ready();
    sync();
    if (controller.phase === "recovery") {
      modal(
        '<h2>Pending round found</h2><p>Retrieve the saved result before placing another bet.</p><button id="recover" class="primary">RECOVER RESULT</button>',
        false,
      );
      $("recover").onclick = () => {
        dialog.close();
        void run("spin", true);
      };
    } else {
      status("Choose your bet. Your next story starts here.");
      scheduleNextSpin();
    }
  } catch {
    showLoadingError();
  }
}
