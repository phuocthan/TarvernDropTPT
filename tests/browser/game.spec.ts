import { test, expect } from "@playwright/test";
import { MockGame } from "../../server/mock-game.ts";
import { tavern } from "../../src/games/tavern/definition.ts";
test("real demo API boots the Pixi board, spins and opens rules", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  await expect(page.locator("#balance")).toHaveText("1,000.00");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.locator("#continue").isVisible()) ||
        (await page.locator("#spin").textContent())?.includes("SPIN"),
      { timeout: 15000 },
    )
    .toBeTruthy();
  if (await page.locator("#continue").isVisible())
    await page.locator("#continue").click();
  await expect(page.locator("#spin")).toContainText("SPIN");
  await page.locator("#rules").click();
  await expect(
    page.getByRole("heading", { name: "Inside the tavern" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("bonus purchase, five chests, distinct modes and completion use server results", async ({
  page,
}) => {
  const game = structuredClone(tavern);
  game.demo.featureSpins.drop = 2;
  const server = new MockGame(game, () => 0.5);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: server.state }),
  );
  await page.route("**/api/command", (route) =>
    route.fulfill({
      json: server.execute(
        route.request().postDataJSON(),
        Array.from({ length: 5 }, () => ["A", "K", "Q", "J", "10"]),
      ),
    }),
  );
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  await page.locator("#buy").click();
  await page.locator('[data-buy="drop"]').click();
  await page.locator("#confirm-buy").click();
  await expect(
    page.getByRole("heading", { name: "DROP BONUS", exact: true }),
  ).toBeVisible();
  await page.locator("#continue").click();
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-mode",
    "drop",
  );
  await page.locator("#spin").click();
  await expect(page.locator(".chest.unlocked")).toHaveCount(5);
  await expect(page.locator("#spin")).toContainText("SPIN");
  await page.locator("#spin").click();
  await expect(
    page.getByRole("heading", { name: "YOUR TREASURE" }),
  ).toBeVisible();
  await expect(page.locator(".multiplier-reveal span")).toHaveCount(5);
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
test("desktop landscape keeps spin controls inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.locator("#spin")).toBeEnabled();
  const spin = await page.locator("#spin").boundingBox();
  expect(spin!.y + spin!.height).toBeLessThanOrEqual(720);
  await page.screenshot({
    path: "/tmp/tavern-template-landscape.png",
    fullPage: true,
  });
});
