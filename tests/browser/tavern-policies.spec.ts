import { test, expect } from "@playwright/test";

async function enter(page: import("@playwright/test").Page, params = "") {
  await page.goto("/?game=tarvern" + params);
  await expect(page.locator(".opening-continue")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".brand-loading")).toHaveCount(0, { timeout: 45000 });
  await page.locator(".opening-continue").click();
  await expect(page.locator("[data-entering]")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("#spin")).toBeEnabled({ timeout: 20000 });
}

test("Tavern arms Continue after native intro and ignores force stop while awaiting outcome", async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const audit = (window as any).continueAudit = { earlyBlocked: false, clicked: false, readyAnimation: "" };
    new MutationObserver(() => {
      const stage = document.querySelector<HTMLElement>(".stage"), shell = document.querySelector<HTMLElement>(".game-shell");
      const button = document.querySelector<HTMLButtonElement>(".opening-continue");
      if (stage?.dataset.openingAnimation === "playing" && shell && button && !audit.clicked) {
        audit.clicked = true;
        shell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        audit.earlyBlocked = button.hidden && button.disabled && shell.hasAttribute("data-opening");
      }
      if (button && !button.hidden && !button.disabled && !audit.readyAnimation) audit.readyAnimation = stage?.dataset.openingAnimation;
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await enter(page);
  const audit = await page.evaluate(() => (window as any).continueAudit);
  expect(audit.earlyBlocked).toBe(true);
  expect(audit.readyAnimation).toBe("complete");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let paidRequests = 0;
  await page.route("**/api/v1/spin", async (route) => {
    if (route.request().postDataJSON().isFreespin === 0) { paidRequests++; await gate; }
    await route.continue();
  });
  try {
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/v1/spin");
    await page.locator("#spin").click();
    await expect(page.locator("#spin")).toBeDisabled();
    await expect(page.locator("#spin")).toHaveAttribute("aria-label", "Spinning");
    await page.locator("#spin").dispatchEvent("click");
    await page.keyboard.press("Space");
    expect(paidRequests).toBe(1);
    release(); expect((await response).status()).toBe(200);
  } finally { release(); }
});

test("Tavern Scatter win uses the foreground canvas region before bonus intro", async ({ page }) => {
  test.setTimeout(90000);
  await enter(page, "&cheat=1");
  await page.locator("#buy").click();
  await page.locator("#open-bonus-debug").click();
  await expect(page.getByRole("heading", { name: "Bonus debug" })).toBeVisible();
  await page.locator(".close-modal").click();
  await page.locator('[data-buy="drop"]').click();
  await page.locator("#confirm-buy").click();
  const symbols = page.locator("#board > canvas[data-foreground-win-focus]");
  await expect(symbols).toBeVisible({ timeout: 30000 });
  const region = await symbols.evaluate((canvas) => {
    const render = canvas.getBoundingClientRect(), host = canvas.parentElement!.getBoundingClientRect();
    return { above: render.top < host.top, left: render.left < host.left, below: render.bottom > host.bottom, right: render.right > host.right };
  });
  expect(region).toEqual({ above: true, left: true, below: true, right: true });
  await page.screenshot({ path: ".runtime/foreground-scatter.png" });
  const bonus = page.locator('dialog[data-look="bonus"]');
  await expect(bonus.locator("#continue")).toBeEnabled({ timeout: 30000 });
  const spin = page.waitForResponse((response) => {
    if (!new URL(response.url()).pathname.endsWith("/spin")) return false;
    const body = response.request().postDataJSON();
    return body?.isFreespin === 1 && body.curStep === "freespin";
  }, { timeout: 45000 });
  await bonus.locator("#continue").click();
  await expect(page.locator("#free-spins")).toBeVisible();
  expect((await spin).status()).toBe(200);
});

test("Tavern locks both bonus purchases by default and leaves the wallet unchanged", async ({ page }) => {
  test.setTimeout(90000);
  const purchases: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/buy-feature")) purchases.push(request.method());
  });
  await enter(page);
  const balanceLabel = page.locator("#balance");
  await expect(balanceLabel).toHaveText(/₩[\d,]+/);
  const balance = await balanceLabel.textContent();
  for (const mode of ["tavern", "drop"]) {
    await page.locator("#buy").click();
    await expect(page.locator("#open-bonus-debug")).toHaveCount(0);
    await page.locator(`[data-buy="${mode}"]`).click();
    await page.locator("#confirm-buy").click();
    await expect(page.getByRole("heading", { name: "Bonus not available" })).toBeVisible();
    await page.locator("#notice-ok").click();
    await expect(balanceLabel).toHaveText(balance!);
  }
  expect(purchases).toEqual([]);
});

test("Tavern keeps Bonus Buy and Bonus Debug locked when the preview is off", async ({ page }) => {
  test.setTimeout(90000);
  await enter(page, "&cheat=0");
  await page.locator("#buy").click();
  await expect(page.locator("#open-bonus-debug")).toHaveCount(0);
  await page.locator('[data-buy="tavern"]').click();
  await page.locator("#confirm-buy").click();
  await expect(page.getByRole("heading", { name: "Bonus not available" })).toBeVisible();
});

for (const [quality, viewport] of [
  ["hd", { width: 820, height: 882 }],
  ["sd", { width: 390, height: 844 }],
] as const) {
  test(`Tavern paints the foreground table with the ${quality} atlas`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await enter(page, `&quality=${quality}`);
    const table = page.locator("#scene-table .table.base-art");
    await expect(table).toHaveAttribute("data-spine-table", "");
    await expect(table).toHaveCSS("background-image", new RegExp(`/${quality}/td_master\\.webp`));
    await expect(table).toHaveCSS("opacity", "1");
    const box = (await table.boundingBox())!;
    const hud = (await page.locator(".tavern-hud").boundingBox())!;
    expect(box.y).toBeLessThan(hud.y + hud.height);
    expect(box.y + box.height).toBeGreaterThan(hud.y);
    await page.screenshot({ path: `.runtime/table-after-${quality}.png` });
  });
}
