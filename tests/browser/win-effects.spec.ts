import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend, ProposalError } from "../../server/proposal-backend.ts";
import { tavern } from "../../src/games/tavern/definition.ts";

/*
 * Fixture: rng 0.3, Buy Tavern with one free spin, base bet ₩1,000 (charge ₩50,000).
 * Five chests lead to a ₩480,000 feature award (480×), so the round plays the Epic Win
 * sequence (big → super → mega → epic) and then Total Win.
 */
interface Entry { t: number; kind: string; what: string | number; arg?: unknown }

/** Records Spine clips, audio cues and shockwave runs from the Vite source modules. */
async function instrument(page: Page) {
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource")
    .some(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))), { timeout: 45000 }).toBe(true);
  await page.evaluate(async () => {
    const w = window as any;
    const log: Entry[] = [];
    w.qaLog = log;
    const at = () => Math.round(performance.now());
    w.qaMark = (what: string) => log.push({ t: at(), kind: "mark", what });
    const spineUrl = performance.getEntriesByType("resource")
      .find(({ name }) => /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/.test(name))!.name;
    const { AnimationState } = await import(spineUrl);
    const clips = /^(total_win_end|0_base_enter|1_zoom_out|2_base_enter|smallwin|bigwin|superwin|megawin|epicwin|maxwin)$/;
    const setAnimation = AnimationState.prototype.setAnimation;
    AnimationState.prototype.setAnimation = function (track: number, name: string, loop: boolean) {
      if (clips.test(name)) log.push({ t: at(), kind: "clip", what: name });
      if (name === w.qaSkipClip) w.qaSkipArmed = true;
      return setAnimation.call(this, track, name, loop);
    };
    const busUrl = "/src/framework/audio/howler-bus.ts";
    const { AudioBus } = await import(busUrl);
    for (const method of ["cue", "fade"]) {
      const original = AudioBus.prototype[method];
      AudioBus.prototype[method] = function (name: string, ...rest: unknown[]) {
        log.push({ t: at(), kind: method, what: name, arg: rest[0] });
        // Press Skip twice in the same task right after a chosen cue, without test-runner latency.
        if (method === "cue" && name === w.qaSkipOn && w.qaSkipArmed) {
          w.qaSkipOn = null;
          setTimeout(() => {
            w.qaMark("skip-x2");
            const spin = document.querySelector<HTMLButtonElement>("#spin")!;
            spin.click();
            spin.click();
          }, 0);
        }
        return original.call(this, name, ...rest);
      };
    }
    // Titles and amounts of every win celebration, in order.
    const overlays: { titles: string[]; values: number[] }[] = [];
    w.qaOverlays = overlays;
    new MutationObserver((changes) => {
      for (const change of changes) for (const node of Array.from(change.addedNodes)) {
        if (!(node instanceof HTMLElement) || !node.matches(".win-celebration")) continue;
        const record = { titles: [] as string[], values: [] as number[] };
        overlays.push(record);
        const title = node.querySelector("strong")!;
        const value = node.querySelector(".win-celebration-value")!;
        record.titles.push(title.textContent!);
        new MutationObserver(() => record.titles.push(title.textContent!)).observe(title, { childList: true, characterData: true, subtree: true });
        new MutationObserver(() => record.values.push(Number(value.textContent!.replace(/\D/g, ""))))
          .observe(value, { childList: true, characterData: true, subtree: true });
      }
    }).observe(document.querySelector("#app")!, { childList: true });
    const shockwaveUrl = "/src/framework/presentation/shockwave.ts";
    const { ShockwaveFilter } = await import(shockwaveUrl);
    const setCenter = ShockwaveFilter.prototype.setCenter;
    ShockwaveFilter.prototype.setCenter = function (x: number, y: number) {
      log.push({ t: at(), kind: "shockwave", what: "attach" });
      return setCenter.call(this, x, y);
    };
    const time = Object.getOwnPropertyDescriptor(ShockwaveFilter.prototype, "time")!;
    Object.defineProperty(ShockwaveFilter.prototype, "time", {
      configurable: true,
      get: time.get,
      set(value: number) {
        if (value === 2.4) log.push({ t: at(), kind: "shockwave", what: "end" });
        time.set!.call(this, value);
      },
    });
  });
}
const readLog = (page: Page) => page.evaluate(() => (window as any).qaLog as Entry[]);

test("v1 Epic Win announces each tier once and Total Win returns to base on one click", {
  tag: "@qa-behavior",
  annotation: { type: "qa-expected", description: "The Epic Win clip plays once; each Spine tier event (big, super, mega, epic) gives one wincap cue and one shockwave, even after a double Skip, and the amount only counts up. One Total Win click (three taps) fades Continue, plays total_win_end with a shockwave, enters the base background and then the reels, confirms once and credits ₩480,000 once." },
}, async ({ page }) => {
  test.setTimeout(300000);
  const dir = mkdtempSync(join(tmpdir(), "tavern-win-effects-"));
  const config = structuredClone(tavern);
  config.demo.featureSpins.tavern = 1;
  const backend = new ProposalBackend([config], join(dir, "state.json"), { rng: () => 0.3 });
  const requests: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Pixi reports shader compile/link failures (a black filtered canvas) on the console only.
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|PixiJS Error/i.test(message.text())) errors.push(message.text());
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), url = new URL(request.url()), headers = request.headers();
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
    await page.goto("/?game=tarvern");
    await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 45000 });
    await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
    await page.locator(".opening-continue").click();
    await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
    await instrument(page);
    await page.evaluate(() => Object.assign(window as any, { qaSkipOn: "td_wincap_bigwin", qaSkipClip: "epicwin" }));
    await page.locator("#buy").click();
    await page.locator('[data-buy="tavern"]').click();
    await page.locator("#confirm-buy").click();
    const bonus = page.locator('dialog[data-look="bonus"]');
    await expect(bonus).toBeVisible({ timeout: 30000 });
    await expect(bonus.locator("#continue")).toBeEnabled();
    await bonus.locator("#continue").click();

    // ---- Epic Win: double Skip right after its first tier (free spins may show smaller wins first) ----
    await expect(page.locator('.win-celebration [data-spine-clip="epicwin"]')).toHaveCount(1, { timeout: 180000 });
    await expect(page.locator(".win-celebration")).toHaveCount(0, { timeout: 60000 });
    const fullLog = await readLog(page);
    const epicStart = fullLog.find((e) => e.kind === "clip" && e.what === "epicwin")!.t;
    // The Epic sequence starts with td_wincap_start and the counting loop just before its clip.
    const epicIntro = fullLog.filter((e) => e.kind === "cue" && e.what === "td_wincap_start" && e.t <= epicStart).at(-1)!;
    expect(epicStart - epicIntro.t).toBeLessThan(2000);
    const winLog = fullLog.filter((e) => e.t >= epicIntro.t);
    expect(winLog.some((e) => e.kind === "mark" && e.what === "skip-x2")).toBe(true);
    const tiers = winLog.filter((e) => e.kind === "cue" && String(e.what).startsWith("td_wincap_") &&
      !["td_wincap_start", "td_wincap_end"].includes(String(e.what))).map((e) => e.what);
    expect(winLog.filter((e) => e.kind === "clip" && /win$/.test(String(e.what))).map((e) => e.what)).toEqual(["epicwin"]);
    // Every tier at most once, in ascending order, ending at Epic.
    expect(new Set(tiers).size).toBe(tiers.length);
    const order = ["td_wincap_bigwin", "td_wincap_superwin", "td_wincap_megawin", "td_wincap_epicwin"];
    expect(tiers.map((cue) => order.indexOf(String(cue)))).toEqual([...tiers.map((cue) => order.indexOf(String(cue)))].sort((a, b) => a - b));
    expect(tiers.at(-1)).toBe("td_wincap_epicwin");
    // One shockwave per announced tier, removed after it ran.
    for (const [index, cue] of tiers.entries()) {
      const at = winLog.find((e) => e.what === cue)!.t;
      const next = index + 1 < tiers.length ? winLog.find((e) => e.what === tiers[index + 1])!.t : Infinity;
      expect(winLog.some((e) => e.kind === "shockwave" && e.what === "attach" && e.t >= at && e.t < next)).toBe(true);
    }
    const epic: { titles: string[]; values: number[] } = await page.evaluate(() => (window as any).qaOverlays.at(-1));
    const titles = epic.titles;
    const labels = ["BIG WIN", "SUPER WIN", "MEGA WIN", "EPIC WIN"];
    expect(titles.map((title) => labels.indexOf(title)).every((rank, i, all) => rank >= 0 && (i === 0 || rank >= all[i - 1]))).toBe(true);
    expect(titles.at(-1)).toBe("EPIC WIN");
    const values = epic.values;
    expect(values.every((value, i) => i === 0 || value >= values[i - 1])).toBe(true);
    expect(values.at(-1)).toBe(480000);
    // Audio lifecycle: start + counting loop, then the loop fades and the end cues play once.
    const count = (what: string, kind = "cue") => winLog.filter((e) => e.kind === kind && e.what === what);
    expect(count("td_wincap_start")).toHaveLength(1);
    expect(count("count").map((e) => e.arg)).toEqual([true]);
    expect(count("count", "fade")).toHaveLength(1);
    expect(count("countEnd")).toHaveLength(1);
    expect(count("td_wincap_end")).toHaveLength(1);

    // ---- Total Win: three taps start the outro once ----
    const totalWin = page.locator('dialog[data-look="total-win"]');
    await expect(totalWin).toBeVisible({ timeout: 60000 });
    await expect(page.locator("#continue")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#continue")).toBeEnabled();
    await expect(page.locator("#balance")).toHaveText("₩9,950,000");
    const clickedAt = await page.evaluate(() => {
      (window as any).qaMark("total-win-click");
      const now = Math.round(performance.now());
      const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
      for (let i = 0; i < 3; i++) dialog.click();
      return now;
    });
    await expect.poll(() => page.locator("#continue").evaluate((button) => getComputedStyle(button).opacity), { timeout: 10000 }).toBe("0");
    await expect(page.locator("#spin")).toHaveAttribute("aria-label", "Spin", { timeout: 60000 });
    await expect(page.locator("#spin")).toBeEnabled();
    await expect(page.locator("#balance")).toHaveText("₩10,430,000", { timeout: 10000 });
    const outroLog = (await readLog(page)).filter((e) => e.t >= clickedAt);
    const first = (what: string) => outroLog.find((e) => e.what === what);
    expect(outroLog.filter((e) => e.kind === "cue" && e.what === "totalOutro")).toHaveLength(1);
    expect(outroLog.filter((e) => e.kind === "clip" && e.what === "total_win_end")).toHaveLength(1);
    for (const what of ["totalOutro", "total_win_end", "1_zoom_out", "0_base_enter", "2_base_enter"]) expect(first(what), what).toBeTruthy();
    expect(outroLog.some((e) => e.kind === "shockwave" && e.what === "attach" && e.t <= first("0_base_enter")!.t)).toBe(true);
    // Reference beats: base background ~200 ms, reels ~500 ms after the click (timers only run late).
    expect(first("0_base_enter")!.t - clickedAt).toBeGreaterThanOrEqual(150);
    expect(first("2_base_enter")!.t - clickedAt).toBeGreaterThanOrEqual(450);
    expect(first("2_base_enter")!.t).toBeGreaterThanOrEqual(first("0_base_enter")!.t);
    expect(requests.filter((req) => req.curStep === "free-end")).toHaveLength(1);
    // The shared #dialog element stays in the DOM; Total Win must be closed.
    await expect(page.locator('dialog[data-look="total-win"][open]')).toHaveCount(0);
    expect(await page.locator("#board").evaluate((host) => host.style.opacity)).toBe("");
    await expect(page.locator(".stage")).not.toHaveAttribute("data-chest-reveal", "true");
    const account = Object.values((backend as any).database.accounts as Record<string, any>)[0]["tavern-drop"];
    const round = Object.values(account.rounds as Record<string, any>)[0];
    expect(round.settlement).toMatchObject({ status: "paid", creditedMinor: 480000 });
    expect(account.walletVersion).toBe(2);
    expect(errors).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
