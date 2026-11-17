import { test, expect } from "@playwright/test";
import { MockGame } from "../../server/mock-game.ts";
import { tavern } from "../../src/games/tavern/definition.ts";
import { reuse } from "../../src/games/reuse/definition.ts";
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith("real demo API")) return;
  await page.addInitScript((key) => sessionStorage.setItem(key, "seen"), tavern.id + ".opening");
});

test("real demo API boots the Pixi board, spins and opens rules", async ({
  page,
}) => {
  const errors: string[] = [];
  const assetRequests = new Set<string>();
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/tavern-assets/"))
      assetRequests.add(new URL(response.url()).pathname);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  let releaseSession!: () => void;
  const sessionGate = new Promise<void>((resolve) => { releaseSession = resolve; });
  await page.route("**/api/session", async (route) => {
    await sessionGate;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("img", { name: "Paperclip Gaming" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Loading progress" })).toBeVisible();
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "true");
  releaseSession();
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".brand-loading")).toHaveCount(0);
  await page.locator(".opening-continue").click();
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
        (await page.locator("#spin").textContent())?.includes("SPIN"),
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
test("a lone Scatter shakes the scene and the active payline renders above the dimmer", async ({
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
      const { dimmer, winningSymbols, tiles } = this;
      const winningViews = positions.map(({ reel, row }) => tiles[reel][row + 1].view);
      markers.winFocus = String(
        dimmer.visible &&
        dimmer.parent.children.indexOf(dimmer) < dimmer.parent.children.indexOf(winningSymbols) &&
        winningSymbols.renderLayerChildren.length === winningViews.length &&
        winningViews.every((view) => view.parentRenderLayer === winningSymbols) &&
        tiles.flat().every(({ view }: { view: { alpha: number } }) => view.alpha === 1),
      );
      return played;
    };
    const clearHighlight = BoardView.prototype.clearHighlight;
    BoardView.prototype.clearHighlight = function () {
      clearHighlight.call(this);
      if (markers.winFocus)
        markers.winFocusCleared = String(!this.dimmer.visible && this.winningSymbols.renderLayerChildren.length === 0);
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
    await expect(page.locator("#spin")).toBeEnabled();
    await page.evaluate(async (count) => {
      const boardModule = "/src/framework/presentation/board.ts";
      const { BoardView } = await import(boardModule);
      const focusWins = BoardView.prototype.focusWins;
      const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
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
    const duration = await dialog.getAttribute("data-scatter-duration");
    expect(Number(duration)).toBeGreaterThan(300);
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
    return route.fulfill({ json: server.execute(command, board) });
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
    const status = document.querySelector("#status")!;
    const progress = document.querySelector("#feature-progress")!;
    const tiers: string[] = [];
    (window as any).featureTiers = tiers;
    new MutationObserver((mutations) => {
      if (!performance.getEntriesByName("feature-result-open").length) return;
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement && node.matches(".win-celebration")) {
            const label = node.querySelector("strong")?.textContent;
            if (label?.endsWith(" WIN")) tiers.push(label);
          }
        }
      }
    }).observe(document.querySelector("#app")!, { childList: true });
    document.querySelector("#continue")!.addEventListener("click", () => {
      performance.mark("feature-continue");
    }, { once: true });
    const finalPresentation = new MutationObserver(() => {
      if (progress.textContent === "0" && status.textContent?.includes("WINNING")) {
        performance.mark("final-spin-presented");
        finalPresentation.disconnect();
      }
    });
    finalPresentation.observe(status, { childList: true });
    const resultPopup = new MutationObserver(() => {
      if (dialog.open && dialog.querySelector(".reveal-chests")) {
        performance.mark("feature-result-open");
        const total = dialog.querySelector(".result-total")!;
        const amounts = [total.textContent];
        (window as any).featureAmounts = amounts;
        new MutationObserver(() => amounts.push(total.textContent)).observe(total, { childList: true });
        resultPopup.disconnect();
      }
    });
    resultPopup.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  });
  await page.locator("#continue").click();
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-mode",
    "drop",
  );
  const chestsAboveReels = await page.locator("#board canvas").evaluate(
    (canvas) => Number(getComputedStyle(document.querySelector("#chests")!).zIndex) >
      Number(getComputedStyle(canvas).zIndex),
  );
  expect(chestsAboveReels).toBe(true);
  await expect(page.getByRole("heading", { name: "Chest multipliers" })).toBeVisible({
    timeout: 35000,
  });
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
  const multipliers = page.locator(".reveal-chests .chest-multiplier");
  await expect(multipliers).toHaveText(Array(5).fill("×5"), { timeout: 24000 });
  for (const multiplier of await multipliers.all()) {
    await expect(multiplier).toHaveCSS("text-align", "center");
    expect(
      await multiplier.evaluate((label) => {
        const chest = label.parentElement!.getBoundingClientRect();
        const text = label.getBoundingClientRect();
        return Math.abs((text.x + text.width / 2) - (chest.x + chest.width / 2));
      }),
    ).toBeLessThan(1);
  }
  await expect(page.getByRole("heading", { name: "Total Win" })).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".reveal-chests")).toHaveCount(0);
  await expect(page.locator("#continue")).toBeEnabled();
  expect(new Set(await page.evaluate(() => (window as any).featureAmounts)).size).toBeGreaterThan(2);
  expect(await page.evaluate(() => (window as any).featureTiers)).toEqual([
    "BIG WIN", "SUPER WIN", "MEGA WIN", "EPIC WIN",
  ]);
  const expected = server.state.balance;
  await page.locator("#continue").click();
  await expect(page.locator("#balance")).toHaveText(
    (expected / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }),
  );
});
for (const unlocked of [false, true]) test(`feature result ${unlocked ? "shows all chests when one unlocks" : "omits chests when none unlock"}`, async ({ page }) => {
  test.setTimeout(65000);
  const game = structuredClone(tavern);
  game.demo.featureSpins.drop = 1;
  const server = new MockGame(game, () => 0);
  await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
  await page.route("**/api/command", (route) => {
    const command = route.request().postDataJSON();
    const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
    const outcome = server.execute(command, board);
    if (unlocked && outcome.completion && outcome.finalFeature) {
      outcome.finalFeature.chests[3] = { rows: [0, 1, 2, 3, 4], unlocked: true, multiplier: 2 };
      Object.assign(outcome.completion, { accumulated: 100, featureAward: 200, roundAward: 200, multipliers: [1, 1, 1, 2, 1], product: 2 });
    }
    return route.fulfill({ json: outcome });
  });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  await page.locator("#buy").click();
  await page.locator('[data-buy="drop"]').click();
  await page.locator("#confirm-buy").click();
  await expect(page.getByRole("heading", { name: "DROP BONUS" })).toBeVisible({ timeout: 15000 });
  await page.locator("#continue").click();
  if (unlocked) {
    await expect(page.getByRole("heading", { name: "Chest multipliers" })).toBeVisible({ timeout: 25000 });
    await expect(page.locator(".reveal-chests .chest")).toHaveCount(5);
    await expect(page.locator(".result-total")).toHaveText("1.00");
    await expect(page.locator(".reveal-chests .chest").nth(3).locator(".chest-multiplier")).toHaveText("×2", { timeout: 5000 });
    await expect(page.locator(".reveal-chests .chest-multiplier")).toHaveCount(1);
    await expect(page.locator(".tavern-chest-art")).toHaveAttribute("data-spine-clip", "36_reel_3_chest_open");
  }
  await expect(page.getByRole("heading", { name: "Total Win" })).toBeVisible({ timeout: 25000 });
  await expect(page.locator(".reveal-chests")).toHaveCount(0);
  await expect(page.locator(".result-total")).toHaveText(unlocked ? "2.00" : "0.00");
  await expect(page.locator("#continue")).toBeEnabled();
  if (!unlocked) {
    await expect(page.locator("#dialog")).toBeHidden({ timeout: 16000 });
    await expect(page.locator(".game-shell")).toHaveAttribute("data-mode", "base");
  }
});
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`autoplay and menu fit the ${viewport.width}px layout`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#spin")).toBeEnabled();
    const spin = page.locator("#spin");
    const turbo = page.getByRole("button", { name: "Turbo" });
    const width = (await spin.boundingBox())!.width;
    expect(width).toBeCloseTo(viewport.width > 670 ? 102 : 82.875, 1);
    await expect(turbo).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await turbo.click();
    await expect(turbo).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await expect(turbo).toHaveCSS("color", "rgb(65, 225, 251)");
    await turbo.click();
    if (viewport.width > 670) {
      await spin.hover();
      await expect(spin.locator(".hud-icon-spin")).toHaveCSS("background-color", "rgb(65, 225, 251)");
    }
    await page.getByRole("button", { name: "Autoplay", exact: true }).click();
    const panel = page.locator("#auto-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator("button")).toHaveText(["–", "10", "25", "50", "100", "250", "500", "1000"]);
    await expect(panel).toBeInViewport();
    await panel.getByRole("button", { name: "Turn autoplay off" }).click();
    await expect(panel).toBeHidden();
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
for (const [multiplier, label] of [[20, "BIG WIN"], [50, "SUPER WIN"], [75, "MEGA WIN"], [100, "EPIC WIN"]] as const) {
  test(`${label} displays its celebration`, async ({ page }) => {
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
    await page.locator("#spin").click();
    await expect(page.locator(".win-celebration strong")).toHaveText(label, { timeout: 15000 });
    await expect(page.locator(".win-celebration-value")).toHaveText(`${multiplier}.00`);
    await expect(page.locator(".win-celebration .tavern-screen-art"))
      .toHaveAttribute("data-spine-clip", label.toLowerCase().replace(/\s/g, ""));
    await expect(page.locator(".win-celebration")).toHaveCount(0, { timeout: 14000 });
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

test("Drop anticipation raises only landed Scatters above the dimmer and clears on Skip", async ({ page }) => {
  const server = new MockGame(tavern, () => 0.5);
  const board = ["A", "K", "Q", "J", "10"].map((symbol) => Array(5).fill(symbol));
  board[0][0] = "bonus";
  board[1][2] = "bonus";
  await page.route("**/api/session", (route) => route.fulfill({ json: server.state }));
  await page.route("**/api/command", (route) => route.fulfill({
    json: server.execute(route.request().postDataJSON(), board),
  }));
  await page.goto("/?game=tarvern");
  await expect(page.locator("#spin")).toBeEnabled();
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
    page.getByRole("heading", { name: "Pending round found" }),
  ).toBeVisible();
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
  const spin = page.getByRole("button", { name: "Spin", exact: true });
  await expect(spin).toBeEnabled();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reels: Drop" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "3 × 3" })).toHaveCount(0);
  await spin.click();
  await expect.poll(() => commands.length).toBe(1);
  await expect(spin).toContainText("SKIP");
  await spin.click();
  releaseResult();
  await expect(spin).toContainText("SPIN");
  await expect(page.locator("#balance")).toHaveText("999.00");

  await page.reload();
  await expect(spin).toBeEnabled();
  await spin.click();
  await expect(spin).toContainText("SPIN");
  await expect(page.locator("#balance")).toHaveText("998.00");
  expect(new Set(commands).size).toBe(2);
  expect(commands).toHaveLength(2);
});
