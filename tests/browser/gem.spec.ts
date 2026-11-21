import { expect, test, type Page } from "@playwright/test";

function paidSpin(url: URL, body: string | null) {
  return url.pathname === "/api/v1/spin" && JSON.parse(body ?? "{}").isFreespin === 0;
}

async function spin(page: Page) {
  const response = page.waitForResponse((r) => paidSpin(new URL(r.url()), r.request().postData()));
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  return (await response).json();
}

test("Gem Reels spins in both profiles and recovers a recorded wager on reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?game=gem");
  const button = page.locator("#reuse-spin");
  const picker = page.getByLabel("Reel motion");
  const status = page.getByRole("status");
  await expect(page.getByRole("heading", { name: "Gem Reels" })).toBeVisible();
  await expect(page.locator("#reuse-board canvas")).toBeVisible();
  await expect(picker).toHaveValue("normal");
  await expect(page.locator(".board-details")).toContainText("4 × 3 reels");
  const normal = await spin(page);
  expect(normal).toMatchObject({ code: 0, currency: "USD", currencyExponent: 2, chargedMinor: 100, roundCapMinor: 5000 });
  expect(normal.reels).toHaveLength(12);
  await expect(button).toHaveText("Spin");

  await page.setViewportSize({ width: 360, height: 740 });
  await picker.selectOption("drop");
  await expect(page.locator(".board-details")).toContainText("drop spin");
  const drop = await spin(page);
  expect(drop.code).toBe(0);
  expect(drop.reels).toHaveLength(12);
  await expect(button).toHaveText("Spin");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  let recorded: typeof drop;
  let token: string;
  let originalBody: string | null;
  await page.route("**/api/v1/spin", async (route) => {
    const request = route.request();
    if (!paidSpin(new URL(request.url()), request.postData())) return route.continue();
    originalBody = request.postData();
    token = request.headers()["play-token"];
    recorded = await (await route.fetch()).json();
    await route.abort("failed");
  }, { times: 1 });
  await button.click();
  await expect(button).toHaveText("Recover result");
  await page.reload();
  await expect(button).toHaveText("Recover result");
  const replay = page.waitForResponse((r) => paidSpin(new URL(r.url()), r.request().postData()));
  await button.click();
  const response = await replay;
  const recovered = await response.json();
  await expect(status).toHaveText(/Round restored · Win \$[\d,.]+/);
  await expect(button).toHaveText("Spin");
  expect(response.request().headers()["play-token"]).toBe(token!);
  expect(response.request().postData()).toBe(originalBody!);
  expect(recovered.roundId).toBe(recorded!.roundId);
  expect(recovered.wallet).toEqual(recorded!.wallet);
  expect(recovered.reels).toEqual(recorded!.reels);
  expect(errors).toEqual([]);
});
