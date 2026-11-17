import { test, expect } from "@playwright/test";
import { MockGame } from "../../server/mock-game.ts";
import { tavern } from "../../src/games/tavern/definition.ts";
import { reuse } from "../../src/games/reuse/definition.ts";
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith("real demo API")) return;
  await page.addInitScript(() => {
    const timer = setInterval(() => {
      const opening = document.querySelector<HTMLButtonElement>(".opening-continue");
      if (opening && !document.querySelector(".brand-loading")) {
        opening.click();
        clearInterval(timer);
      }
    }, 50);
  });
});

test("real demo API boots the Pixi board, spins and opens rules", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  const assetRequests = new Set<string>();
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/tavern-assets/"))
      assetRequests.add(new URL(response.url()).pathname);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
      if (this.classList.contains("brand-loading")) {
        const scene = document.querySelector(".stage[data-spine-scene]");
        document.documentElement.dataset.openingCrossfade = String(
          Boolean(scene?.querySelector("canvas") && scene.closest("[data-opening]")),
        );
      }
      return animate.apply(this, args);
    };
  });
  let releaseSession!: () => void;
  const sessionGate = new Promise<void>((resolve) => { releaseSession = resolve; });
  await page.route("**/api/session", async (route) => {
    await sessionGate;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const intro = page.locator(".brand-loading-intro");
  await expect(intro.getByRole("img", { name: "Paperclip Gaming" })).toHaveAttribute("src", /paperclip-rMFDawAD\.gif$/);
  await expect(intro).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.waitForTimeout(tavern.presentation.loadingScreen!.brandIntro!.durationMs + 100);
  await expect(intro).toBeVisible();
  await expect(page.locator(".brand-loading-game")).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Loading progress" })).toBeVisible();
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "true");
  releaseSession();
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Demo max/)).toHaveCount(0);
  await expect(page.locator(".brand-loading")).toHaveCount(0);
  await expect(page.locator(".tavern-top")).toHaveText(/^\s*\d{2}:\d{2} \| Tavern Drop\s*$/);
  await expect(page.getByRole("link", { name: "Animator Viewer" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-opening-crossfade", "true");
  const mascot = page.locator("#mascot canvas");
  await expect(mascot).toHaveCount(1);
  await expect(mascot).toBeHidden();
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".game-shell")!;
    new MutationObserver((_, observer) => {
      if (!shell.hasAttribute("data-entering")) return;
      const board = shell.querySelector("#board canvas")!;
      const hud = shell.querySelector<HTMLElement>(".tavern-hud")!;
      const mascot = shell.querySelector("#mascot")!;
      const sample = JSON.stringify({
        boardOpacity: getComputedStyle(board).opacity,
        hudFilter: getComputedStyle(hud).filter,
        hudLocked: hud.inert,
        mascotVisibility: getComputedStyle(mascot).visibility,
        mascotFilter: getComputedStyle(mascot).filter,
      });
      if (shell.dataset.entering === "before-mascot")
        document.documentElement.dataset.openingSample = sample;
      else {
        document.documentElement.dataset.openingMascot = sample;
        observer.disconnect();
      }
    }).observe(shell, { attributes: true, attributeFilter: ["data-entering"] });
  });
  await page.locator(".game-shell").click({ position: { x: 20, y: 20 } });
  await expect(page.locator("html")).toHaveAttribute("data-opening-sample", JSON.stringify({
    boardOpacity: "0",
    hudFilter: "brightness(0.45)",
    hudLocked: true,
    mascotVisibility: "hidden",
    mascotFilter: "none",
  }));
  await expect(page.locator("html")).toHaveAttribute("data-opening-mascot", /"mascotVisibility":"visible","mascotFilter":"none"/);
  await expect(page.locator(".game-shell")).not.toHaveAttribute("data-entering");
  await expect(page.locator("#board canvas")).toHaveCSS("opacity", "1");
  await expect(page.locator(".tavern-hud")).toHaveCSS("filter", "none");
  await expect(page.locator("#spin")).toBeEnabled();
  await expect(page.locator("#balance")).toHaveText("1,000.00");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Game Rules" }).click();
  await expect(
    page.getByRole("heading", { name: "Inside the tavern" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.locator("#continue").isVisible()) ||
        (await page.locator("#spin").getAttribute("aria-label")) === "Spin",
      { timeout: 15000 },
    )
    .toBeTruthy();
  await expect(page.locator("#mascot canvas")).toBeVisible({ timeout: 15000 });
  expect([...assetRequests]).toEqual(
    expect.arrayContaining([
      "/tavern-assets/assets/h4_static.webp",
      "/tavern-assets/assets/td_character.skel",
      "/tavern-assets/assets/hd/td_master.atlas",
    ]),
  );
  expect(errors).toEqual([]);
});
test("a lone Scatter shakes the scene and the active payline dims only other symbols", async ({
  page,
}) => {
  const server = new MockGame(tavern, () => 0);
  const board = [
    ["A", "K", "Q", "J", "bonus"],
    ["A", "10", "coin", "ale", "J"],
    ["A", "crown", "barrel", "coin", "Q"],
    ["K", "10", "coin", "J", "ale"],
    ["Q", "J", "10", "coin", "barrel"],
  ];
  await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
  await page.route("**/api/command", (route) => {
    const outcome = server.execute(route.request().postDataJSON(), board);
    expect(outcome.entry).toBeNull();
    expect(outcome.wins.map(({ line }) => line)).toEqual([0]);
    return route.fulfill({ json: outcome });
  });
  await page.goto("/");
  await expect(page.locator(".stage")).toHaveAttribute("data-spine-scene", "true");
  await page.evaluate(async () => {
    const boardUrl = "/src/framework/presentation/board.ts";
    const spineUrl = performance.getEntriesByType("resource")
      .find(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))!.name;
    const [{ BoardView }, { AnimationState }] = await Promise.all([
      import(boardUrl), import(spineUrl),
    ]);
    const markers = document.documentElement.dataset;
    const setAnimation = AnimationState.prototype.setAnimation;
    AnimationState.prototype.setAnimation = function (track: number, name: string, loop: boolean) {
      if (name === "3_shake")
        markers.scatterShakes = String(Number(markers.scatterShakes ?? 0) + 1);
      return setAnimation.call(this, track, name, loop);
    };
    const focusWins = BoardView.prototype.focusWins;
    BoardView.prototype.focusWins = function (positions: { reel: number; row: number }[]) {
      const played = focusWins.call(this, positions);
      const { winningSymbols, tiles } = this;
      const winningViews = positions.map(({ reel, row }) => tiles[reel][row + 1].view);
      markers.winFocus = String(
        winningSymbols.renderLayerChildren.length === winningViews.length &&
        winningViews.every((view) => view.parentRenderLayer === winningSymbols && view.tint === 0xffffff) &&
        tiles.flat().every(({ view }: { view: { alpha: number } }) => view.alpha === 1) &&
        tiles.flat().some(({ view }: { view: { tint: number } }) => view.tint === 0x808080),
      );
      return played;
    };
    const clearHighlight = BoardView.prototype.clearHighlight;
    BoardView.prototype.clearHighlight = function () {
      clearHighlight.call(this);
      if (markers.winFocus)
        markers.winFocusCleared = String(this.winningSymbols.renderLayerChildren.length === 0 &&
          this.tiles.flat().every(({ view }: { view: { alpha: number; tint: number } }) => view.alpha === 1 && view.tint === 0xffffff));
    };
  });
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-scatter-shakes", "2");
  await expect(page.locator("html")).toHaveAttribute("data-win-focus", "true");
  await expect(page.locator("html")).toHaveAttribute("data-win-focus-cleared", "true");
});
for (const action of ["spin", "buy-drop"] as const) {
  test(`Turbo waits for Scatter win before opening the bonus intro from ${action}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const server = new MockGame(tavern, () => 0);
    const scatterCount = action === "spin" ? 3 : 4;
    const board = Array.from({ length: 5 }, (_, reel) =>
      reel < scatterCount
        ? ["bonus", "A", "K", "Q", "J"]
        : ["10", "A", "K", "Q", "J"],
    );
    await page.route("**/api/session", (route) =>
      route.fulfill({ json: server.state }),
    );
    await page.route("**/api/command", (route) => {
      const command = route.request().postDataJSON();
      expect(command.action).toBe(action);
      return route.fulfill({ json: server.execute(command, board) });
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("#spin")).toBeEnabled({ timeout: 20000 });
    await page.evaluate(async (count) => {
      const boardModule = "/src/framework/presentation/board.ts";
      const { BoardView } = await import(boardModule);
      const focusWins = BoardView.prototype.focusWins;
      const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
      const spineUrl = performance.getEntriesByType("resource")
        .find(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))!.name;
      const { Spine } = await import(spineUrl);
      let boardVisible: (() => boolean) | undefined;
      const updateSpine = Spine.prototype.update;
      Spine.prototype.update = function (elapsed: number) {
        const result = updateSpine.call(this, elapsed);
        if (this.state.getCurrent(2)?.animation?.name === "2_base_exit")
          boardVisible = () => this.visible;
        return result;
      };
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
        if (dialog.open && boardVisible) dialog.dataset.frozenBoardVisible = String(boardVisible());
        return Reflect.apply(drawImage, this, args);
      };
      BoardView.prototype.focusWins = function (
        positions: { reel: number; row: number }[],
      ) {
        const animation = focusWins.call(this, positions);
        if (
          positions.length === count &&
          positions.every(({ reel, row }, index) => reel === index && row === 0)
        ) {
          const start = performance.now();
          void Promise.resolve(animation).then(() => {
            dialog.dataset.scatterDuration = String(performance.now() - start);
            dialog.dataset.scatterBeforeIntro = String(!dialog.open);
          });
        }
        return animation;
      };
    }, scatterCount);
    await page.getByRole("button", { name: "Turbo" }).click();
    if (action === "spin") {
      await page.getByRole("button", { name: "Spin", exact: true }).click();
    } else {
      await page.locator("#buy").click();
      await page.locator('[data-buy="drop"]').click();
      await page.locator("#confirm-buy").click();
    }
    await expect(
      page.getByRole("heading", {
        name: action === "spin" ? "TAVERN BONUS" : "DROP BONUS",
        exact: true,
      }),
    ).toBeVisible({ timeout: 10000 });
    const dialog = page.locator("#dialog");
    await expect(dialog).toHaveAttribute("data-scatter-before-intro", "true");
    await expect(dialog).toHaveAttribute("data-frozen-board-visible", "false");
    await expect(page.locator(".machine")).toBeHidden();
    const hud = page.locator(".tavern-hud");
    await expect(hud).toBeHidden();
    const duration = await dialog.getAttribute("data-scatter-duration");
    expect(Number(duration)).toBeGreaterThan(300);
    await page.locator("#continue").click();
    await expect(hud).toBeVisible();
    await expect(hud.locator("#feature-progress")).toHaveText("10");
  });
}
test.describe("touch controls", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("a mobile tap leaves no native highlight or rectangular focus outline", async ({ page }) => {
    await page.goto("/?game=tarvern");
    const turbo = page.getByRole("button", { name: "Turbo" });
    await turbo.tap();
    await expect(turbo).toHaveAttribute("aria-pressed", "true");
    await expect(turbo).toHaveCSS("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)");
    await expect(turbo).toHaveCSS("outline-style", "none");
    await expect(turbo).toHaveCSS("border-radius", "50%");
  });
});

test("free spins autoplay through a retrigger and reveal centered Drop multipliers", async ({
  page,
}) => {
  test.setTimeout(120000);
  const game = structuredClone(tavern);
  game.demo.featureSpins.drop = 2;
  game.demo.retriggerSpins = 1;
  game.demo.capMultiplier = 100000;
  const server = new MockGame(game, () => 0);
  const requests: string[] = [];
  const spinAmounts: { win: number; total: number }[] = [];
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: server.state }),
  );
  await page.route("**/api/command", (route) => {
    const command = route.request().postDataJSON();
    const board = Array.from({ length: 5 }, () => ["A", "K", "Q", "J", "10"]);
    if (command.action === "spin") {
      requests.push(command.requestId);
      if (requests.length === 2) {
        for (let reel = 0; reel < 3; reel++) board[reel][0] = "bonus";
      }
    }
    const outcome = server.execute(command, board);
    const feature = outcome.finalFeature ?? outcome.state.feature;
    if (command.action === "spin" && feature)
      spinAmounts.push({ win: outcome.spinWin, total: feature.accumulated });
    return route.fulfill({ json: outcome });
  });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  await page.locator("#buy").click();
  await page.locator('[data-buy="drop"]').click();
  await page.evaluate(async () => {
    const boardUrl = "/src/framework/presentation/board.ts";
    const { BoardView } = await import(boardUrl);
    const markers = document.documentElement.dataset;
    const hideSymbols = BoardView.prototype.hideSymbols;
    BoardView.prototype.hideSymbols = function () {
      hideSymbols.call(this);
      markers.bonusBoardHidden = String(!this.strip.visible);
    };
    const start = BoardView.prototype.start;
    BoardView.prototype.start = function (turbo: boolean, motion: string) {
      start.call(this, turbo, motion);
      if (markers.bonusBoardHidden && !markers.firstFreeSpinStarted)
        markers.firstFreeSpinStarted = String(!this.strip.visible);
    };
  });
  const purchase = page.waitForResponse(
    (response) => response.url().endsWith("/api/command") && response.ok(),
  );
  await page.locator("#confirm-buy").click();
  const entry = await (await purchase).json();
  expect(entry.state.board.flat().filter((id: string) => id === "bonus")).toHaveLength(
    4,
  );
  await expect(
    page.getByRole("heading", { name: "DROP BONUS", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".tavern-screen-art")).toHaveAttribute("data-spine-clip", "super_intro");
  await expect(page.locator("html")).toHaveAttribute("data-bonus-board-hidden", "true");
  expect(requests).toHaveLength(0);
  await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
    const reelCanvas = document.querySelector("#board canvas")!;
    const progress = document.querySelector("#feature-progress")!;
    const tiers: string[] = [];
    (window as any).featureTiers = tiers;
    new MutationObserver((mutations) => {
      if (!performance.getEntriesByName("feature-result-open").length) return;
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement && node.matches(".win-celebration")) {
            const title = node.querySelector("strong");
            const label = title?.textContent;
            if (label?.endsWith(" WIN")) tiers.push(label);
            if (title && label?.endsWith(" WIN")) {
              (window as any).featureCelebrationCount = ((window as any).featureCelebrationCount ?? 0) + 1;
              new MutationObserver(() => {
                const next = title.textContent;
                if (next?.endsWith(" WIN")) tiers.push(next);
              }).observe(title, { childList: true });
            }
          }
        }
      }
    }).observe(document.querySelector("#app")!, { childList: true });
    dialog.addEventListener("click", () => {
      performance.mark("feature-continue");
    }, { once: true });
    const finalPresentation = new MutationObserver(() => {
      if (progress.textContent === "0" && !reelCanvas.hasAttribute("data-win-focus")) {
        performance.mark("final-spin-presented");
        finalPresentation.disconnect();
      }
    });
    finalPresentation.observe(reelCanvas, { attributes: true, attributeFilter: ["data-win-focus"] });
    const stage = document.querySelector<HTMLElement>(".stage")!;
    const resultPopup = new MutationObserver(() => {
      if (stage.dataset.chestReveal === "true") {
        performance.mark("feature-result-open");
        const amounts = [stage.dataset.chestAmount];
        (window as any).featureAmounts = amounts;
        new MutationObserver(() => amounts.push(stage.dataset.chestAmount)).observe(stage, { attributes: true, attributeFilter: ["data-chest-amount"] });
        resultPopup.disconnect();
      }
    });
    resultPopup.observe(stage, { attributes: true, attributeFilter: ["data-chest-reveal"] });
  });
  await page.mouse.click(5, 5);
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-mode",
    "drop",
  );
  const chestsAboveReels = await page.locator("#board canvas").evaluate(
    (canvas) => Number(getComputedStyle(document.querySelector("#chests")!).zIndex) >
      Number(getComputedStyle(canvas).zIndex),
  );
  expect(chestsAboveReels).toBe(true);
  await expect(page.locator(".stage")).toHaveAttribute("data-chest-reveal", "true", {
    timeout: 35000,
  });
  const finalSpin = spinAmounts.at(-1)!;
  expect(finalSpin.win).toBeGreaterThan(0);
  expect(finalSpin.total).toBeGreaterThan(finalSpin.win);
  await expect(page.locator("#win-value")).toBeVisible();
  await expect(page.locator("#spin-win-amount")).toHaveText((finalSpin.win / 100).toFixed(2));
  await expect(page.locator("#feature-total-amount")).toHaveText((finalSpin.total / 100).toFixed(2));
  await expect(page.locator("#spin-win-label")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator("#spin-win-amount")).toHaveCSS("color", "rgb(65, 225, 251)");
  for (const property of ["font-size", "font-family"])
    expect(await page.locator("#spin-win-amount").evaluate((el, property) => getComputedStyle(el).getPropertyValue(property), property))
      .toBe(await page.locator("#balance").evaluate((el, property) => getComputedStyle(el).getPropertyValue(property), property));
  await expect(page.locator('#dialog[data-look="chest"]')).toHaveCount(0);
  const delays = await page.evaluate(() => {
    const mark = (name: string) => performance.getEntriesByName(name, "mark")[0].startTime;
    const continueAt = mark("feature-continue");
    const apiUrl = new URL("/api/command", location.href).href;
    const firstSpin = performance.getEntriesByName(apiUrl, "resource")
      .find((entry) => entry.startTime >= continueAt)!;
    return {
      start: firstSpin.startTime - continueAt,
      end: mark("feature-result-open") - mark("final-spin-presented"),
    };
  });
  expect(delays.start).toBeGreaterThanOrEqual(1400 + tavern.presentation.feature!.startDelayMs - 50);
  expect(delays.end).toBeGreaterThanOrEqual(tavern.presentation.feature!.endDelayMs - 50);
  expect(requests).toHaveLength(3);
  await expect(page.locator("html")).toHaveAttribute("data-first-free-spin-started", "true");
  expect(new Set(requests).size).toBe(3);
  await expect(page.getByRole("heading", { name: "Total Win" })).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".reveal-chests")).toHaveCount(0);
  await expect(page.locator("#continue")).toBeEnabled();
  expect(new Set(await page.evaluate(() => (window as any).featureAmounts)).size).toBeGreaterThan(2);
  expect(await page.evaluate(() => (window as any).featureTiers)).toEqual([
    "BIG WIN", "SUPER WIN", "MEGA WIN", "EPIC WIN",
  ]);
  expect(await page.evaluate(() => (window as any).featureCelebrationCount)).toBe(1);
  const expected = server.state.balance;
  await page.mouse.click(5, 5);
  await expect(page.locator("#balance")).toHaveText(
    (expected / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }),
  );
});
for (const unlocked of [false, true]) test(`feature result ${unlocked ? "shows all chests when one unlocks" : "omits chests when none unlock"}`, async ({ page }) => {
  test.setTimeout(65000);
  const game = structuredClone(tavern);
  game.demo.featureSpins.drop = 1;
  const server = new MockGame(game, () => 0);
  let releaseFreeSpin!: () => void;
  let spinRequested = false;
  const holdFreeSpin = new Promise<void>((resolve) => { releaseFreeSpin = resolve; });
  await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
  await page.route("**/api/command", async (route) => {
    const command = route.request().postDataJSON();
    if (command.action === "spin") {
      spinRequested = true;
      await holdFreeSpin;
    }
    const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
    const outcome = server.execute(command, board);
    if (unlocked && outcome.completion && outcome.finalFeature) {
      outcome.finalFeature.chests[3] = { rows: [0, 1, 2, 3, 4], unlocked: true, multiplier: 2 };
      Object.assign(outcome.completion, { accumulated: 100, featureAward: 200, roundAward: 200, multipliers: [1, 1, 1, 2, 1], product: 2 });
    }
    return route.fulfill({ json: outcome });
  });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled({ timeout: 20000 });
  await page.evaluate(async () => {
    const spineUrl = performance.getEntriesByType("resource")
      .find(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))!.name;
    const { AnimationState, Spine } = await import(spineUrl);
    const clips: string[] = [];
    (window as any).chestClips = clips;
    const slotObjects = new Map<string, { text: string }>();
    (window as any).chestSlotObjects = slotObjects;
    const updateSlotObject = Spine.prototype.updateSlotObject;
    Spine.prototype.updateSlotObject = function (attachment: { slot: { data: { name: string } }; container: { text: string } }) {
      const name = attachment.slot.data.name;
      if (name === "slot_finalwin" || name.startsWith("slot_reel_mult_"))
        slotObjects.set(name, attachment.container);
      return updateSlotObject.call(this, attachment);
    };
    const original = AnimationState.prototype.setAnimation;
    AnimationState.prototype.setAnimation = function (track: number, name: string, loop: boolean) {
      if (name === "4_finalwin" || /reel_3_chest_(open|finalwin)$/.test(name)) clips.push(name);
      const result = document.querySelector<HTMLDialogElement>('#dialog[data-look="total-win"]');
      if (name === "2_base_enter" && result?.open)
        result.dataset.baseEnteredDuringOutro = String(!!result.querySelector('[data-spine-clip="total_win_end"]'));
      return original.call(this, track, name, loop);
    };
  });
  await page.locator("#buy").click();
  await page.locator('[data-buy="drop"]').click();
  await page.locator("#confirm-buy").click();
  await expect(page.getByRole("heading", { name: "DROP BONUS" })).toBeVisible({ timeout: 15000 });
  await page.locator("#continue").click();
  await expect.poll(() => spinRequested, { timeout: 15000 }).toBe(true);
  await expect(page.locator("#feature-progress")).toHaveText("0");
  releaseFreeSpin();
  if (unlocked) {
    await expect(page.locator(".stage")).toHaveAttribute("data-chest-reveal", "true", { timeout: 25000 });
    await expect(page.locator(".stage")).toHaveAttribute("data-chest-amount", "1.00");
    expect(await page.evaluate(() => (window as any).chestSlotObjects.get("slot_finalwin")?.style.fontSize)).toBe(240);
    await expect(page.locator('#dialog[data-look="chest"]')).toHaveCount(0);
    await expect(page.locator(".stage")).toHaveAttribute("data-chest-opened", "3", { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).chestSlotObjects.get("slot_reel_mult_3")?.text)).toBe("x2");
    await expect(page.locator(".stage")).toHaveAttribute("data-chest-amount", "2.00", { timeout: 10000 });
  }
  await expect(page.getByRole("heading", { name: "Total Win" })).toBeVisible({ timeout: 25000 });
  const resultDialog = page.locator('#dialog[data-look="total-win"]');
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await resultDialog.evaluate((dialog) => dialog.scrollWidth - dialog.clientWidth)).toBe(0);
    const art = (await resultDialog.locator(".total-win-screen").boundingBox())!;
    const portrait = viewport.width / viewport.height <= 0.8;
    expect((art.y + art.height / 2) / viewport.height).toBeCloseTo(portrait ? 0.44 : 0.41, 2);
    if (portrait) expect(art.width).toBe(viewport.width);
    await expect(resultDialog.getByRole("button", { name: "Press to continue" })).toBeInViewport();
  }
  await expect(page.locator(".reveal-chests")).toHaveCount(0);
  await expect(page.locator(".result-total")).toHaveText(unlocked ? "2.00" : "0.00");
  if (unlocked) expect(await page.evaluate(() => (window as any).chestClips)).toEqual([
    "4_finalwin", "36_reel_3_chest_open", "37_reel_3_chest_finalwin",
  ]);
  else expect(await page.evaluate(() => (window as any).chestClips)).toEqual([]);
  await expect(page.locator("#continue")).toBeEnabled();
  if (!unlocked) {
    // Wait past the previous automatic dismissal time, including the intro.
    await page.waitForTimeout(6500);
    await expect(page.locator("#dialog")).toBeVisible();
  }
  await page.mouse.click(5, 5);
  await expect(resultDialog).toHaveAttribute("data-base-entered-during-outro", "true");
  if (unlocked) {
    await expect(page.locator(".game-shell")).toHaveAttribute("data-mode", "base");
    await expect.poll(() => page.evaluate(() => {
      const slots = (window as any).chestSlotObjects as Map<string, { text: string }>;
      return slots.size === 6 && Array.from(slots.values()).every((slot) => slot.text === "");
    })).toBe(true);
  } else {
    await expect(page.locator("#dialog")).toBeHidden({ timeout: 16000 });
    await expect(page.locator(".game-shell")).toHaveAttribute("data-mode", "base");
  }
});
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 506, height: 812 }]) {
  test(`autoplay and menu fit the ${viewport.width}px layout`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#spin")).toBeEnabled({ timeout: 20000 });
    const spin = page.locator("#spin");
    const turbo = page.getByRole("button", { name: "Turbo" });
    const width = (await spin.boundingBox())!.width;
    expect(width).toBeCloseTo(viewport.width > 670 ? 102 : 8.5 * Math.min(10, viewport.width * 0.025), 1);
    await expect(turbo).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await turbo.click();
    await expect(turbo).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await expect(turbo).toHaveCSS("color", "rgb(65, 225, 251)");
    await turbo.click();
    if (viewport.width > 670) {
      expect(await page.locator(".hud-bar").evaluate((bar) => getComputedStyle(bar, "::before").backgroundColor))
        .toBe("rgba(19, 23, 21, 0.82)");
      const up = (await page.locator("#bet-up").boundingBox())!;
      const down = (await page.locator("#bet-down").boundingBox())!;
      expect(down.y - up.y - up.height).toBeCloseTo(18);
      const auto = (await page.locator("#auto").boundingBox())!;
      const speed = (await page.locator("#speed").boundingBox())!;
      expect(speed.y - auto.y - auto.height).toBeGreaterThan(7.2);
      await expect(page.locator("#bet-picker")).toHaveCSS("min-width", "102px");
      await expect(page.locator("#balance")).toHaveCSS("font-size", "22px");
      await spin.hover();
      await expect(spin).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");
      await expect(spin.locator(".hud-icon-spin")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    }
    await page.getByRole("button", { name: "Autoplay", exact: true }).click();
    const panel = page.locator("#auto-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator("button")).toHaveText(["∞", "10", "25", "50", "100", "250", "500", "1000"]);
    await expect(panel).toBeInViewport();
    if (viewport.width < 670) {
      const grid = await panel.locator(".round-picker-options").evaluate((el) => getComputedStyle(el).gridTemplateColumns);
      expect(grid.split(" ")).toHaveLength(3);
      expect((await panel.boundingBox())!.width).toBeCloseTo(viewport.width * 0.65, 0);
    }
    const unlimited = panel.getByRole("button", { name: "Unlimited autoplay" });
    await unlimited.click();
    await expect(unlimited).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await page.locator("#bet-picker").hover();
    await expect(page.locator("#bet-picker")).toHaveCSS("transform", "none");
    await page.locator("#bet-picker").click();
    const betPanel = page.locator("#bet-panel");
    await expect(betPanel).toBeInViewport();
    await expect(betPanel.getByRole("button", { name: "$1.00", exact: true })).toHaveAttribute("aria-pressed", "true");
    const nextBet = betPanel.getByRole("button", { name: "$1.20", exact: true });
    await nextBet.evaluate((button) => {
      const panel = button.closest<HTMLElement>("#bet-panel")!;
      button.addEventListener("click", () => {
        const start = performance.now();
        panel.dataset.selectionColor = getComputedStyle(button).backgroundColor;
        panel.dataset.selectionOpen = String(panel.matches(":popover-open"));
        panel.addEventListener("beforetoggle", () => {
          panel.dataset.selectionDelay = String(performance.now() - start);
        }, { once: true });
      }, { once: true });
    });
    await nextBet.click();
    await expect(betPanel).toBeHidden();
    await expect(betPanel).toHaveAttribute("data-selection-color", "rgb(65, 225, 251)");
    await expect(betPanel).toHaveAttribute("data-selection-open", "true");
    expect(Number(await betPanel.getAttribute("data-selection-delay"))).toBeGreaterThanOrEqual(95);
    await expect(page.locator("#bet")).toHaveText("1.20");
    await expect(page.locator(".tavern-status")).toHaveCount(0);
    await page.getByRole("button", { name: "Feature buy" }).click();
    await expect(page.locator(".shop-balance strong")).toHaveText(/^\$[\d,.]+$/);
    const closeShop = page.getByRole("button", { name: "Close dialog" });
    await expect(closeShop).toHaveCSS("width", "72px");
    await expect(closeShop).toHaveCSS("height", "72px");
    await expect(closeShop.locator(".hud-icon-close")).toHaveCSS("width", "50px");
    await closeShop.hover();
    const closeBounds = (await closeShop.boundingBox())!;
    expect(closeBounds.y).toBe(16);
    expect(viewport.width - closeBounds.x - closeBounds.width).toBe(22);
    const cards = page.locator(".shop-grid .shop-card");
    for (const card of await cards.all()) {
      const bolts = card.locator(".shop-bolts .hud-icon-turbo");
      await expect(bolts).toHaveCount(5);
      await expect(bolts.first()).toHaveCSS("height", viewport.width > 670 ? "18px" : "16px");
      const tile = card.locator("..");
      const size = (await tile.boundingBox())!;
      await tile.hover({ position: { x: size.width / 2, y: size.height - 2 } });
      await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -8.75)");
      await expect(card).toHaveCSS("filter", "none");
    }
    if (viewport.width < 670) {
      expect((await cards.nth(1).boundingBox())!.x).toBeCloseTo((await cards.first().boundingBox())!.x, 1);
      await page.locator('[data-buy="drop"]').scrollIntoViewIfNeeded();
      const balance = (await page.locator(".shop-balance").boundingBox())!;
      const bet = (await page.locator(".shop-bet").boundingBox())!;
      expect(balance.y + balance.height).toBeLessThanOrEqual(bet.y);
      expect(balance.x + balance.width / 2).toBeCloseTo(viewport.width / 2, 0);
      expect(bet.x + bet.width / 2).toBeCloseTo(viewport.width / 2, 0);
    }
    const controls = (await page.locator(".shop-controls").boundingBox())!;
    expect(viewport.height - controls.y - controls.height).toBeLessThanOrEqual(2);
    await page.getByRole("button", { name: "Decrease feature bet" }).click();
    await expect(page.locator(".shop-bet strong")).toHaveText("$1.00");
    for (const mode of ["tavern", "drop"]) {
      const option = page.locator(`[data-buy="${mode}"]`);
      await option.click();
      const confirmation = page.locator(".shop-confirm");
      await expect(confirmation.locator("p")).toHaveText(
        "Enter a bonus game with 10 free spins. Win positions in the reel to unlock chest multipliers." +
        (mode === "drop" ? " The minimum multiplier is 5x." : ""),
      );
      await expect(closeShop).toHaveCSS("width", "72px");
      if (mode === "tavern") await closeShop.click();
      else await page.keyboard.press("Escape");
      await expect(page.locator(".shop-grid")).toBeVisible();
      await expect(option).toBeFocused();
      await expect(page.locator(".shop-bet strong")).toHaveText("$1.00");
    }
    await closeShop.click();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Game Rules" })).toBeInViewport();
    await expect(page.getByRole("slider", { name: "Sound effects volume" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Music volume" })).toBeVisible();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText("Nothing to share yet")).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    if (viewport.width > 670) {
      const before = await page.locator("#bet-track").getAttribute("aria-valuenow");
      await page.getByRole("button", { name: "Increase bet" }).click();
      await expect(page.locator("#bet-track")).toHaveAttribute("aria-valuenow", String(Number(before) + 1));
    }
  });
}
test("finite and unlimited autoplay start on Spin and can be stopped", async ({ page }) => {
  test.setTimeout(60000);
  const server = new MockGame(tavern);
  const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
  let requests = 0;
  let releaseFirstSpin!: () => void;
  const firstSpin = new Promise<void>((resolve) => { releaseFirstSpin = resolve; });
  await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
  await page.route("**/api/command", async (route) => {
    requests++;
    if (requests === 1) await firstSpin;
    await route.fulfill({ json: server.execute(route.request().postDataJSON(), board) });
  });
  await page.goto("/");
  const spin = page.locator("#spin");
  const count = spin.locator(".auto-count");
  const add = page.getByRole("button", { name: "Add 10 autoplay spins" });
  await expect(spin).toBeEnabled({ timeout: 20000 });
  await page.getByRole("button", { name: "Autoplay", exact: true }).click();
  const choice = page.locator("#auto-panel").getByRole("button", { name: "25", exact: true });
  await choice.hover();
  await expect(choice).toHaveCSS("background-color", "rgb(60, 60, 70)");
  await choice.click();
  await expect(choice).toHaveCSS("background-color", "rgb(65, 225, 251)");
  await expect(spin).toHaveAttribute("data-auto-ready", "");
  await expect(add).toBeHidden();
  expect(requests).toBe(0);
  await spin.click();
  await expect.poll(() => requests).toBe(1);
  await expect(count).toHaveText("25");
  await spin.hover();
  await expect(count).toHaveCSS("background-color", "rgb(65, 225, 251)");
  await add.hover();
  await expect(add).toHaveCSS("background-color", "rgb(65, 225, 251)");
  await add.click();
  await expect(count).toHaveText("35");
  expect(requests).toBe(1);
  releaseFirstSpin();
  await expect(count).toHaveText("34", { timeout: 15000 });
  await expect.poll(() => requests).toBeGreaterThan(1);
  await spin.click();
  await expect(add).toBeHidden();
  await expect(spin).toHaveAttribute("aria-label", "Spin", { timeout: 15000 });
  const beforeUnlimited = requests;
  await page.getByRole("button", { name: "Autoplay", exact: true }).click();
  await page.getByRole("button", { name: "Unlimited autoplay" }).click();
  expect(requests).toBe(beforeUnlimited);
  await spin.click();
  await expect(count).toHaveText("∞");
  await expect(add).toBeHidden();
  await expect.poll(() => requests, { timeout: 15000 }).toBeGreaterThan(beforeUnlimited + 1);
  await expect(count).toHaveText("∞");
  await page.getByRole("button", { name: "Stop unlimited autoplay" }).click();
  await expect(spin).toHaveAttribute("aria-label", "Spin", { timeout: 15000 });
});
for (const [multiplier, label] of [[20, "BIG WIN"], [50, "SUPER WIN"], [75, "MEGA WIN"], [100, "EPIC WIN"]] as const) {
  test(`${label} displays its celebration`, async ({ page }) => {
    test.setTimeout(90000);
    const server = new MockGame(tavern, () => 0);
    await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
    await page.route("**/api/command", (route) => {
      const command = route.request().postDataJSON();
      const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
      const outcome = server.execute(command, board);
      outcome.spinWin = outcome.paidAward = command.bet * multiplier;
      outcome.state.balance += outcome.spinWin;
      return route.fulfill({ json: outcome });
    });
    await page.goto("/");
    await expect(page.locator("#spin")).toBeEnabled();
    await page.evaluate(async () => {
      const events = { titles: [] as string[], values: [] as number[], clips: [] as string[], overlays: 0 };
      (window as any).winSequence = events;
      const spineUrl = performance.getEntriesByType("resource")
        .find(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))!.name;
      const { AnimationState } = await import(spineUrl);
      const setAnimation = AnimationState.prototype.setAnimation;
      AnimationState.prototype.setAnimation = function (track: number, name: string, loop: boolean) {
        if (["bigwin", "superwin", "megawin", "epicwin", "maxwin"].includes(name)) events.clips.push(name);
        return setAnimation.call(this, track, name, loop);
      };
      new MutationObserver((changes) => {
        for (const change of changes) for (const node of Array.from(change.addedNodes)) {
          if (!(node instanceof HTMLElement) || !node.matches(".win-celebration")) continue;
          events.overlays++;
          const title = node.querySelector("strong")!;
          const value = node.querySelector(".win-celebration-value")!;
          events.titles.push(title.textContent!);
          new MutationObserver(() => events.titles.push(title.textContent!)).observe(title, { childList: true });
          new MutationObserver(() => events.values.push(Number(value.textContent!.replaceAll(",", ""))))
            .observe(value, { childList: true });
        }
      }).observe(document.querySelector("#app")!, { childList: true });
    });
    await page.locator("#spin").click();
    await expect(page.locator(".win-celebration strong")).toHaveText(label, { timeout: 60000 });
    await expect(page.locator(".win-celebration-value")).toHaveText(`${multiplier}.00`);
    await expect(page.locator(".win-celebration .tavern-screen-art"))
      .toHaveAttribute("data-spine-clip", label.toLowerCase().replace(/\s/g, ""));
    await expect(page.locator(".win-celebration")).toHaveCount(0, { timeout: 14000 });
    const sequence = await page.evaluate(() => (window as any).winSequence);
    const expected = [[20, "BIG WIN"], [50, "SUPER WIN"], [75, "MEGA WIN"], [100, "EPIC WIN"]]
      .filter(([threshold]) => multiplier >= Number(threshold)).map(([, name]) => name);
    expect(sequence.overlays).toBe(1);
    expect(sequence.titles).toEqual(expected);
    expect(sequence.clips).toEqual([label.toLowerCase().replace(/\s/g, "")]);
    expect(sequence.values.length).toBeGreaterThan(1);
    expect(sequence.values.every((value: number, i: number, values: number[]) => i === 0 || value >= values[i - 1])).toBe(true);
  });
}
test("mobile layout fits 390 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  const host = await page.locator("#board").boundingBox(),
    canvas = await page.locator("#board canvas").boundingBox();
  expect(canvas!.width).toBeCloseTo(host!.width, 0);
  expect(canvas!.height).toBeCloseTo(host!.height, 0);
  await page.screenshot({
    path: "/tmp/tavern-template-mobile.png",
    fullPage: true,
  });
});

test("query modes mount the viewer, Tavern Drop, and the 3 × 3 game", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/?source=local&game=viewer");
  const viewer = page.frameLocator(".animation-viewer-frame");
  await expect(viewer.getByRole("heading", { name: "Asset viewer" })).toBeVisible();
  await expect(viewer.locator("#animation")).toBeEnabled({ timeout: 20000 });
  await viewer.locator("#skeleton").selectOption("reelhouse");
  await expect(viewer.locator("#animation")).toHaveValue("1_idle", { timeout: 20000 });
  await expect(viewer.locator("#player canvas")).toBeVisible();
  await expect(viewer.locator("html")).toHaveAttribute("lang", "en");
  await expect(viewer.locator("#status")).toContainText("animations");
  await expect(page.locator("#spin")).toHaveCount(0);

  await page.goto("/?game=default");
  await expect(page.locator("#reuse-board canvas")).toHaveAttribute("aria-label", "3 by 3 reel board");
  await page.goto("/?game=tarvern");
  await expect(page.locator("#board canvas")).toHaveAttribute("aria-label", "5 by 5 reel board");
});

test("the English viewer previews a sound sprite cue and stops at its boundary", async ({ page }) => {
  await page.goto("/?game=viewer");
  const viewer = page.frameLocator(".animation-viewer-frame");
  await expect(viewer.getByRole("heading", { name: "Sound Sprite" })).toBeVisible();
  await expect(viewer.locator("#sound-count")).toHaveText("66 cues");
  await viewer.getByLabel("Sound cue").selectOption("pc_shared_reel_start");
  await expect(viewer.locator("#sound-timing")).toHaveText("Duration 0.30 s · Offset 33.00 s");
  await viewer.getByRole("button", { name: "Play", exact: true }).click();
  await expect(viewer.locator("#sound-status")).toHaveText("Finished.", { timeout: 15000 });
  const media = await viewer.locator("#sound-sprite").evaluate((audio: HTMLAudioElement) => ({
    paused: audio.paused, time: audio.currentTime,
  }));
  expect(media.paused).toBe(true);
  expect(media.time).toBeGreaterThanOrEqual(33.30);
  expect(media.time).toBeLessThan(33.65);
});

test("portrait renders the mascot behind the reelhouse and uses the reference HUD icons", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const icons = new Set<string>();
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/tavern-assets/hud/"))
      icons.add(new URL(response.url()).pathname.split("/").at(-1)!);
  });
  await page.goto("/?game=tarvern");
  await expect(page.locator(".stage")).toHaveAttribute("data-mascot-behind-board", "");
  await expect(page.locator("#mascot")).toHaveCSS("visibility", "hidden");
  await expect(page.locator("#mascot canvas")).toHaveCount(0);
  await expect.poll(() => ["menu", "bet-up", "bet-down", "spin", "autoplay", "turbo"].every(
    (icon) => icons.has(icon + ".svg"),
  )).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator(".stage")).not.toHaveAttribute("data-mascot-behind-board", "");
  await expect(page.locator("#mascot")).toBeVisible();
  await expect(page.locator("#mascot canvas")).toBeVisible();
  await page.setViewportSize({ width: 1940, height: 980 });
  await expect.poll(() => page.locator("#mascot canvas").evaluate((canvas: HTMLCanvasElement) =>
    canvas.width / canvas.getBoundingClientRect().width,
  )).toBeGreaterThanOrEqual(0.99);
});

test("Drop anticipation highlights landed Scatters and clears on Skip", async ({ page }) => {
  const server = new MockGame(tavern, () => 0.5);
  const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
  board[0][0] = "bonus";
  board[1][2] = "bonus";
  await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
  await page.route("**/api/command", (route) => route.fulfill({
    json: server.execute(route.request().postDataJSON(), board),
  }));
  await page.goto("/?game=tarvern");
  await expect(page.locator("#spin")).toBeEnabled({ timeout: 15000 });
  await page.evaluate(async () => {
    const moduleUrl = "/src/framework/presentation/board.ts";
    const { BoardView } = await import(moduleUrl);
    const original = BoardView.prototype.raiseAnticipationSymbol;
    BoardView.prototype.raiseAnticipationSymbol = function (tile) {
      original.call(this, tile);
      const reel = this.tiles.findIndex((column) => column.includes(tile));
      const row = this.tiles[reel].indexOf(tile) - 1;
      const raised = this.app.canvas.dataset.raisedScatters ?? "";
      this.app.canvas.dataset.raisedScatters = raised + `${reel}:${row},`;
    };
  });
  const canvas = page.locator("#board canvas");
  const spin = page.locator("#spin");
  await spin.click();
  await expect(canvas).toHaveAttribute("data-anticipation-focus", "", { timeout: 12000 });
  await expect(canvas).toHaveAttribute("data-raised-scatters", "0:0,1:2,");
  await spin.click();
  await expect(canvas).not.toHaveAttribute("data-anticipation-focus", "");
  await expect(spin).toHaveAccessibleName("Spin");
  await page.getByRole("button", { name: "Turbo" }).click();
  await spin.click();
  await expect(spin).toContainText("SPIN", { timeout: 12000 });
  await expect(canvas).toHaveAttribute("data-raised-scatters", "0:0,1:2,");
});
for (const scatterCount of [2, 3]) {
  test(`${scatterCount} Scatters play win only for a feature trigger`, async ({ page }) => {
    const server = new MockGame(tavern, () => 0.5);
    const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
    for (let reel = 0; reel < scatterCount; reel++) board[reel][reel] = "bonus";
    await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
    await page.route("**/api/command", (route) => route.fulfill({
      json: server.execute(route.request().postDataJSON(), board),
    }));
    await page.goto("/");
    await expect(page.locator("#spin")).toBeEnabled();
    await page.evaluate(async () => {
      const spineUrl = performance.getEntriesByType("resource")
        .find(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))!.name;
      const { AnimationState } = await import(spineUrl);
      const boardUrl = "/src/framework/presentation/board.ts";
      const { BoardView } = await import(boardUrl);
      const focusWins = BoardView.prototype.focusWins;
      BoardView.prototype.focusWins = function (positions: { reel: number; row: number }[]) {
        if (positions.length >= 3) {
          (window as any).scatterLandedBeforeWin = positions.every(({ reel, row }) => {
            const spine = this.tiles[reel][row + 1].view.children.find((child: any) => child.state?.getCurrent(0)?.animation?.name?.startsWith("bonus_"));
            const current = spine?.state.getCurrent(0);
            return current && (current.animation.name !== "bonus_land" || current.trackTime >= current.animationEnd);
          });
        }
        return focusWins.call(this, positions);
      };
      const events: string[] = [];
      (window as any).scatterAnimations = events;
      const setAnimation = AnimationState.prototype.setAnimation;
      AnimationState.prototype.setAnimation = function (track: number, name: string, loop: boolean) {
        if (name === "bonus_land" || name === "bonus_win") events.push(name);
        return setAnimation.call(this, track, name, loop);
      };
      const addAnimation = AnimationState.prototype.addAnimation;
      AnimationState.prototype.addAnimation = function (track: number, name: string, loop: boolean, delay: number) {
        if (name === "bonus_win") events.push(name);
        return addAnimation.call(this, track, name, loop, delay);
      };
    });
    await page.locator("#spin").click();
    if (scatterCount === 3)
      await expect(page.getByRole("heading", { name: "TAVERN BONUS", exact: true })).toBeVisible({ timeout: 20000 });
    else {
      await expect(page.locator("#spin")).toContainText("SKIP", { timeout: 10000 });
      await expect(page.locator("#spin")).toContainText("SPIN", { timeout: 20000 });
    }
    const events = await page.evaluate(() => (window as any).scatterAnimations as string[]);
    expect(events.filter((event) => event === "bonus_land")).toHaveLength(scatterCount);
    expect(events.filter((event) => event === "bonus_win")).toHaveLength(scatterCount === 3 ? 3 : 0);
    if (scatterCount === 3)
      expect(events.lastIndexOf("bonus_land")).toBeLessThan(events.indexOf("bonus_win"));
    if (scatterCount === 3)
      expect(await page.evaluate(() => (window as any).scatterLandedBeforeWin)).toBe(true);
  });
}
test("lost response recovers the exact request without charging another spin", async ({
  page,
}) => {
  const server = new MockGame(tavern, () => 0.5);
  let first = true;
  const ids: string[] = [];
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: server.state }),
  );
  await page.route("**/api/command", async (route) => {
    const command = route.request().postDataJSON();
    ids.push(command.requestId);
    const result = server.execute(
      command,
      Array.from({ length: 5 }, (_, c) =>
        Array(5).fill(["A", "K", "Q", "J", "10"][c]),
      ),
    );
    if (first) {
      first = false;
      await route.abort("failed");
    } else await route.fulfill({ json: result });
  });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  await page.locator("#spin").click();
  await expect(
    page.getByRole("heading", { name: "Recover your result" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Resume Active Game?" }),
  ).toBeVisible({ timeout: 20000 });
  await page.locator("#recover").click();
  await expect(page.locator("#spin")).toContainText("SPIN");
  await expect(page.locator("#balance")).toHaveText("999.00");
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
});
test("desktop landscape keeps the bottom reel row and spin controls visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  const spin = await page.locator("#spin").boundingBox();
  expect(spin!.y + spin!.height).toBeLessThanOrEqual(720);
  const machineLayer = await page.locator(".machine").evaluate(
    (machine) => Number(getComputedStyle(machine).zIndex),
  );
  const mascotLayer = await page.locator(".mascot").evaluate(
    (mascot) => Number(getComputedStyle(mascot).zIndex),
  );
  const table = page.locator(".tavern-foreground");
  await expect(table).toHaveAttribute("data-anchored", "true");
  await expect(page.locator(".mascot")).toHaveAttribute("data-anchored", "true");
  expect(mascotLayer).toBeGreaterThan(machineLayer);
  expect(await table.evaluate((node) => Number(getComputedStyle(node).zIndex)))
    .toBeGreaterThan(mascotLayer);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 788, height: 510 },
  ]) {
    await page.setViewportSize(viewport);
    const padding = await page.locator("#board canvas").evaluate((canvas) => {
      const board = canvas.getBoundingClientRect();
      const host = canvas.parentElement!.getBoundingClientRect();
      return { top: host.top - board.top, bottom: board.bottom - host.bottom };
    });
    expect(padding.top).toBeGreaterThan(0);
    expect(padding.bottom).toBeCloseTo(padding.top, 1);
    const bottomRowVisible = await page.locator("#board canvas").evaluate(
      (canvas) => {
        const board = canvas.getBoundingClientRect();
        return Array.from({ length: 5 }, (_, reel) => {
          const layers = document.elementsFromPoint(
            board.x + board.width * ((reel + 0.5) / 5),
            board.y + board.height * 0.96,
          );
          const table = layers.findIndex((layer) => layer.matches(".table.base-art"));
          const reelBoard = layers.indexOf(canvas);
          return reelBoard >= 0 && (table === -1 || reelBoard < table);
        }).every(Boolean);
      },
    );
    expect(bottomRowVisible).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: "/tmp/tavern-template-landscape.png",
    fullPage: true,
  });
});

test("the 3 × 3 build uses the shared board and has its own session", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("/?game=reuse");
  await expect(page.locator("#reuse-board canvas")).toHaveAttribute(
    "aria-label",
    "3 by 3 reel board",
  );
  const { cellSizePx, gapPx } = reuse.presentation;
  const canvasWidth = await page.locator("#reuse-board canvas").evaluate(
    (canvas: HTMLCanvasElement) => canvas.width / Math.min(devicePixelRatio, 2),
  );
  expect(canvasWidth).toBe(reuse.reels * (cellSizePx + gapPx) - gapPx);
  await expect(page.locator("#reuse-balance")).toHaveText("Balance 1000.00");
  const response = page.waitForResponse((event) =>
    event.url().endsWith("/api/reuse/command"),
  );
  await page.locator("#reuse-spin").click();
  const result = await (await response).json();
  expect(result.state.board.map((reel: string[]) => reel.length)).toEqual([
    3, 3, 3,
  ]);
  await expect(page.locator("#reuse-balance")).toHaveText(
    "Balance " + (result.state.balance / 100).toFixed(2),
  );
  await page.getByRole("link", { name: "Tavern Drop" }).click();
  await expect(page.locator("#balance")).toHaveText("1,000.00");
});

test("Tavern defaults to Drop with demo controls hidden and Skip preserves one result per spin", async ({
  page,
}) => {
  await page.setViewportSize({ width: 740, height: 900 });
  const server = new MockGame(tavern, () => 0.5);
  const commands: string[] = [];
  const board = ["A", "K", "Q", "J", "10"].map((symbol) =>
    Array(5).fill(symbol),
  );
  let releaseResult: () => void = () => {};
  const waitForSkip = new Promise<void>((resolve) => {
    releaseResult = resolve;
  });
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: server.state }),
  );
  await page.route("**/api/command", async (route) => {
    const command = route.request().postDataJSON();
    commands.push(command.requestId);
    if (commands.length === 1) await waitForSkip;
    await route.fulfill({ json: server.execute(command, board) });
  });

  await page.addInitScript(
    (key) => localStorage.setItem(key, "spin"),
    tavern.id + ".reel-motion",
  );
  await page.goto("/");
  const spin = page.locator("#spin");
  await expect(spin).toBeEnabled();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reels: Drop" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "3 × 3" })).toHaveCount(0);
  await spin.click();
  await expect.poll(() => commands.length).toBe(1);
  await expect(spin).toHaveAttribute("aria-label", "Skip");
  await spin.click();
  releaseResult();
  await expect(spin).toHaveAttribute("aria-label", "Spin");
  await expect(page.locator("#balance")).toHaveText("999.00");

  await page.reload();
  await expect(spin).toBeEnabled();
  await spin.click();
  await expect(spin).toHaveAttribute("aria-label", "Spin");
  await expect(page.locator("#balance")).toHaveText("998.00");
  expect(new Set(commands).size).toBe(2);
  expect(commands).toHaveLength(2);
});
