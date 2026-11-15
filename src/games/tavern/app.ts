import "./theme.css";
import { createSlotSession } from "../../framework/session.ts";
import { HttpTransport } from "../../framework/transport/http.ts";
import { loadTavernSymbols, paytableIcon } from "./skin.ts";
import { createTavernPayline } from "./payline.ts";
import { artRegion, tavernAsset as asset } from "./art.ts";
import { assetUrl } from "../../framework/presentation/assets.ts";
import { AudioBus } from "../../framework/presentation/audio.ts";
import type {
  Chance,
  Chest,
  FeatureState,
  GameDefinition,
  Outcome,
  ReelMotion,
} from "../../framework/domain/contracts.ts";

const gameMenuEnabled = false;

const money = (n: number) =>
  (n / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export async function mountTavern(root: HTMLElement, game: GameDefinition) {
  root.innerHTML = `
 <main class="game-shell tavern-shell" data-mode="base">
  <header class="tavern-top">
    <span><span id="game-title"></span> <small>Demo</small></span>
    ${import.meta.env.DEV ? '<a class="assets-link" href="./asset-viewer/index.html">Assets</a>' : ""}
  </header>
  <section class="stage">
   <div class="scenery" aria-hidden="true">
     ${artRegion("base", "backdrop base-art")}
     ${artRegion("cellar", "backdrop bonus-art")}
     ${artRegion("barrel", "barrel base-art")}
     ${artRegion("cellarBarrels", "backdrop bonus-art")}
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
   <button id="buy" class="feature-button" aria-label="Feature buy"><img src="${assetUrl("tavern-assets/favicon.png")}" alt=""></button>
   <div class="hud-bar">
    ${gameMenuEnabled ? '<button id="menu" class="hud-menu" aria-label="Open menu">☰</button>' : ""}
    <div class="hud-money"><span>Balance</span><strong id="balance">—</strong></div>
    <div class="hud-money win-value" id="win-value" hidden><span id="win-label">Win</span><strong id="win-amount">0.00</strong></div>
    <div id="free-spins" hidden><span>Free spins</span> <strong id="feature-progress">0</strong></div>
    <div class="hud-bet">
     <div class="hud-money"><span id="bet-label">Bet</span><strong id="bet">1.00</strong></div>
     <div class="bet-arrows"><button id="bet-up" aria-label="Increase bet">⌃</button><button id="bet-down" aria-label="Decrease bet">⌄</button></div>
    </div>
    <button id="spin" class="spin-button" disabled aria-label="Spin">↻<small>SPIN</small></button>
    <div class="hud-quick"><button id="auto" aria-label="Autoplay">⟳</button><button id="speed" aria-label="Turbo" aria-pressed="false">ϟ</button></div>
   </div>
   <div class="hud-aux"><button id="rules" aria-label="Rules and paytable">ⓘ</button><button id="sound" aria-label="Toggle sound" aria-pressed="false">♫</button></div>
  </section>
 </main>
 <dialog id="dialog" class="tavern-dialog"><div class="modal-inner"><button class="close-modal" aria-label="Close dialog">×</button><div id="modal-content"></div></div></dialog>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  $("game-title").textContent = game.title;
  const audio = new AudioBus({
    start: assetUrl("tavern-assets/cues/start.mp3"),
    stop: assetUrl("tavern-assets/cues/stop.mp3"),
    win: assetUrl("tavern-assets/cues/win.mp3"),
    entry: assetUrl("tavern-assets/cues/entry.mp3"),
    chest: assetUrl("tavern-assets/cues/chest.mp3"),
  });
  let celebrate = () => {};
  const showLoadingError = () => {
    $("status").textContent = "Could not load the game. Reload to try again.";
    $("loading").textContent = "Reload to retry";
  };
  let symbols;
  try {
    symbols = await loadTavernSymbols();
  } catch {
    showLoadingError();
    return;
  }
  const {
    controller,
    board: view,
    mount,
  } = createSlotSession(game, new HttpTransport(game.routing.apiBase), symbols, localStorage);
  if (matchMedia("(min-width: 800px)").matches)
    void import("./mascot.ts")
      .then(({ mountMascot }) => mountMascot($("mascot")))
      .then((playWin) => {
        celebrate = playWin;
      })
      .catch((error) => console.warn("Tavern mascot unavailable", error));
  const reelMotionKey = game.id + ".reel-motion";
  let reelMotion: ReelMotion = game.presentation.spinType;
  if (gameMenuEnabled) {
    const saved = localStorage.getItem(reelMotionKey);
    if (saved === "spin" || saved === "normal") reelMotion = "normal";
    if (saved === "drop") reelMotion = "drop";
  }
  let betIndex = game.bets.indexOf(game.defaultBet),
    chance: Chance = "standard",
    turbo = false,
    autoRemaining = 0,
    skipped = false,
    autoTimer: ReturnType<typeof setTimeout> | null = null;
  let displayWin = 0;
  let payline: ReturnType<typeof createTavernPayline>;
  let presentingFeature: FeatureState | null = null;
  let presentingBet = game.bets[betIndex];
  const dialog = $<HTMLDialogElement>("dialog");
  const featureIcon = `<img src="${assetUrl("tavern-assets/favicon.png")}" alt="">`;
  const keyArt = artRegion("key", "key-art");
  const status = (text: string) => {
    $("status").textContent = text;
  };
  function chestMarkup(chest: Chest, reel: number, reveal = false) {
    const multiplier = reveal && chest.unlocked ? chest.multiplier : null;
    return `<div class="chest ${chest.unlocked ? "unlocked" : ""}" style="--reel:${reel}" aria-label="Reel ${reel + 1}, ${chest.rows.length} of ${game.rows} keys">
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
    for (const id of ["buy", "bet-down", "bet-up"])
      $<HTMLButtonElement>(id).disabled = busy || !!feature;
    $<HTMLButtonElement>("spin").disabled =
      nextFreeSpin ||
      controller.phase === "loading" ||
      controller.phase === "recovery";
    $("spin").classList.toggle(
      "spinning",
      busy && controller.phase !== "recovery",
    );
    $("spin").innerHTML = busy || nextFreeSpin
      ? "■<small>SKIP</small>"
      : "↻<small>SPIN</small>";
    $("auto").textContent = autoRemaining ? String(autoRemaining) : "⟳";
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
  dialog.addEventListener("close", scheduleNextSpin);
  function clearSpinTimer() {
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = null;
  }
  function stopAuto() {
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
    }, delay);
  }
  async function present(outcome: Outcome) {
    presentingBet = outcome.bet;
    presentingFeature = outcome.entry
      ? null
      : (outcome.finalFeature ?? outcome.state.feature);
    await view.stop(outcome.state.board);
    audio.cue("stop");
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
    await Promise.all([animateWins(), view.collect(outcome.collected), countWin]);
    if (outcome.wins.length) {
      celebrate();
      status(
        `${outcome.wins.length} WINNING ${outcome.wins.length === 1 ? "LINE" : "LINES"} · ${money(outcome.spinWin)}`,
      );
    } else status("");
    if (outcome.retrigger)
      status(`RETRIGGER · +${outcome.retrigger} FREE SPINS`);
    const tier = game.demo.winTiers
      .filter((t) => outcome.spinWin >= outcome.bet * t.multiplier)
      .at(-1);
    if (outcome.entry) {
      stopAuto();
      audio.cue("entry");
      modal(
        `<h2>${outcome.entry.toUpperCase()} BONUS</h2>
        <img class="bonus-preview" src="${asset(outcome.entry === "drop" ? "td_super.webp" : "td_bonus.webp")}" alt="">
        <strong class="free-spin-title">${outcome.state.feature!.remaining} Free Spins</strong>
        <p>Win every position on a reel to unlock its chest multiplier.</p>
        <button id="continue" class="scene-continue">Press to continue</button>`,
        false,
        "bonus",
      );
      await new Promise<void>((resolve) => {
        $("continue").onclick = () => {
          dialog.close();
          resolve();
        };
      });
      presentingFeature = outcome.state.feature;
      sync();
    }
    if (outcome.completion) {
      if (outcome.finalFeature?.chests.some((chest) => chest.unlocked))
        audio.cue("chest");
      stopAuto();
      const c = outcome.completion;
      modal(
        `<h2>${c.capped ? "Max Win" : artRegion("totalWin", "total-win-art") + '<span class="visually-hidden">Total Win</span>'}</h2>
        <p class="chest-subtotal">${money(c.accumulated)}</p>
        <div class="reveal-chests">${outcome.finalFeature?.chests.map((chest, reel) => chestMarkup(chest, reel, true)).join("") ?? ""}</div>
        <strong class="result-total bonus-paid">${money(c.featureAward)}</strong>
        <button id="continue" class="scene-continue">Press to continue</button>`,
        false,
        "bonus",
      );
      await new Promise<void>((resolve) => {
        $("continue").onclick = () => {
          dialog.close();
          resolve();
        };
      });
      displayWin = c.roundAward;
    } else if (outcome.capped) {
      stopAuto();
      status("MAX WIN · " + money(outcome.paidAward));
    } else if (tier && !outcome.entry) {
      status(tier.label + " · " + money(outcome.spinWin));
    }
    controller.completePresentation();
    if (autoRemaining) autoRemaining--;
    sync();
    scheduleNextSpin();
  }
  async function run(
    action: "spin" | "buy-tavern" | "buy-drop",
    recover = false,
  ) {
    if (!recover && controller.phase !== "ready") {
      skipped = true;
      view.skip();
      return;
    }
    clearSpinTimer();
    audio.unlock();
    skipped = false;
    view.start(turbo, reelMotion);
    audio.cue("start");
    status(
      recover
        ? "Recovering the pending result…"
        : reelMotion === "drop"
          ? "Waiting for the symbols…"
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
      if (controller.state) view.setBoard(controller.state.board);
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
    betIndex = Math.max(0, betIndex - 1);
    sync();
  };
  $("bet-up").onclick = () => {
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
    sync();
  };
  $("auto").onclick = () => {
    if (autoRemaining) {
      stopAuto();
      return;
    }
    if (controller.phase !== "ready" || controller.state?.feature) return;
    modal(
      '<span class="eyebrow">AUTOPLAY</span><h2>Choose your spins</h2><p>Stops on bonus entry, completion, insufficient balance or any connection error.</p><div class="option-row">' +
        [10, 25, 50]
          .map((n) => `<button data-auto="${n}">${n} SPINS</button>`)
          .join("") +
        "</div>",
    );
    dialog.querySelectorAll<HTMLButtonElement>("[data-auto]").forEach(
      (b) =>
        (b.onclick = () => {
          autoRemaining = Number(b.dataset.auto);
          dialog.close();
          sync();
          void run("spin");
        }),
    );
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
        <button id="shop-bet-down" aria-label="Decrease feature bet" ${betIndex === 0 ? "disabled" : ""}>⌄</button>
        <div class="hud-money"><span>Bet</span><strong>${money(game.bets[betIndex])}</strong></div>
        <button id="shop-bet-up" aria-label="Increase feature bet" ${betIndex === game.bets.length - 1 ? "disabled" : ""}>⌃</button>
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
        )}</div><p class="muted">Every award, price, probability, line pattern and cap shown here is a development assumption. Original game Help has not been accessed. Demo sessions reset when the server restarts.</p>`,
    );
  }
  $("rules").onclick = rules;
  function openMenu() {
    stopAuto();
    modal(
      `<h2>Game menu</h2>
      <label class="reel-motion-setting">
        Reel style
        <select id="reel-motion">
          <option value="drop">Drop</option>
          <option value="normal">Normal Spin</option>
        </select>
      </label>
      <button id="menu-rules" class="primary">RULES & PAYTABLE</button>`,
    );
    const motionSelect = $<HTMLSelectElement>("reel-motion");
    motionSelect.value = reelMotion;
    motionSelect.onchange = () => {
      reelMotion = motionSelect.value === "drop" ? "drop" : "normal";
      localStorage.setItem(reelMotionKey, reelMotion);
      sync();
    };
    $("menu-rules").onclick = rules;
  }
  if (gameMenuEnabled) $("menu").onclick = openMenu;
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
    payline = createTavernPayline(view.app.stage, game);
    $("loading").remove();
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
