import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend, ProposalError } from "../../server/proposal-backend.ts";
import { tavern } from "../../src/games/tavern/definition.ts";

/*
 * Fixture (rng 0.5, Drop Buy with one free spin, base bet ₩1,000, charge ₩100,000):
 * show-chest, then five open-chest steps. Chest 1 (reel 1, ×25) shows ₩937,500.
 * Chest 2 (reel 2, ×25) reaches the ₩10,000,000 round cap. Final award ₩10,000,000.
 */
const CHEST_1_AMOUNT = "₩937,500";
const CAPPED_AMOUNT = "₩10,000,000";
const BALANCE_DURING_ROUND = "₩9,900,000";
const BALANCE_AFTER_SETTLEMENT = "₩19,900,000";

type Body = Record<string, unknown>;
interface Logged { path: string; body: Body; outcome: "fulfilled" | "aborted"; afterReload: boolean }
interface ChestWatch { clips: string[]; amounts: string[]; opening: string[]; opened: string[] }

/** Records chest clips, the native chest-total text and stage chest attributes from this page load onward. */
async function watchChests(page: Page) {
  const spine = /esotericsoftware_spine-pixi-v8\.js(?:\?|$)/;
  await expect.poll(() => page.evaluate((source) => performance.getEntriesByType("resource")
    .some(({ name }) => new RegExp(source).test(name)), spine.source), { timeout: 45000 }).toBe(true);
  await page.evaluate(async (source) => {
    const w = window as any;
    if (w.qaChest) return;
    const spineUrl = performance.getEntriesByType("resource").find(({ name }) => new RegExp(source).test(name))!.name;
    const { AnimationState, Spine } = await import(spineUrl);
    const qa: ChestWatch = { clips: [], amounts: [], opening: [], opened: [] };
    w.qaChest = qa;
    let total: { text: string } | undefined;
    const updateSlotObject = Spine.prototype.updateSlotObject;
    Spine.prototype.updateSlotObject = function (attachment: { slot: { data: { name: string } }; container: { children: { text: string }[] } }) {
      if (attachment.slot.data.name === "slot_finalwin") total = attachment.container.children[0];
      return updateSlotObject.call(this, attachment);
    };
    const setAnimation = AnimationState.prototype.setAnimation;
    AnimationState.prototype.setAnimation = function (track: number, name: string, loop: boolean) {
      if (/_reel_\d_chest_open(_idle)?$/.test(name)) qa.clips.push(name);
      return setAnimation.call(this, track, name, loop);
    };
    const sample = () => {
      const text = total?.text;
      if (text && text !== qa.amounts.at(-1)) qa.amounts.push(text);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const stage = document.querySelector<HTMLElement>(".stage")!;
    new MutationObserver(() => {
      const { chestOpening, chestOpened } = stage.dataset;
      if (chestOpening && chestOpening !== qa.opening.at(-1)) qa.opening.push(chestOpening);
      if (chestOpened && chestOpened !== qa.opened.at(-1)) qa.opened.push(chestOpened);
    }).observe(stage, { attributes: true, attributeFilter: ["data-chest-opening", "data-chest-opened"] });
  }, spine.source);
}
const watched = (page: Page) => page.evaluate(() => structuredClone((window as any).qaChest as ChestWatch));

async function waitForOpening(page: Page) {
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
}

const variants = [
  { id: "released", label: "released but not yet presented",
    note: "Reload immediately after the first chest confirmation returns and the second chest is released." },
  { id: "presented", label: "presented but its confirmation lost",
    note: "The second chest animation and amount finish on screen; its confirmation never reaches the server before reload." },
] as const;

for (const variant of variants) test(`v1 reload between chest reveals resumes the unconfirmed chest (${variant.label})`, {
  tag: "@qa-behavior",
  annotation: { type: "qa-expected", description: `${variant.note} After reload and Resume, the confirmed first chest stays open without replaying, the confirmed ₩937,500 total is restored, only the second chest opens and updates the total, and the final confirmation settles the paid round once.` },
}, async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), "tavern-chest-resume-"));
  const config = structuredClone(tavern);
  config.demo.featureSpins.drop = 1;
  const backend = new ProposalBackend([config], join(dir, "state.json"), { rng: () => 0.5 });
  const log: Logged[] = [];
  const gameInfos: Body[] = [];
  let roundId = "";
  let reloaded = false;
  const errors: string[] = [];
  page.on("pageerror", (error) => { if (reloaded) errors.push(error.message); });

  const database = () => (backend as any).database as { accounts: Record<string, Record<string, any>> };
  const account = () => Object.values(database().accounts).map((games) => games["tavern-drop"])
    .find((item) => item?.rounds?.[roundId])!;
  const round = () => account().rounds[roundId];
  const chestIds = () => (round().steps as { stepId: string; curStep: string }[])
    .filter((step) => step.curStep === "open-chest").map((step) => step.stepId);
  const stepIndex = (stepId: string) => (round().steps as { stepId: string }[]).findIndex((step) => step.stepId === stepId);
  const acks = (stepId: string, outcome?: Logged["outcome"]) => log.filter((item) =>
    item.body.stepId === stepId && (!outcome || item.outcome === outcome));

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), url = new URL(request.url()), headers = request.headers();
    const body: Body = request.postDataJSON() ?? {};
    // Until reload, the second chest confirmation is lost before it reaches the server.
    if (!reloaded && roundId && body.curStep === "open-chest" && body.stepId === chestIds()[1]) {
      log.push({ path: url.pathname, body, outcome: "aborted", afterReload: reloaded });
      return route.abort("connectionreset");
    }
    try {
      const result = backend.handle(request.method(), url.pathname.slice(7), body, {
        sessionId: headers["session-id"] ?? "", token: (headers.authorization ?? "").slice(7), playToken: headers["play-token"] ?? "",
      });
      if (url.pathname.endsWith("/buy-feature")) roundId = result.roundId as string;
      if (url.pathname.endsWith("/game-info")) gameInfos.push(result);
      await route.fulfill({ json: result });
      log.push({ path: url.pathname, body, outcome: "fulfilled", afterReload: reloaded });
    } catch (error) {
      await route.fulfill({ status: error instanceof ProposalError ? error.status : 500, json: { error: String(error) } });
      log.push({ path: url.pathname, body, outcome: "fulfilled", afterReload: reloaded });
    }
  });

  try {
    await page.goto("/?game=tarvern");
    await waitForOpening(page);
    await watchChests(page);
    await page.locator(".opening-continue").click();
    await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
    await page.locator("#buy").click();
    await page.locator('[data-buy="drop"]').click();
    await page.locator("#confirm-buy").click();
    const bonus = page.locator('dialog[data-look="bonus"]');
    await expect(bonus).toBeVisible({ timeout: 30000 });
    await expect(bonus.locator("#continue")).toBeEnabled();
    await bonus.locator("#continue").click();

    // The fixture must give at least two openable chests with distinct visible totals.
    await expect.poll(() => roundId).not.toBe("");
    const [chest1, chest2] = chestIds();
    expect(chestIds().length).toBeGreaterThanOrEqual(2);
    expect(round().steps[stepIndex(chest1)]).toMatchObject({ reel: 1, displayWinMinor: 937500 });
    expect(round().steps[stepIndex(chest2)]).toMatchObject({ reel: 2, displayWinMinor: 10000000 });

    await expect.poll(() => acks(chest1, "fulfilled").length, { timeout: 120000 }).toBe(1);
    if (variant.id === "presented") {
      await expect.poll(() => acks(chest2, "aborted").length, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
      expect((await watched(page)).amounts.at(-1)).toBe(CAPPED_AMOUNT);
    }
    const before = await watched(page);
    expect(before.amounts).toContain(CHEST_1_AMOUNT);
    expect(before.opening[0]).toBe("0");
    await testInfo.attach(`before-reload-${variant.id}`, { body: await page.screenshot(), contentType: "image/png" });

    // Server: chest 1 confirmed, chest 2 released and still unconfirmed.
    expect(round().presentedThrough).toBe(stepIndex(chest1) + 1);
    expect(round().releasedThrough).toBe(stepIndex(chest2) + 1);
    expect(round().settlement.status).toBe("pending");

    reloaded = true;
    await page.reload();
    await waitForOpening(page);
    const resume = gameInfos.at(-1)!.resume as { mode: string; step: { stepId: string }; snapshot: { stepId: string } };
    expect(resume.mode).toBe("play_step");
    expect(resume.step.stepId).toBe(chest2);
    expect(resume.snapshot.stepId).toBe(chest1);
    await watchChests(page);
    await page.locator(".opening-continue").click();
    await expect(page.locator("#recover")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".game-shell")).toHaveAttribute("data-entry-scene", "feature");
    expect(log.filter((item) => item.afterReload && item.body.curStep === "open-chest")).toHaveLength(0);
    await page.locator("#recover").click();

    // Only chest 2 (reel index 1) opens; chest 1 is restored open without its opening clip.
    await expect(page.locator(".stage")).toHaveAttribute("data-chest-opened", "1", { timeout: 30000 });
    await expect.poll(async () => (await watched(page)).amounts, { timeout: 15000 }).toContain(CAPPED_AMOUNT);
    const resumed = await watched(page);
    expect(resumed.opening[0]).toBe("1");
    expect(resumed.opening).not.toContain("0");
    expect(resumed.clips).toContain("30_reel_0_chest_open_idle");
    expect(resumed.clips).not.toContain("30_reel_0_chest_open");
    expect(resumed.clips).toContain("32_reel_1_chest_open");
    expect(resumed.amounts[0]).toBe(CHEST_1_AMOUNT);
    await testInfo.attach(`after-resume-${variant.id}`, { body: await page.screenshot(), contentType: "image/png" });

    // Confirmation for chest 2 follows its visible update; chest 1 is never confirmed again.
    await expect.poll(() => acks(chest2, "fulfilled").length, { timeout: 30000 }).toBe(1);
    const afterReloadChestAcks = log.filter((item) => item.afterReload && item.body.curStep === "open-chest");
    expect(afterReloadChestAcks[0].body.stepId).toBe(chest2);
    expect(acks(chest1)).toHaveLength(1);

    await expect(page.locator('dialog[data-look="total-win"]')).toBeVisible({ timeout: 90000 });
    await expect(page.locator("#balance")).toHaveText(BALANCE_DURING_ROUND);
    expect(round().settlement.status).toBe("pending");
    await expect(page.locator("#continue")).toBeVisible();
    await expect(page.locator("#continue")).toBeEnabled();
    await page.locator("#dialog").click({ position: { x: 20, y: 20 } });
    await expect.poll(() => log.filter((item) => item.body.curStep === "free-end").length).toBe(1);
    await expect(page.locator("#spin")).toBeEnabled({ timeout: 15000 });
    await expect(page.locator("#balance")).toHaveText(BALANCE_AFTER_SETTLEMENT);

    // One paid round: one debit, one credit of the capped final award.
    expect(round().presentationStatus).toBe("completed");
    expect(round().settlement).toMatchObject({ status: "paid", creditedMinor: 10000000 });
    expect(account().balance).toBe(19900000);
    expect(account().walletVersion).toBe(2);
    expect(Object.keys(account().rounds)).toHaveLength(1);
    expect(Object.keys(account().wagers)).toHaveLength(1);
    expect(log.filter((item) => item.path.endsWith("/buy-feature") || item.body.isFreespin === 0)).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
