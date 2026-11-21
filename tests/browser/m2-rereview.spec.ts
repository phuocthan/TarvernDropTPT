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

async function mountMock(page: Page, baseBoard: Board, holdCompletion?: Promise<void>,
  backend = new ProposalBackend([tavern], null, { baseBoard }), delayReply?: (body: Record<string, unknown>) => Promise<void> | undefined) {
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
      await delayReply?.(body);
      await route.fulfill({ json: reply });
    } catch (error) {
      if (error instanceof ProposalError)
        await route.fulfill({ status: error.status, json: { error: error.message, ...error.details } });
      else await route.fulfill({ status: 500, json: { error: String(error) } });
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

    // Second tap in a separate round, during the win lines: they shorten, the amount stays.
    await tapSpace(page);
    await expect(page.locator(".game-shell")).toHaveAttribute("data-present-phase", "lines", { timeout: 15000 });
    await tapSpace(page);
    await expect(spin).toHaveAccessibleName("Spin", { timeout: 20000 });
    await expect(page.locator("#spin-win-amount")).toHaveText("₩79,000");

    // Continuous hold (reference): one wager at a time, the next only after the previous round
    // was presented and confirmed. Key repeat never adds a wager; release stops the series.
    const wagers = () => calls.filter(({ body }) => body.isFreespin === 0).length;
    const completions = () => calls.filter(({ body }) => body.curStep === "base").length;
    const before = wagers();
    await page.keyboard.down("Space");
    await page.waitForTimeout(460);
    await expect(speed).toHaveAttribute("aria-pressed", "true");
    if (process.env.M2_SCREENS === "1") await page.screenshot({ path: testInfo.outputPath("space-held.png"), timeout: 25000 });
    await page.keyboard.down("Space");
    await expect.poll(wagers, { timeout: 30000 }).toBeGreaterThanOrEqual(before + 3);
    expect(wagers() - completions()).toBeLessThanOrEqual(1);
    await page.keyboard.up("Space");
    await expect(speed).toHaveAttribute("aria-pressed", String(turbo));
    if (process.env.M2_SCREENS === "1") await page.screenshot({ path: testInfo.outputPath("space-released.png"), timeout: 25000 });
    await expect(spin).toHaveAccessibleName("Spin", { timeout: 20000 });
    const settled = wagers();
    expect(completions()).toBe(settled);
    await page.waitForTimeout(2500);
    expect(wagers()).toBe(settled);
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

test("a play-area tap skips the reels and lines without ever placing a wager", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const calls = await mountMock(page, win79k);
  await enter(page);
  const wagers = () => calls.filter(({ body }) => body.isFreespin === 0).length;
  const board = page.locator("#board canvas");
  // Idle tap: nothing happens.
  await board.click({ position: { x: 200, y: 200 } });
  await page.waitForTimeout(600);
  expect(wagers()).toBe(0);
  await page.locator("#spin").click();
  await expect.poll(wagers).toBe(1);
  // Tap while the reels drop: they finish quickly but visibly, then every line is still shown.
  await board.dispatchEvent("pointerdown", { button: 0 });
  await expect(page.locator(".game-shell")).toHaveAttribute("data-present-phase", "lines", { timeout: 15000 });
  await board.dispatchEvent("pointerdown", { button: 0 });
  await expect(page.locator("#spin")).toHaveAccessibleName("Spin", { timeout: 20000 });
  await board.dispatchEvent("pointerdown", { button: 0 });
  await expect(page.locator("#spin-win-amount")).toHaveText("₩79,000");
  await page.waitForTimeout(800);
  expect(wagers()).toBe(1);
  expect(calls.filter(({ body }) => body.curStep === "base")).toHaveLength(1);
});

test("an interrupted win is shown before its completion is sent, with Spin locked", async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const backend = new ProposalBackend([tavern], null, { baseBoard: win79k });
  const calls = await mountMock(page, win79k, undefined, backend);
  await enter(page);
  await page.locator("#spin").click();
  await expect.poll(() => calls.filter(({ body }) => body.isFreespin === 0).length).toBe(1);
  // Reload before the round is presented; the completion reply is then held.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const calls2 = await mountMock(page, win79k, hold, backend);
  const completion = page.waitForRequest((request) => request.url().endsWith("/spin") && request.postDataJSON()?.curStep === "base");
  await enter(page);
  try {
    const request = await completion;
    await expect(page.locator("#spin-win-amount")).toHaveText("₩79,000");
    await expect(page.locator("#spin")).toBeDisabled();
    const shownAt = Number(await page.locator(".stage").getAttribute("data-recovered-win-shown"));
    expect(shownAt).toBeGreaterThan(0);
    expect(request.postDataJSON()).toMatchObject({ kind: "shown_as_result" });
  } finally { release(); }
  await expect(page.locator("#balance")).toHaveText("₩10,059,000", { timeout: 20000 });
  await expect(page.locator("#spin")).toBeEnabled();
  expect(calls2.filter(({ body }) => body.isFreespin === 0)).toHaveLength(0);
});

test("two windows: a stale click reconciles and a late reply never regresses wallet or Spin", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const backend = new ProposalBackend([tavern], null, { baseBoard: win79k });
  const a = await context.newPage();
  const b = await context.newPage();
  a.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") console.log("A console:", message.text()); });
  a.on("pageerror", (error) => console.log("A pageerror:", error.message));
  // A's completion commits on the server, but its reply is delivered late.
  let releaseA!: () => void;
  const heldA = new Promise<void>((resolve) => { releaseA = resolve; });
  // B's completion is held before the server sees it, so B's newer round stays open.
  let releaseB!: () => void;
  const heldB = new Promise<void>((resolve) => { releaseB = resolve; });
  const callsA = await mountMock(a, win79k, undefined, backend,
    (body) => body.curStep === "base" ? heldA : undefined);
  const callsB = await mountMock(b, win79k, heldB, backend);
  // Background pages pause animation frames: bring the window under test to the front.
  await a.bringToFront();
  await enter(a);
  await b.bringToFront();
  await enter(b);
  await expect(b.locator("#balance")).toHaveText("₩10,000,000");
  try {
    // A wins ₩79,000; the server settles it to ₩10,059,000, A's reply is still in flight.
    await a.bringToFront();
    await a.locator("#spin").click();
    await expect.poll(() => callsA.filter(({ body }) => body.curStep === "base").length, { timeout: 20000 }).toBe(1);
    // B clicks on the token it loaded: reconciled, and A's round is never presented in B.
    await b.bringToFront();
    await b.locator("#spin").click();
    await expect(b.locator("dialog[open] h2")).toHaveText("Game Updated");
    await expect(b.locator("#balance")).toHaveText("₩10,059,000");
    await expect(b.locator("#spin-win-amount")).toBeHidden();
    expect(callsB.filter(({ body }) => body.isFreespin === 0).every(({ reply }) => !(reply as any).roundId)).toBe(true);
    await b.locator("#notice-ok").click();
    // B starts the newer round (₩10,039,000) and keeps it open.
    await b.locator("#spin").click();
    await expect.poll(() => callsB.filter(({ body, reply }) => body.isFreespin === 0 && (reply as any).roundId).length).toBe(1);
  } finally { releaseA(); }
  await a.bringToFront();
  // A's late ₩10,059,000 reply arrives: A shows the current ₩10,039,000 and stays locked.
  const startedAt = Date.now();
  try {
    await expect(a.locator("#balance")).toHaveText("₩10,039,000", { timeout: 20000 });
  } catch (error) {
    console.log("A dialog:", await a.locator("dialog[open]").textContent().catch(() => null),
      "A calls:", JSON.stringify(callsA.map(({ body, reply }) => [body.curStep ?? body.isFreespin ?? "info", (reply as any).wallet?.confirmedBalanceMinor])),
      "elapsed", Date.now() - startedAt);
    throw error;
  }
  await expect(a.locator("#spin")).toBeDisabled();
  await expect(a.locator("#spin")).toHaveAccessibleName("Round open in another window");
  releaseB();
  await b.bringToFront();
  await expect(b.locator("#balance")).toHaveText("₩10,118,000", { timeout: 20000 });
  await a.bringToFront();
  await expect(a.locator("#spin")).toBeEnabled({ timeout: 10000 });
  await expect(a.locator("#balance")).toHaveText("₩10,118,000");
  // Exactly two rounds, each debited once and credited once.
  const rounds = [...callsA, ...callsB].filter(({ body, reply }) => body.isFreespin === 0 && (reply as any).roundId);
  expect(new Set(rounds.map(({ reply }) => (reply as any).roundId)).size).toBe(2);
  await context.close();
});

test("portrait HUD keeps the full balance beside the bet arrows at ₩200,000 Super Chance (320 → 390 px)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await mountMock(page, zeroWin);
  await enter(page);
  for (let i = 0; i < 30; i++) await page.locator("#bet-up").click({ force: true }).catch(() => undefined);
  await expect(page.locator("#bet")).toHaveText("₩200,000");
  await page.locator("#buy").click();
  await page.locator("dialog[open]").getByRole("button", { name: /super chance/i }).click();
  await page.locator("#confirm-buy").click();
  await expect(page.locator("#chance-cost")).toContainText("₩1,200,000");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => {
      const balance = document.getElementById("balance")!;
      const arrow = document.querySelector("#bet-down > *")!;
      const range = document.createRange();
      range.selectNodeContents(balance);
      return {
        text: balance.textContent, right: range.getBoundingClientRect().right,
        left: range.getBoundingClientRect().left, arrow: arrow.getBoundingClientRect().left,
        clipped: balance.scrollWidth > balance.clientWidth + 1, page: document.documentElement.scrollWidth,
      };
    });
    expect(box.text).toBe("₩10,000,000");
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.arrow);
    expect(box.clipped).toBe(false);
    expect(box.page).toBe(width);
  }
});
