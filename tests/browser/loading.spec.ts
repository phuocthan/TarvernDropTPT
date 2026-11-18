import { test, expect } from "@playwright/test";
import { tavern } from "../../src/games/tavern/definition.ts";

declare global {
  interface Window {
    loadingAudit: {
      decodedAt?: number;
      contexts: number[];
      progress: { value: number; landingReady: boolean }[];
    };
  }
}

test("the intro finishes before WebGL startup, with progress reserved for the landing", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const audit = window.loadingAudit = { contexts: [], progress: [] } as Window["loadingAudit"];
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.src.endsWith("paperclip-rMFDawAD.gif")) audit.decodedAt = performance.now();
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof getContext>) {
      if (String(args[0]).startsWith("webgl")) audit.contexts.push(performance.now());
      return getContext.apply(this, args);
    };
    new MutationObserver(() => {
      const progress = document.querySelector(".brand-loading-progress");
      if (!progress || !progress.hasAttribute("aria-valuenow")) return;
      const value = Number(progress.getAttribute("aria-valuenow"));
      if (audit.progress.at(-1)?.value !== value) audit.progress.push({
        value,
        landingReady: Boolean(document.querySelector(".opening-continue") && document.querySelector("#board canvas")),
      });
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  let releaseGif!: () => void;
  const gifGate = new Promise<void>((resolve) => { releaseGif = resolve; });
  await page.route("**/paperclip-rMFDawAD.gif", async (route) => {
    await gifGate;
    await route.continue();
  });
  await page.goto("/?game=tavern", { waitUntil: "domcontentloaded" });
  // Startup downloads and the session can finish even while the GIF is pending.
  await expect(page.locator(".brand-loading-progress")).toHaveText("75%", { timeout: 15000 });
  await expect(page.locator(".brand-loading-progress")).toBeHidden();
  await expect(page.locator("#app canvas")).toHaveCount(0);
  expect(await page.evaluate(() => window.loadingAudit.contexts)).toEqual([]);
  releaseGif();
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 30000 });
  const audit = await page.evaluate(() => window.loadingAudit);
  expect(audit.decodedAt).toBeDefined();
  expect(audit.contexts.length).toBeGreaterThan(0);
  expect(Math.min(...audit.contexts) - audit.decodedAt!)
    .toBeGreaterThanOrEqual(tavern.presentation.loadingScreen!.brandIntro!.durationMs);
  expect(audit.progress.at(-1)).toEqual({ value: 100, landingReady: true });
  expect(audit.progress.every((entry, index) => index === 0 || entry.value >= audit.progress[index - 1].value)).toBe(true);
  await expect(page.locator("#app")).not.toHaveAttribute("aria-busy");
  await page.locator(".opening-continue").click();
  await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("#spin")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("a missing intro GIF falls back and still reaches the landing", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/paperclip-rMFDawAD.gif", (route) => route.abort());
  await page.goto("/?game=tavern", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".opening-continue")).toBeVisible();
  await expect(page.locator("#board canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("reduced motion uses a static logo and still unlocks the game", async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const gifs: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("paperclip-rMFDawAD.gif")) gifs.push(request.url());
  });
  await page.goto("/?game=tavern", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 30000 });
  expect(gifs).toEqual([]);
  await page.locator(".opening-continue").click();
  await expect(page.locator("#spin")).toBeEnabled();
  await expect(page.locator("#app")).not.toHaveAttribute("inert");
});

test("landing skips static symbols and does not wait for shop images or the optional font", async ({ page }) => {
  test.setTimeout(60000);
  const staticSymbols: string[] = [];
  const gameInfo: string[] = [];
  page.on("request", (request) => {
    if (/_static\.webp$/.test(request.url())) staticSymbols.push(request.url());
    if (new URL(request.url()).pathname === "/api/v1/game-info") gameInfo.push(request.url());
  });
  let releaseOptional!: () => void;
  const optionalGate = new Promise<void>((resolve) => { releaseOptional = resolve; });
  await page.route(/(?:td_ante|td_superante|td_bonus|td_super)\.webp$|outfit-700-D9T176aR\.woff2$/, async (route) => {
    await optionalGate;
    await route.continue();
  });
  try {
    await page.goto("/?game=tavern", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator(".opening-continue")).toBeVisible();
    expect(staticSymbols).toEqual([]);
    expect(gameInfo).toHaveLength(1);
    await page.locator(".opening-continue").click();
    await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator("#spin")).toBeEnabled();
  } finally { releaseOptional(); }
});
