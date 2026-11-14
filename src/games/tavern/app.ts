import { tavern as game } from "./definition.ts";
import { GameController } from "../../framework/controller.ts";
import { HttpTransport } from "../../framework/transport/http.ts";
import { tavernSymbolFactory } from "./skin.ts";
import { BoardView } from "../../framework/presentation/board.ts";
import { AudioBus } from "../../framework/presentation/audio.ts";
import type {
  Chance,
  Chest,
  Outcome,
} from "../../framework/domain/contracts.ts";

const money = (n: number) =>
  (n / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `
 <main class="game-shell" data-mode="base">
  <header class="topbar"><span class="studio">BLACKWOLF <small>SLOT TEMPLATE</small></span><span class="build-note">DEMO · RULES AWAITING REFERENCE REVIEW</span><button id="menu" class="icon-button" aria-label="Open menu">☰</button></header>
  <section class="stage">
   <div class="lantern lantern-left"></div><div class="lantern lantern-right"></div>
   <div class="brand"><span class="brand-top">THE</span><h1>TAVERN <span>DROP</span></h1><p id="mode-label">A LITTLE LUCK. A LITTLE GOLD.</p></div>
   <div class="feature-bar"><span id="mode-badge">BASE GAME</span><span id="feature-progress">15 FIXED PAYLINES</span><span id="feature-total">5 REELS · 5 ROWS</span></div>
   <div class="machine"><div class="chest-row" id="chests"></div><div class="reel-frame"><div class="reel-host" id="board"></div><div class="board-loading" id="loading">Lighting the tavern…</div></div></div>
   <div class="win-strip"><span id="status" role="status" aria-live="polite">Connecting to demo server…</span><strong id="win-amount">0.00</strong><span id="win-label">LAST WIN</span></div>
  </section>
  <section class="controls">
   <div class="wallet"><span>BALANCE</span><strong id="balance">—</strong><small>DEMO CREDITS</small></div>
   <div class="bet-control"><span>BET</span><div><button id="bet-down" aria-label="Decrease bet">−</button><strong id="bet">1.00</strong><button id="bet-up" aria-label="Increase bet">+</button></div></div>
   <button id="buy" class="buy-button">BONUS BUY<small>CHOOSE YOUR FEATURE</small></button>
   <button id="spin" class="spin-button" disabled aria-label="Spin">↻<small>SPIN</small></button>
   <div class="quick-controls"><button id="auto">AUTO</button><button id="speed">TURBO OFF</button><button id="sound" aria-label="Toggle sound">SOUND OFF</button></div>
  </section>
  <footer><button id="rules">RULES & PAYTABLE</button><span>ORIGINAL PLACEHOLDER ART · NO REAL MONEY</span><button id="chance">STANDARD CHANCE</button></footer>
 </main>
 <dialog id="dialog"><div class="modal-inner"><button class="close-modal" aria-label="Close dialog">×</button><div id="modal-content"></div></div></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const controller = new GameController(
    new HttpTransport(),
    localStorage,
    game.id + ".pending",
  ),
  view = new BoardView(game, tavernSymbolFactory(game)),
  audio = new AudioBus();
let betIndex = 2,
  chance: Chance = "standard",
  turbo = false,
  autoRemaining = 0,
  skipped = false,
  autoTimer: ReturnType<typeof setTimeout> | null = null;
let displayWin = 0;
const dialog = $<HTMLDialogElement>("dialog");
const status = (text: string) => {
  $("status").textContent = text;
};
function chestMarkup(chests: Chest[] | undefined) {
  return Array.from({ length: 5 }, (_, i) => {
    const c = chests?.[i];
    return `<div class="chest ${c?.unlocked ? "unlocked" : ""}"><div class="chest-lid"></div><div class="chest-body"><span>${c?.multiplier && c.multiplier > 1 ? "×" + c.multiplier : c?.unlocked ? "✦" : "◆"}</span></div><div class="chest-dots">${Array.from({ length: 5 }, (_, r) => `<i class="${c?.rows.includes(r) ? "filled" : ""}"></i>`).join("")}</div><small>${c ? c.rows.length + "/5" : "REEL " + (i + 1)}</small></div>`;
  }).join("");
}
function sync(chests?: Chest[]) {
  const state = controller.state,
    feature = state?.feature,
    busy = controller.phase !== "ready";
  $("balance").textContent = state ? money(state.balance) : "—";
  $("bet").textContent = money(
    feature ? state!.round!.bet : game.bets[betIndex],
  );
  const mode = feature?.mode || "base";
  document.querySelector<HTMLElement>(".game-shell")!.dataset.mode = mode;
  $("mode-badge").textContent =
    mode === "base" ? "BASE GAME" : mode.toUpperCase() + " BONUS";
  $("mode-label").textContent =
    mode === "base"
      ? "A LITTLE LUCK. A LITTLE GOLD."
      : mode === "drop"
        ? "DEEPER INTO THE VAULT"
        : "FILL THE CHESTS. KEEP THE GOLD.";
  $("feature-progress").textContent = feature
    ? `${feature.remaining} FREE SPINS LEFT · ${feature.played} PLAYED`
    : "15 FIXED PAYLINES";
  $("feature-total").textContent = feature
    ? "COLLECTED " + money(feature.accumulated)
    : "5 REELS · 5 ROWS";
  $("chests").innerHTML = chestMarkup(chests || feature?.chests);
  for (const id of ["buy", "bet-down", "bet-up", "chance"])
    $<HTMLButtonElement>(id).disabled = busy || !!feature;
  $<HTMLButtonElement>("spin").disabled =
    controller.phase === "loading" || controller.phase === "recovery";
  $("spin").classList.toggle(
    "spinning",
    busy && controller.phase !== "recovery",
  );
  $("spin").innerHTML = busy ? "■<small>SKIP</small>" : "↻<small>SPIN</small>";
  $("auto").textContent = autoRemaining
    ? "STOP AUTO (" + autoRemaining + ")"
    : "AUTO";
  $("speed").textContent = turbo ? "TURBO ON" : "TURBO OFF";
  $("sound").textContent = audio.muted ? "SOUND OFF" : "SOUND ON";
  $("chance").textContent =
    chance.toUpperCase() +
    " CHANCE · " +
    game.demo.chancePrices[chance] +
    "× BET";
}
function modal(content: string, dismissible = true) {
  $("modal-content").innerHTML = content;
  $<HTMLButtonElement>("dialog").querySelector<HTMLButtonElement>(
    ".close-modal",
  )!.hidden = !dismissible;
  if (!dialog.open) dialog.showModal();
}
dialog
  .querySelector(".close-modal")!
  .addEventListener("click", () => dialog.close());
function stopAuto() {
  autoRemaining = 0;
  if (autoTimer) clearTimeout(autoTimer);
  sync();
}
async function present(outcome: Outcome) {
  await view.stop(outcome.state.board);
  audio.cue("stop");
  view.highlight(outcome.wins);
  sync(outcome.finalFeature?.chests);
  await view.collect(outcome.collected);
  const from = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = skipped
        ? 1
        : Math.min(1, (performance.now() - from) / (turbo ? 100 : 650));
      displayWin = Math.round(outcome.spinWin * (1 - (1 - t) ** 3));
      $("win-amount").textContent = money(displayWin);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });
  if (outcome.wins.length) {
    audio.cue("win");
    status(
      `${outcome.wins.length} WINNING ${outcome.wins.length === 1 ? "LINE" : "LINES"} · ${money(outcome.spinWin)}`,
    );
  } else status("No line win. The next story is one spin away.");
  if (outcome.retrigger) status(`RETRIGGER · +${outcome.retrigger} FREE SPINS`);
  const tier = game.demo.winTiers
    .filter((t) => outcome.spinWin >= outcome.bet * t.multiplier)
    .at(-1);
  if (outcome.entry) {
    stopAuto();
    audio.cue("entry");
    modal(
      `<span class="eyebrow">FEATURE UNLOCKED</span><h2>${outcome.entry.toUpperCase()} BONUS</h2><p>${outcome.state.feature!.remaining} free spins. Collect distinct winning rows to unlock each reel’s chest.</p><p class="muted">Demo feature rules; reference review pending.</p><button id="continue" class="primary">ENTER THE TAVERN</button>`,
      false,
    );
    await new Promise<void>((resolve) => {
      $("continue").onclick = () => {
        dialog.close();
        resolve();
      };
    });
  }
  if (outcome.completion) {
    stopAuto();
    const c = outcome.completion;
    modal(
      `<span class="eyebrow">BONUS COMPLETE</span><h2>${c.capped ? "MAX WIN" : "YOUR TREASURE"}</h2><div class="multiplier-reveal">${c.multipliers.map((m) => `<span>×${m}</span>`).join("")}</div><p>${money(c.accumulated)} × ${c.product}</p><strong class="result-total">${money(c.featureAward)}</strong><p>FEATURE AWARD · ROUND TOTAL ${money(c.roundAward)}</p><p class="muted">Amounts confirmed by the demo server${c.capped ? " · round cap reached" : ""}.</p><button id="continue" class="primary">COLLECT</button>`,
      false,
    );
    await new Promise<void>((resolve) => {
      $("continue").onclick = () => {
        dialog.close();
        resolve();
      };
    });
  } else if (outcome.capped) {
    stopAuto();
    status("MAX WIN · " + money(outcome.paidAward));
  } else if (tier && !outcome.entry) {
    status(tier.label + " · " + money(outcome.spinWin));
  }
  controller.completePresentation();
  sync(outcome.finalFeature?.chests);
  if (autoRemaining) {
    autoRemaining--;
    sync();
    if (autoRemaining)
      autoTimer = setTimeout(() => void run("spin"), turbo ? 200 : 900);
  }
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
  audio.unlock();
  skipped = false;
  view.start(turbo);
  status(recover ? "Recovering the pending result…" : "The reels are turning…");
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
  if (turbo) view.skip();
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
  if (controller.phase !== "ready") return;
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
$("buy").onclick = () => {
  if (controller.phase !== "ready" || controller.state?.feature) return;
  stopAuto();
  modal(
    `<span class="eyebrow">BONUS BUY</span><h2>Choose your adventure</h2><p class="muted">Demo prices. No real-money purchase.</p><div class="bonus-cards">${(["tavern", "drop"] as const).map((mode) => `<button data-buy="${mode}" class="bonus-card ${mode}"><span class="chest-symbol">${mode === "tavern" ? "♜" : "✦"}</span><strong>${mode.toUpperCase()} BONUS</strong><span>${game.demo.featureSpins[mode]} FREE SPINS</span><b>${money(game.bets[betIndex] * game.demo.buyPrices[mode])}</b><small>${game.demo.buyPrices[mode]}× BET · DEMO</small></button>`).join("")}</div>`,
  );
  dialog.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach(
    (button) =>
      (button.onclick = () => {
        const mode = button.dataset.buy as "tavern" | "drop";
        modal(
          `<span class="eyebrow">CONFIRM BONUS BUY</span><h2>${mode.toUpperCase()} BONUS</h2><p>Deduct <strong>${money(game.bets[betIndex] * game.demo.buyPrices[mode])}</strong> demo credits?</p><p class="muted">Demo prices and feature rules have not been matched to the reference game.</p><button id="confirm-buy" class="primary">CONFIRM PURCHASE</button>`,
        );
        $("confirm-buy").onclick = () => {
          dialog.close();
          void run(mode === "tavern" ? "buy-tavern" : "buy-drop");
        };
      }),
  );
};
$("chance").onclick = () => {
  modal(
    `<span class="eyebrow">CHANCE OPTIONS</span><h2>Set your chance</h2><p class="muted">Demo only: provisional prices and bonus-symbol rates. Not reference math.</p><div class="option-row">${(["standard", "extra", "super"] as const).map((c) => `<button data-chance="${c}">${c.toUpperCase()}<small>${game.demo.chancePrices[c]}× BET</small></button>`).join("")}</div>`,
  );
  dialog.querySelectorAll<HTMLButtonElement>("[data-chance]").forEach(
    (b) =>
      (b.onclick = () => {
        chance = b.dataset.chance as Chance;
        dialog.close();
        sync();
      }),
  );
};
function rules() {
  modal(
    `<span class="eyebrow">TEMPLATE RULES · PROVISIONAL MATH</span><h2>Inside the tavern</h2><p>5 reels × 5 rows. 15 illustrative fixed paylines. Matching symbols pay left to right; Wild substitutes for paying symbols. The best Wild substitution pays once per line.</p><p>Demo entry: 3 Bonus symbols start Tavern; 4+ start Drop. Each feature has its own presentation and configurable spin count. These entry rules are unverified.</p><p>During free spins, each distinct winning row fills one position on that reel’s chest. Repeated positions do not add progress. Five rows unlock a chest. At completion, unlocked chest multipliers multiply together and apply to accumulated feature wins. A server-side cap limits the full paid round.</p><div class="paytable">${game.symbols
      .filter((s) => s.kind !== "bonus")
      .map(
        (s) =>
          `<div><b style="color:${s.color}">${s.label}</b><span>3: ${(s.pays[3] || 0) / 100}×</span><span>4: ${(s.pays[4] || 0) / 100}×</span><span>5: ${(s.pays[5] || 0) / 100}×</span></div>`,
      )
      .join(
        "",
      )}</div><p class="muted">Every award, price, probability, line pattern and cap shown here is a development assumption. Original game Help has not been accessed. Demo sessions reset when the server restarts.</p>`,
  );
}
$("rules").onclick = rules;
$("menu").onclick = () => {
  stopAuto();
  modal(
    '<span class="eyebrow">TAVERN TEMPLATE</span><h2>Game menu</h2><button id="menu-rules" class="primary">RULES & PAYTABLE</button><p class="muted">Framework v0.2 · server mock · original placeholder art. Reference access pending.</p>',
  );
  $("menu-rules").onclick = rules;
};
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
    void run("spin");
  }
});
try {
  await view.mount($("board"));
  await controller.boot();
  view.setBoard(controller.state!.board);
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
  } else status("Choose your bet. Your next story starts here.");
} catch {
  status("Unable to start. Start the API server and reload.");
  $("loading").textContent = "Connection unavailable · reload to retry";
}
