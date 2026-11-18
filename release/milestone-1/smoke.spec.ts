import { test, expect } from '@playwright/test';
for (const [query, size, motion] of [['tavern', '5 × 5', 'drop'], ['default', '3 × 3', 'normal']]) {
 test(`M1 ${size} ${motion} uses shared v1 runtime and survives reload`, async ({ page }) => {
  const errors: string[] = [], missing: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
  const calls: {path: string; method: string; body: any}[] = [];
  page.on('request', request => { if (request.url().includes('/api/v1/')) calls.push({ path: request.url(), method: request.method(), body: request.postDataJSON() }); });
  await page.goto(`/?game=${query}`);
  await expect(page.locator('#reuse-spin')).toBeEnabled();
  await expect(page.locator('.board-details')).toContainText(`${size} reels`);
  await expect(page.locator('.board-details')).toContainText(`${motion} spin`);
  const before = await page.locator('#reuse-balance').innerText();
  const reply = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/spin');
  await page.locator('#reuse-spin').click();
  const result = await (await reply).json();
  expect(result.synthetic).toBe(true);
  await expect(page.locator('#reuse-spin')).toHaveText('Spin');
  await expect(page.locator('#reuse-status')).toContainText(/Win|No line win/);
  await expect(page.locator('#reuse-balance')).toContainText(/₩[\d,]+/);
  const balance = await page.locator('#reuse-balance').innerText();
  await page.screenshot({ path: `docs/milestone-1-evidence/${query === 'tavern' ? '5x5-drop' : '3x3-normal'}.jpg`, type: 'jpeg', quality: 85 });
  await page.reload(); await expect(page.locator('#reuse-spin')).toBeEnabled();
  await expect(page.locator('#reuse-balance')).toHaveText(balance);
  expect(calls.filter(call => call.path.endsWith('/spin'))).toHaveLength(1);
  for (const call of calls) { expect(call.method).toBe('POST'); expect(new URL(call.path).search).toBe(''); expect(typeof call.body.gameCode).toBe('string'); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `docs/milestone-1-evidence/${query}-portrait.jpg`, type: 'jpeg', quality: 85 });
  expect(errors).toEqual([]); expect(missing).toEqual([]);
 });
}
