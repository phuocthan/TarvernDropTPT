import { test, expect } from "@playwright/test";

test("v1 menu keeps Info, sound and music, and Info matches the reference page", {
  tag: "@qa-behavior",
  annotation: { type: "qa-expected", description: "The game menu lists Info, sound and music only (no Share). Each channel icon mutes and restores its level. Info opens the reference page with Game Rules, Paytable, Ways to Win (15 payline grids), Features and General Terms; Escape, a click or the close button dismisses it, and Space does not spin while it is open." },
}, async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/?game=tarvern");
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
  await page.locator(".opening-continue").click();
  await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
  await page.locator("#menu").click();
  const panel = page.locator("#hud-menu-panel");
  await expect(panel.locator("#menu-share")).toHaveCount(0);
  await expect(panel.locator("#menu-rules")).toHaveText(/info/i);
  await expect(panel.locator(".menu-volume")).toHaveCount(2);
  for (const channel of ["effects", "music"]) {
    const icon = panel.locator(`#${channel}-icon .hud-icon`);
    const slider = panel.locator(`#${channel}-volume`);
    const level = await slider.inputValue();
    expect(Number(level)).toBeGreaterThan(0);
    await expect(icon).toHaveClass(new RegExp(`hud-icon-${channel}(\\s|$)`));
    await panel.locator(`#${channel}-icon`).click();
    await expect(slider).toHaveValue("0");
    await expect(icon).toHaveClass(new RegExp(`hud-icon-${channel}-muted`));
    await panel.locator(`#${channel}-icon`).click();
    await expect(slider).toHaveValue(level);
  }
  await panel.locator("#menu-rules").click();
  const info = page.locator("dialog.info-screen");
  await expect(info).toBeVisible();
  await expect(info.locator(".info-section > h1")).toHaveText(["Game Rules", "Paytable", "Ways to Win", "Features", "General Terms"]);
  await expect(info.locator(".info-payline")).toHaveCount(15);
  await expect(info.locator(".info-paytable-column-container")).toHaveCount(10);
  await expect(info.locator(".info-content-image")).toHaveAttribute("src", /bonus_static\.webp$/);
  expect(await info.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(info).toContainText("The max win is 10,000x the bet.");
  await page.keyboard.press("Space");
  await expect(page.locator("#spin")).toHaveAttribute("aria-label", "Spin");
  await page.keyboard.press("Escape");
  await expect(info).toHaveCount(0);
  await page.locator("#menu").click();
  await panel.locator("#menu-rules").click();
  await expect(info).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(info).toHaveCount(0);
});
