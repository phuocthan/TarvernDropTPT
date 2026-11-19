import { test, expect } from "@playwright/test";
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
 test(`win artwork and amount stay inside canvas ${viewport.width}x${viewport.height}`, async ({ page }) => {
  test.setTimeout(90000); await page.setViewportSize(viewport);
  await page.goto('/?game=default'); await expect(page.locator('#reuse-spin')).toBeEnabled();
  await page.evaluate(async () => { const { mountWinScreen } = await import('/tests/browser/fixtures/win-screen.ts'); (window as any).winScreen = await mountWinScreen(); });
  for (const clip of ['bigwin', 'superwin', 'megawin', 'epicwin', 'maxwin']) {
   await page.evaluate(async ({clip}) => { await (window as any).winScreen.show(clip, '₩100,000,000'); }, {clip});
   const result = await page.evaluate(({clip}) => (window as any).winScreen.seek(clip, clip === 'maxwin' ? 9 : 1), {clip});
   if (clip === 'maxwin') await page.screenshot({path:`.runtime/maxwin-${viewport.width}.png`});
   const frames = await page.evaluate(({clip, duration}) => Array.from({ length: 33 }, (_, i) =>
     (window as any).winScreen.seek(clip, duration * i / 32)), {clip, duration: result.duration});
   for (const frame of frames.filter((frame: any) => frame.visible)) {
     expect(frame.amount.x).toBeGreaterThanOrEqual(14);
     expect(frame.amount.y).toBeGreaterThanOrEqual(14);
     expect(frame.amount.x + frame.amount.width).toBeLessThanOrEqual(frame.canvas.width - 14);
     expect(frame.amount.y + frame.amount.height).toBeLessThanOrEqual(frame.canvas.height - 14);
   }
  }
 });
}


test("newly unlocked chest renders native activation FX before idle and opens into open idle", async ({ page }) => {
  await page.goto("/?game=default");
  await expect(page.locator("#reuse-spin")).toBeEnabled();
  const clips = await page.evaluate(async () => {
    const { mountWinScreen } = await import("/tests/browser/fixtures/win-screen.ts");
    return (await mountWinScreen(true)).checkChestClips();
  });
  expect(clips).toEqual({
    activating: "30_reel_0_chest_activate",
    hasActivationSlots: true,
    idle: "30_reel_0_chest_idle",
    open: "30_reel_0_chest_open",
    openIdle: "30_reel_0_chest_open_idle",
  });
});
