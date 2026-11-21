import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend, ProposalError } from "../../server/proposal-backend.ts";
import { tavern } from "../../src/games/tavern/definition.ts";

const won = (amount: number) => "₩" + new Intl.NumberFormat("en-US").format(amount);

async function enter(page: import("@playwright/test").Page, params = "") {
  await page.goto("/?game=tarvern" + params);
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
  await page.locator(".opening-continue").click();
  await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
}
test("v1 real localhost API boots mobile KRW and accepts a paid spin", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  const apiRequests: { method: string; search: string; gameCode: unknown }[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) apiRequests.push({ method: request.method(), search: url.search, gameCode: request.postDataJSON()?.gameCode });
  });
  const logins: { url: string; status: number; body: Record<string, unknown> }[] = [];
  page.on("response", (res) => {
    if (new URL(res.url()).pathname === "/api/v1/login")
      logins.push({ url: res.url(), status: res.status(), body: res.request().postDataJSON() });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page);
  await expect(page.locator("#balance")).toHaveText("₩10,000,000");
  await expect(page.locator("#bet")).toHaveText(won(tavern.defaultBet));
  await page.reload();
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
  await page.locator(".opening-continue").click();
  await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
  expect(logins).toHaveLength(2);
  expect(logins.every((login) => login.status === 200 && new URL(login.url).search === "" && login.body.gameCode === "tavern-drop")).toBeTruthy();
  expect(logins[0].body.userId).toBe(logins[1].body.userId);
  await expect(page.locator("#balance")).toHaveText("₩10,000,000");
  const measurements = await page.locator(".tavern-hud").evaluate((hud) => ({
    width: hud.getBoundingClientRect().right,
    amounts: [...hud.querySelectorAll<HTMLElement>(".hud-money strong")].filter((el) => el.offsetWidth).map((el) => ({ text: el.textContent, right: el.getBoundingClientRect().right })),
  }));
  expect(measurements.width).toBeLessThanOrEqual(391);
  expect(measurements.amounts.every((item) => item.right <= 391)).toBeTruthy();
  const response = page.waitForResponse((res) => res.url().includes("/api/v1/spin") && res.request().method() === "POST");
  await page.locator("#spin").click();
  const spinResponse = await response;
  expect(new URL(spinResponse.url()).search).toBe("");
  expect(spinResponse.request().postDataJSON().gameCode).toBe("tavern-drop");
  const spin = await spinResponse.json();
  expect(spin.currency).toBe("KRW");
  expect(spin.chargedMinor).toBe(tavern.defaultBet);
  expect(spin.reels).toHaveLength(25);
  expect(apiRequests.every((request) => request.method === "POST" && request.search === "" && request.gameCode === "tavern-drop")).toBeTruthy();
  expect(errors).toEqual([]);
});

test("v1 HTTP endpoints require POST bodies and reject route query parameters", async ({ request }) => {
  const loginResponse = await request.post("/api/v1/login", { data: { gameCode: "tavern-drop", userId: "contract-" + crypto.randomUUID() } });
  expect(loginResponse.status()).toBe(200);
  const login = await loginResponse.json();
  const headers = { "Session-Id": login.sessionId, Authorization: `Bearer ${login.token}` };
  for (const path of ["/api/v1/game-info", "/api/v1/rounds/status"]) {
    const response = await request.post(path, { headers, data: { gameCode: "tavern-drop" } });
    expect(response.status()).toBe(200);
    expect((await response.json()).currency).toBe("KRW");
    expect((await request.get(path, { headers })).status()).toBe(405);
    const query = await request.post(path + "?gameCode=tavern-drop", { headers, data: { gameCode: "tavern-drop" } });
    expect(query.status()).toBe(400);
    expect((await query.json()).error).toBe("QUERY_PARAMETERS_NOT_ALLOWED");
  }
  expect((await request.post("/api/v1/login", { data: {} })).status()).toBe(400);
});

test("v1 UI resumes intro, opens each chest and ACKs Total Win only after Continue", {
  tag: "@qa-behavior", annotation: { type: "qa-expected", description: "Reload resumes the same bonus intro. Chest steps advance in order, and Continue confirms Total Win once before unlocking Spin." },
}, async ({ page }) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), "tavern-ui-v1-"));
  const config = structuredClone(tavern);
  config.demo.featureSpins.drop = 1;
  const backend = new ProposalBackend([config], join(dir, "state.json"), { rng: () => 0.5 });
  const requests: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const headers = request.headers();
    const body = request.postDataJSON() ?? {};
    requests.push({ path: url.pathname, ...body });
    try {
      const result = backend.handle(request.method(), url.pathname.slice(7), body, {
        sessionId: headers["session-id"] ?? "", token: (headers.authorization ?? "").slice(7), playToken: headers["play-token"] ?? "",
      });
      await route.fulfill({ json: result });
    } catch (error) { await route.fulfill({ status: error instanceof ProposalError ? error.status : 500, json: { error: String(error) } }); }
  });
  try {
    await enter(page, "&cheat=1");
    await page.locator("#buy").click();
    const shopClose = await page.locator(".close-modal").boundingBox();
    expect(shopClose?.width).toBeCloseTo(61.2, 1);
    await page.locator('[data-buy="drop"]').click();
    await page.locator("#confirm-buy").click();
    await expect(page.locator('dialog[data-look="bonus"]')).toBeVisible({ timeout: 30000 });
    expect(requests.filter((req) => req.curStep === "intro")).toHaveLength(0);
    await page.reload();
    await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
    await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#recover")).toHaveCount(0);
    await expect(page.locator(".game-shell")).toHaveAttribute("data-opening", "true");
    await page.locator(".opening-continue").click();
    await expect(page.locator("canvas[data-foreground-win-focus]")).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator("#recover")).toHaveCount(0);
    await expect(page.locator(".game-shell")).toHaveAttribute("data-entry-scene", "base");
    await expect(page.locator(".game-shell")).not.toHaveAttribute("data-opening", "true");
    await expect(page.locator('dialog[data-look="bonus"]')).toBeVisible({ timeout: 30000 });
    const bonusDialog = page.locator('dialog[data-look="bonus"]');
    const continueButton = bonusDialog.locator("#continue");
    await expect(bonusDialog).toHaveCSS("overflow-y", "clip");
    await continueButton.hover();
    // Hovering Continue only brightens it; it no longer moves up.
    await expect(continueButton).toHaveCSS("translate", "none");
    const veil = page.locator(".scene-reveal-veil");
    const hasClickMotion = await continueButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      return button.getAnimations().some((animation) =>
        (animation.effect as KeyframeEffect).getKeyframes().some((frame) => frame.scale === "1.14"));
    });
    expect(hasClickMotion).toBe(true);
    // Reference v13 has no extra veil; the screens fade slot alone clears the dim.
    await expect(veil).toHaveCount(0);
    expect(requests.filter((req) => req.curStep === "intro")).toHaveLength(0);
    await expect(page.locator('dialog[data-look="total-win"]')).toBeVisible({ timeout: 90000 });
    expect(requests.filter((req) => req.curStep === "open-chest")).toHaveLength(5);
    expect(requests.filter((req) => req.curStep === "free-end")).toHaveLength(0);
    await expect(page.locator("#balance")).toHaveText(won(config.demo.initialBalance - config.defaultBet * config.demo.buyPrices.drop));
    await page.screenshot({ path: ".runtime/v1-total-win.png" });
    // Wait for the Total Win intro before clicking the dialog outside the button.
    await expect(page.locator("#continue")).toBeVisible();
    await expect(page.locator("#continue")).toBeEnabled();
    await page.locator("#dialog").click({ position: { x: 20, y: 20 } });
    await expect(veil).toHaveCount(0);
    await expect.poll(() => requests.filter((req) => req.curStep === "free-end").length).toBe(1);
    await expect(page.locator("#spin")).toBeEnabled({ timeout: 15000 });
    await expect(veil).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("v1 audio menu loads one Howler pack for sprite aliases", async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  const audioRequests: string[] = [];
  await page.addInitScript(() => {
    const diagnostics = { sources: 0, htmlPlays: 0 };
    Object.assign(window, { m2AudioDiagnostics: diagnostics });
    const sources: { context: BaseAudioContext; time: number }[] = [];
    let mediaPlayback = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
      diagnostics.sources++;
      const channel = this.buffer?.getChannelData(0);
      const sampleRate = this.buffer?.sampleRate ?? 0;
      const from = Math.floor((offset ?? 0) * sampleRate);
      if (channel?.subarray(from, from + sampleRate / 4).some((sample) => Math.abs(sample) > 0.0001))
        sources.push({ context: this.context, time: Math.max(when ?? 0, this.context.currentTime) });
      return Reflect.apply(start, this, [when, offset, duration].filter((value) => value !== undefined));
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      // Howler may create a detached Audio element. Its events never reach window.
      diagnostics.htmlPlays++;
      const initialTime = this.currentTime;
      const advanced = () => {
        if (this.currentTime <= initialTime + 0.01) return;
        mediaPlayback++;
        this.removeEventListener("timeupdate", advanced);
      };
      this.addEventListener("timeupdate", advanced);
      const playback = play.call(this);
      void playback?.catch(() => this.removeEventListener("timeupdate", advanced));
      return playback;
    };
    Object.assign(window, { m2AudioPlaybackCount: () =>
      sources.filter(({ context, time }) => context.state === "running" && context.currentTime > time + 0.02).length +
      mediaPlayback,
    });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/td_sounds\.(ogg|mp3)$/.test(new URL(request.url()).pathname)) audioRequests.push(request.url());
  });
  const response = page.waitForResponse((res) => /td_sounds\.(ogg|mp3)$/.test(new URL(res.url()).pathname));
  await enter(page);
  await page.locator("#menu").click();
  await page.locator("#music-volume").focus();
  await page.locator("#music-volume").press("ArrowRight");
  expect((await response).status()).toBe(200);
  const playbackCount = () => page.evaluate(() => (window as Window & { m2AudioPlaybackCount: () => number }).m2AudioPlaybackCount());

  await page.locator("#effects-volume").focus();
  await page.locator("#effects-volume").press("End");
  await page.locator("#menu").click();
  const beforeClick = await playbackCount();
  await page.locator("#bet-up").click();
  try {
    await expect.poll(playbackCount, { timeout: 30000 }).toBeGreaterThan(beforeClick);
  } catch (error) {
    const diagnostics = await page.evaluate(() => (window as Window & { m2AudioDiagnostics: object }).m2AudioDiagnostics);
    throw Error(JSON.stringify(diagnostics), { cause: error });
  }
  expect(audioRequests).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("v1 3x3 game shares the runtime and routes gameCode in the spin payload", async ({ page }) => {
  await page.goto("/?game=default");
  await expect(page.locator("#reuse-board canvas")).toHaveAttribute("aria-label", "3 by 3 reel board");
  await expect(page.locator("#reuse-balance")).toHaveText("Balance ₩10,000,000");
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/v1/spin");
  await page.locator("#reuse-spin").click();
  const spin = await response;
  expect(new URL(spin.url()).search).toBe("");
  expect(spin.request().postDataJSON().gameCode).toBe("reuse");
  expect((await spin.json()).reels).toHaveLength(9);
  await expect(page.locator("#reuse-spin")).toBeEnabled();
  await page.reload();
  await expect(page.locator("#reuse-board canvas")).toHaveAttribute("aria-label", "3 by 3 reel board");
  await expect(page.locator("#reuse-spin")).toBeEnabled();
});
