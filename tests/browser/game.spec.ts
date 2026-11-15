import { test, expect } from "@playwright/test";
import { MockGame } from "../../server/mock-game.ts";
import { tavern } from "../../src/games/tavern/definition.ts";
import { reuse } from "../../src/games/reuse/definition.ts";
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
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  await expect(page.locator("#balance")).toHaveText("1,000.00");
  await page.locator("#rules").click();
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

test("free spins autoplay through a retrigger and reveal centered Drop multipliers", async ({
  page,
}) => {
  test.setTimeout(60000);
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
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.locator("#continue").click();
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-mode",
    "drop",
  );
  const reelsAboveChests = await page.locator("#board canvas").evaluate(
    (canvas) => Number(getComputedStyle(canvas).zIndex) >
      Number(getComputedStyle(document.querySelector("#chests")!).zIndex),
  );
  expect(reelsAboveChests).toBe(true);
  await expect(page.getByRole("heading", { name: "Total Win" })).toBeVisible({
    timeout: 25000,
  });
  expect(requests).toHaveLength(3);
  expect(new Set(requests).size).toBe(3);
  const multipliers = page.locator(".reveal-chests .chest-multiplier");
  await expect(multipliers).toHaveText(Array(5).fill("×5"));
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
  const expected = server.state.balance;
  await page.locator("#continue").click();
  await expect(page.locator("#balance")).toHaveText(
    (expected / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }),
  );
  await page.screenshot({
    path: "/tmp/tavern-template-desktop.png",
    fullPage: true,
  });
});
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
  expect(machineLayer).toBeGreaterThan(mascotLayer);
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
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reels: Drop" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "3 × 3" })).toHaveCount(0);
  await spin.click();
  await expect(page.getByRole("status")).toHaveText("Waiting for the symbols…");
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
