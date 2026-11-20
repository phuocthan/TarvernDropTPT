import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProposalBackend, ProposalError } from "../../server/proposal-backend.ts";
import { tavern } from "../../src/games/tavern/definition.ts";

for (const step of ["intro", "freespin"] as const) {
  for (const mode of ["tavern", "drop"] as const) {
    test(`landing resumes ${mode} ${step} in its correct scene without another game-info`, {
      tag: "@qa-behavior", annotation: { type: "qa-expected", description: "Restore the saved scene and free-spin count without a new paid spin or buy request." },
    }, async ({ page }) => {
      test.setTimeout(90000);
      const dir = mkdtempSync(join(tmpdir(), "tavern-startup-"));
      const backend = new ProposalBackend([tavern], join(dir, "state.json"), { rng: () => 0.5 });
      const userId = `startup-${mode}-${step}`;
      const login = backend.login({ userId });
      const auth = { sessionId: login.sessionId, token: login.token, playToken: "" };
      const info = backend.handle("POST", "/game-info", {}, auth);
      auth.playToken = info.playToken as string;
      let issued: any = backend.handle("POST", "/buy-feature", { betMinor: 1000, featureMode: mode }, auth);
      if (step === "freespin") issued = backend.handle("POST", "/spin", { isFreespin: 1, curStep: "intro", stepId: issued.stepId }, auth);
      await page.addInitScript(({ key, userId, step }) => {
        localStorage.setItem(key, userId);
        if (step !== "intro") return;
        const attribute = "data-foreground-win-focus";
        new MutationObserver((records) => {
          if (document.querySelector(`canvas[${attribute}]`) || records.some((record) =>
            record.target instanceof HTMLCanvasElement && record.oldValue !== null))
            document.documentElement.dataset.qaSawScatterWin = "true";
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: [attribute], attributeOldValue: true });
      }, { key: tavern.id + ".proposal-v1.user", userId, step });
      const requests: { path: string; body: Record<string, unknown> }[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request(), url = new URL(request.url()), headers = request.headers(), body = request.postDataJSON() ?? {};
        requests.push({ path: url.pathname, body });
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
        await expect(page.locator("#recover")).toHaveCount(0);
        await expect(page.locator(".brand-loading")).toHaveCount(0);
        await expect(page.locator(".game-shell")).toHaveAttribute("data-opening", "true");
        await page.locator(".opening-continue").click();
        if (step === "intro") {
          await expect(page.locator("html")).toHaveAttribute("data-qa-saw-scatter-win", "true", { timeout: 15000 });
          await expect(page.locator("#recover")).toHaveCount(0);
        } else await expect(page.locator("#recover")).toBeVisible();
        await expect(page.locator(".game-shell")).not.toHaveAttribute("data-opening", "true");
        await expect(page.locator(".game-shell")).toHaveAttribute("data-entry-scene", step === "intro" ? "base" : "feature");
        await expect(page.locator(".game-shell")).toHaveAttribute("data-mode", step === "intro" ? "base" : mode);
        expect(requests.filter((request) => request.path.endsWith("game-info"))).toHaveLength(1);
        if (step === "freespin") {
          await expect(page.locator("#feature-progress")).toHaveText(String(issued.freegame.remainSpin));
          await expect(page.locator(".stage")).toHaveAttribute("data-foreground-chests", "");
          await expect(page.locator("#chests .chest")).toHaveCount(0);
        }
        expect(requests.filter((request) => request.path.endsWith("spin"))).toHaveLength(0);
        if (step === "freespin") await page.locator("#recover").click();
        if (step === "intro") {
          await expect(page.locator('dialog[data-look="bonus"]')).toBeVisible();
          expect(requests.filter((request) => request.body.curStep === "intro")).toHaveLength(0);
          await expect(page.locator("canvas[data-foreground-win-focus]")).toHaveCount(0);
        } else {
          await expect(page.locator(".game-shell")).toHaveAttribute("data-mode", mode);
          await expect(page.locator("#feature-progress")).toHaveText(String(issued.freegame.remainSpin));
          await expect(page.locator(".stage")).toHaveAttribute("data-foreground-chests", "");
          await expect(page.locator("#chests .chest")).toHaveCount(0);
          await expect(page.locator('dialog[data-look="bonus"]')).not.toBeVisible();
        }
        await expect(page.locator("[data-entering]")).toHaveCount(0);
        expect(requests.filter((request) => request.path.endsWith("game-info"))).toHaveLength(1);
        expect(requests.filter((request) => request.path.endsWith("buy-feature") || request.body.isFreespin === 0)).toHaveLength(0);
        expect(errors).toEqual([]);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }
}
