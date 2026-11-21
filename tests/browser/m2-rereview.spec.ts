import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { ProposalBackend, ProposalError } from "../../server/proposal-backend.ts";
import { tavern } from "../../src/games/tavern/definition.ts";
import type { Board } from "../../src/framework/domain/contracts.ts";
import { beginReviewCapture } from "./fixtures/review-capture.ts";
import { win79k, zeroWin } from "./fixtures/m2-rounds.ts";

test.describe.configure({ timeout: process.env.M2_CAPTURE === "1" ? 180000 : 120000 });
test.use({ reducedMotion: process.env.M2_REDUCED_MOTION === "1" ? "reduce" : "no-preference" });

const captures = new WeakMap<Page, () => Promise<void>>();
async function startCapture(page: Page, testInfo: TestInfo) {
  if (process.env.M2_CAPTURE === "1")
    captures.set(page, await beginReviewCapture(page, testInfo.outputPath("review.mp4"), testInfo.outputPath("capture-frames")));
}
test.afterEach(async ({ page }) => { await captures.get(page)?.(); });

async function mountMock(page: Page, baseBoard: Board, holdCompletion?: Promise<void>) {
  const backend = new ProposalBackend([tavern], null, { baseBoard });
  const calls: { body: Record<string, unknown>; reply: ReturnType<ProposalBackend["handle"]> }[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const headers = request.headers();
    const body = request.postDataJSON() ?? {};
    try {
      if (body.curStep === "base" && holdCompletion) await holdCompletion;
      const reply = backend.handle(request.method(), new URL(request.url()).pathname.slice(7), body, {
        sessionId: headers["session-id"] ?? "",
        token: (headers.authorization ?? "").slice(7),
        playToken: headers["play-token"] ?? "",
      });
      calls.push({ body, reply });
      await route.fulfill({ json: reply });
    } catch (error) {
      await route.fulfill({ status: error instanceof ProposalError ? error.status : 500, json: { error: String(error) } });
    }
  });
  return calls;
}

async function enter(page: Page) {
  await page.goto("/?game=tavern");
  await page.locator(".opening-continue").click({ timeout: 45000 });
  await expect(page.locator(".tavern-hud")).not.toHaveAttribute("inert", "", { timeout: 30000 });
  await expect(page.locator(".game-shell[data-entering]")).toHaveCount(0, { timeout: 12000 });
}

async function tapSpace(page: Page) {
  await page.keyboard.down("Space");
  if (process.env.M2_CAPTURE === "1") await page.waitForTimeout(65);
  await page.keyboard.up("Space");
}

async function showSpaceKeys(page: Page) {
  if (process.env.M2_CAPTURE !== "1" && process.env.M2_SCREENS !== "1") return;
  await page.evaluate(() => {
    const cue = document.createElement("div");
    cue.style.cssText = "position:fixed;z-index:99999;top:38px;left:12px;padding:6px 10px;background:#102439;color:white;pointer-events:none;font:16px sans-serif";
    cue.textContent = "Space ↑ released";
    document.body.append(cue);
    window.addEventListener("keydown", (event) => { if (event.code === "Space") cue.textContent = "Space ↓ pressed"; });
    window.addEventListener("keyup", (event) => { if (event.code === "Space") cue.textContent = "Space ↑ released"; });
  });
}

test("portrait shows Chance base and costs, then restores the recorded KRW 79,000 win on reload", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await mountMock(page, win79k);
  await enter(page);
  await startCapture(page, testInfo);
  for (const [mode, cost] of [["extra", "₩60,000"], ["super", "₩120,000"]]) {
    await page.locator("#buy").click();
    await page.locator("dialog[open]").getByRole("button", { name: new RegExp(mode + " chance", "i") }).click();
    await page.locator("#confirm-buy").click();
    await expect(page.locator("#bet")).toHaveText("₩20,000");
    await expect(page.locator("#chance-cost")).toContainText(cost);
    await expect(page.locator("#chance-cost")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    if (process.env.M2_SCREENS === "1") await page.screenshot({ path: testInfo.outputPath(mode + "-chance.png"), timeout: 25000 });
    if (process.env.M2_CAPTURE === "1") await page.waitForTimeout(650);
    await page.locator("#buy").click();
    await expect(page.locator("#chance-cost")).toBeHidden();
  }
  await page.locator("#spin").click();
  await expect.poll(() => calls.filter(({ body }) => body.isFreespin === 0).length).toBe(1);
  const wager = calls.find(({ body }) => body.isFreespin === 0)!;
  expect(wager.reply).toMatchObject({ totalwin_amt: 79000, canStartPaidRound: false, wallet: { confirmedBalanceMinor: 9980000 } });
  await enter(page);
  await expect(page.locator("#spin-win-amount")).toHaveText("₩79,000");
  await expect(page.locator("#balance")).toHaveText("₩10,059,000");
  await expect(page.locator("#spin")).toBeEnabled({ timeout: 20000 });
  const completion = calls.find(({ body }) => body.curStep === "base")!;
  expect(completion.body).toMatchObject({ kind: "shown_as_result", stepId: wager.reply.stepId });
  expect(completion.reply.roundId).toBe(wager.reply.roundId);
  expect(calls.filter(({ body }) => body.isFreespin === 0)).toHaveLength(1);
  if (process.env.M2_SCREENS === "1") await page.screenshot({ path: testInfo.outputPath("restored-win-79000.png"), timeout: 25000 });
  if (process.env.M2_CAPTURE === "1") await page.waitForTimeout(900);
});

test("zero-win round locks Spin until the completion response arrives", async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  await mountMock(page, zeroWin, hold);
  await enter(page);
  const spin = page.locator("#spin");
  const completion = page.waitForRequest((request) => request.url().endsWith("/spin") && request.postDataJSON()?.curStep === "base");
  await spin.click();
  try {
    await completion;
    await expect(spin).toBeDisabled();
    await expect(spin).toHaveAccessibleName("Round in progress");
  } finally { release(); }
  await expect(spin).toHaveAccessibleName("Spin", { timeout: 20000 });
  await expect(page.locator("#balance")).toHaveText("₩9,980,000");
});

for (const turbo of [false, true]) {
  test(`Space skips only presentation and restores the selected speed (${turbo ? "Turbo" : "Normal"})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const calls = await mountMock(page, win79k);
    await enter(page);
    await showSpaceKeys(page);
    await startCapture(page, testInfo);
    const spin = page.locator("#spin");
    const speed = page.locator("#speed");
    if (turbo) await speed.click();
    await page.locator(".game-shell").evaluate((element) => { (element as HTMLElement).tabIndex = -1; (element as HTMLElement).focus(); });
    // Second tap during reel motion.
    await tapSpace(page);
    await expect(spin).toHaveAccessibleName("Skip", { timeout: 15000 });
    await tapSpace(page);
    await expect(spin).toHaveAccessibleName("Spin", { timeout: 20000 });
    await expect(page.locator("#spin-win-amount")).toHaveText("₩79,000");

    // Second tap in a separate round, while the HUD amount is counting.
    await tapSpace(page);
    await expect(page.locator("#spin-win-amount")).not.toHaveText("₩0", { timeout: 10000 });
    await expect(spin).toHaveAccessibleName("Skip", { timeout: 15000 });
    await tapSpace(page);
    await expect(spin).toHaveAccessibleName("Spin", { timeout: 20000 });
    await expect(page.locator("#spin-win-amount")).toHaveText("₩79,000");

    // Hold fires one wager. Repeat events never place another.
    await page.keyboard.down("Space");
    await page.waitForTimeout(460);
    await expect(speed).toHaveAttribute("aria-pressed", "true");
    if (process.env.M2_SCREENS === "1") await page.screenshot({ path: testInfo.outputPath("space-held.png"), timeout: 25000 });
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(speed).toHaveAttribute("aria-pressed", String(turbo));
    if (process.env.M2_SCREENS === "1") await page.screenshot({ path: testInfo.outputPath("space-released.png"), timeout: 25000 });
    await expect(spin).toHaveAccessibleName("Spin", { timeout: 20000 });
    expect(calls.filter(({ body }) => body.isFreespin === 0)).toHaveLength(3);
    expect(calls.filter(({ body }) => body.curStep === "base")).toHaveLength(3);
    if (process.env.M2_CAPTURE === "1") await page.waitForTimeout(650);
  });
}



test("a 112.5x tiered base win exposes Skip and completes one recorded payout", async ({ page }) => {
  const allWild = Array.from({ length: tavern.reels }, () => Array(tavern.rows).fill("wild"));
  const calls = await mountMock(page, allWild);
  await enter(page);
  await page.locator("#speed").click();
  await page.locator("#spin").click();
  await expect(page.locator(".win-celebration")).toBeVisible({ timeout: 35000 });
  await expect(page.locator("#spin")).toHaveAccessibleName("Skip");
  await expect(page.locator("#spin")).toBeEnabled();
  await tapSpace(page);
  await expect(page.locator("#spin")).toHaveAccessibleName("Spin", { timeout: 30000 });
  expect(calls.filter(({ body }) => body.isFreespin === 0)).toHaveLength(1);
  expect(calls.filter(({ body }) => body.curStep === "base")).toHaveLength(1);
  await expect(page.locator("#spin-win-amount")).toHaveText("₩2,250,000");
});
