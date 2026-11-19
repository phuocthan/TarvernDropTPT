import { PNG } from "pngjs";
import { fixtureId, installFixture, lateScatter } from "./comparison-fixture.mjs";

const modes = ["normal", "turbo"];
const hudControls = ["#buy", "#balance", "#bet-picker", "#bet-down", "#bet-up", "#spin", "#auto", "#speed"];
const stableStyle = "#game-clock { visibility: hidden !important; }";
const dropSteps = ["queued", "entered", "landed"];

export const tavernComparison = {
  id: "tavern-drop-p0",
  viewports: [{ id: "desktop", width: 1280, height: 720 }, { id: "portrait", width: 390, height: 844 }],
  steps: [
    ["landing", "Landing · Continue ready"],
    ["transition", "Landing → game · first transition frame"],
    ["game", "Game · controls ready"],
    ["hud", "HUD · controls and bounds"],
    ["bet", "Bet menu open"],
    ...modes.flatMap((mode) => dropSteps.map((phase) => [`drop-${mode}-${phase}`, `Drop ${mode} · ${phase}`])),
  ],
  async run(args) {
    if (args.side.reference) await runReference(args);
    else await runInternal(args);
  },
};

async function boxesFor(page, selectors) {
  return page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
    const element = document.querySelector(selector);
    const box = element?.getBoundingClientRect();
    return [selector, box?.width && box.height ? box.toJSON() : null];
  })), selectors);
}

async function hudFailures(page, boxes) {
  const { width, height } = page.viewportSize();
  return Object.entries(boxes).filter(([, box]) =>
    !box || box.x < -1 || box.y < -1 || box.right > width + 1 || box.bottom > height + 1)
    .map(([selector]) => `HUD control missing or clipped: ${selector}`);
}

async function runInternal({ page, side, key, options, capture }) {
  const latestSpin = await installFixture(page, side);
  await page.goto(side.url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
  const opening = page.locator(".opening-continue:not([disabled])");
  const shell = page.locator(".game-shell");
  const spin = page.locator("#spin:not([disabled])");
  await opening.waitFor({ timeout: options.timeoutMs });
  const landingReadyAt = await page.evaluate(() => performance.now());
  await capture("landing", { region: shell, timing: { readyAtMs: landingReadyAt }, style: stableStyle });
  await opening.evaluate((button) => {
    window.comparisonContinueAt = performance.now();
    button.click();
  });
  await page.locator(".game-shell[data-entering]").waitFor({ timeout: options.timeoutMs });
  const elapsed = () => page.evaluate(() => performance.now() - window.comparisonContinueAt);
  await capture("transition", { region: shell, timing: { sampledAfterContinueMs: await elapsed() }, style: stableStyle, visualOnly: true });
  await page.locator(".game-shell[data-entering]").waitFor({ state: "detached", timeout: options.timeoutMs });
  await spin.waitFor({ timeout: options.timeoutMs });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (key === "candidate" && side.testStyle) await page.addStyleTag({ content: side.testStyle });
  await capture("game", { region: shell, timing: { spinEnabledAfterContinueMs: await elapsed() }, style: stableStyle, visualOnly: true });
  const boxes = await boxesFor(page, hudControls);
  await capture("hud", { region: page.locator(".tavern-hud"), boxes, failures: await hudFailures(page, boxes) });
  await page.locator("#bet-picker").click({ timeout: options.timeoutMs });
  const panel = page.locator("#bet-panel:popover-open");
  await panel.waitFor({ timeout: options.timeoutMs });
  await capture("bet", {
    region: panel, boxes: await boxesFor(page, ["#bet-panel", "#bet-picker"]),
    failures: await panel.locator(".bet-picker-options button").count() ? [] : ["No bet choices"],
  });
  await page.keyboard.press("Escape");
  const canvas = page.locator("#board > canvas");
  await canvas.evaluate((canvas) => {
    canvas.setAttribute("data-motion-audit", "");
    canvas.addEventListener("fw-pixi:drop", (event) => window.comparisonDrop.push(event.detail));
  });
  for (const mode of modes) {
    if (mode === "turbo") await page.locator("#speed").click({ timeout: options.timeoutMs });
    const speed = await page.locator("#speed").getAttribute("aria-pressed");
    await spin.evaluate((button) => {
      window.comparisonDrop = [];
      window.comparisonSpinAt = performance.now();
      button.click();
    });
    const target = { reel: lateScatter.reel, row: lateScatter.row };
    for (const phase of dropSteps) {
      const handle = await page.waitForFunction(({ phase, target }) => window.comparisonDrop?.find((event) =>
        event.phase === phase && event.reel === target.reel && event.row === target.row),
      { phase, target }, { timeout: options.timeoutMs });
      const event = await handle.jsonValue();
      await handle.dispose();
      const relative = await page.evaluate((time) => ({
        eventAfterSpinMs: time - window.comparisonSpinAt,
        screenshotRequestedAfterSpinMs: performance.now() - window.comparisonSpinAt,
      }), event.time);
      const failures = [];
      if (event.symbol !== lateScatter.symbol) failures.push("Late Scatter fixture did not arrive at reel 5, row 3");
      if ((speed === "true") !== (mode === "turbo")) failures.push("Unexpected Turbo toggle state");
      if (event.visible !== (phase !== "queued")) failures.push(`Scatter visibility is incorrect during ${phase}`);
      if (phase === "landed") {
        const early = await page.evaluate(() => window.comparisonDrop.filter((event) =>
          event.phase === "early-visible" && event.symbol === "bonus"));
        if (early.length) failures.push(`Scatter visible before entering in ${early.length} position(s)`);
      }
      await capture(`drop-${mode}-${phase}`, {
        region: page.locator("#board"), timing: relative, details: { ...event, fixture: fixtureId }, failures, visualOnly: true,
        ...(phase === "queued" ? { fixtureResult: latestSpin() } : {}),
      });
    }
    await spin.waitFor({ timeout: options.timeoutMs });
  }
}

function whiteShare(png, x0, y0, x1, y1) {
  let white = 0, count = 0;
  for (let y = Math.floor(png.height * y0); y < Math.floor(png.height * y1); y += 2) {
    for (let x = Math.floor(png.width * x0); x < Math.floor(png.width * x1); x += 2) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] > 220 && png.data[i + 1] > 220 && png.data[i + 2] > 220) white++;
      count++;
    }
  }
  return white / Math.max(count, 1);
}

function menuDarkens(before, after) {
  let darkened = 0, checked = 0;
  for (let y = Math.floor(before.height * 0.49); y < before.height * 0.79; y += 4) {
    for (let x = Math.floor(before.width * 0.37); x < before.width * 0.63; x += 4) {
      const i = (y * before.width + x) * 4;
      const light = (png) => png.data[i] + png.data[i + 1] + png.data[i + 2];
      if (light(before) - light(after) > 65) darkened++;
      checked++;
    }
  }
  return darkened / checked > 0.19;
}

function cyanShare(png, x0, y0, x1, y1) {
  let cyan = 0, count = 0;
  for (let y = Math.floor(png.height * y0); y < Math.floor(png.height * y1); y += 2) {
    for (let x = Math.floor(png.width * x0); x < Math.floor(png.width * x1); x += 2) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] < 125 && png.data[i + 1] > 145 && png.data[i + 2] > 175) cyan++;
      count++;
    }
  }
  return cyan / Math.max(count, 1);
}

async function observe(snapshot, condition, timeoutMs) {
  const end = Date.now() + timeoutMs;
  do {
    const png = await snapshot();
    if (condition(png)) return png;
    await new Promise((resolve) => setTimeout(resolve, 260));
  } while (Date.now() < end);
  return null;
}

async function runReference({ page, side, capture, record, options }) {
  const publicAssets = { base: null, paths: [] };
  page.on("response", (response) => {
    if (!response.ok()) return;
    const url = new URL(response.url());
    const path = url.pathname.match(/^(\/tavern-drop\/[^/]+\/assets\/)([\w./-]+\.(?:atlas|gif|jpg|json|mp3|ogg|png|skel|svg|webp|woff2?|xml))$/);
    if (url.hostname !== "paperclip.live.engine.io" || !path) return;
    publicAssets.base ??= url.origin + path[1];
    if (publicAssets.base === url.origin + path[1] && !publicAssets.paths.includes(path[2]))
      publicAssets.paths.push(path[2]);
  });
  await page.goto(side.url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
  const iframe = page.locator('iframe[src*="tavern-drop"]').first();
  if (["paperclipgaming.com", "www.paperclipgaming.com"].includes(new URL(page.url()).hostname))
    await iframe.waitFor({ state: "attached", timeout: options.timeoutMs });
  else await iframe.or(page.locator("canvas").first()).first().waitFor({ state: "attached", timeout: options.timeoutMs });
  if (await iframe.count()) {
    const child = new URL(await iframe.getAttribute("src"), page.url());
    if (child.protocol !== "https:") throw new Error("Unexpected demo iframe");
    await page.goto(child.href, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
  }
  const surface = page.locator("canvas").first();
  await surface.waitFor({ timeout: options.timeoutMs });
  await surface.scrollIntoViewIfNeeded({ timeout: options.timeoutMs });
  const snapshot = async () => PNG.sync.read(await surface.screenshot({ timeout: options.timeoutMs }));
  const portrait = page.viewportSize().height > page.viewportSize().width;
  const points = portrait
    ? { spin: [0.50, 0.91], bet: [0.50, 0.982], turbo: [0.672, 0.91] }
    : { spin: [0.733, 0.916], bet: [0.617, 0.916], turbo: [0.796, 0.948] };
  const click = async ([x, y]) => {
    const box = await surface.boundingBox();
    if (!box) throw new Error("No reference canvas bounds");
    await page.mouse.click(box.x + x * box.width, box.y + y * box.height);
  };
  const isGame = (png) => whiteShare(png, points.spin[0] - 0.035, points.spin[1] - 0.035,
    points.spin[0] + 0.035, points.spin[1] + 0.035) > 0.2;
  const isLanding = (png) => !isGame(png) && whiteShare(png, 0.25, 0.92, 0.75, 0.995) > 0.009;
  if (!(await observe(snapshot, isLanding, options.timeoutMs))) {
    await capture("landing", { region: surface, reason: "Continue was not recognized on the reference canvas." });
    return;
  }
  await capture("landing", { region: surface, details: { detection: "visible Continue on canvas", publicAssets } });
  const clickedAt = performance.now();
  await click([0.50, 0.961]);
  await capture("transition", {
    region: surface, timing: { sampledAfterContinueMs: performance.now() - clickedAt },
    visualOnly: true,
  });
  const game = await observe(snapshot, isGame, Math.min(options.timeoutMs, 12000));
  if (!game) {
    await capture("game", { region: surface, reason: "Reference HUD was not recognized after Continue." });
    return;
  }
  await capture("game", { region: surface, timing: { spinVisibleAfterContinueMs: performance.now() - clickedAt }, visualOnly: true });
  await capture("hud", { region: surface, crop: [0, portrait ? 0.85 : 0.83, 1, portrait ? 0.15 : 0.17],
    details: { detection: "Canvas Spin control", coordinates: points.spin }, visualOnly: true });
  const beforeBet = await snapshot();
  await click(points.bet);
  const selectedBet = portrait ? [0.078, 0.65, 0.48, 0.70] : [0.31, 0.47, 0.42, 0.53];
  const menu = await observe(snapshot, (png) =>
    menuDarkens(beforeBet, png) || cyanShare(png, ...selectedBet) > 0.17, 3500);
  await capture("bet", {
    region: surface, visualOnly: true,
    ...(menu ? {} : { reason: "Bet Menu was not recognized after clicking the canvas control." }),
  });
  if (menu) await click([0.08, 0.45]);
  const demo = new URL(page.url()).searchParams.get("demo") === "true";
  for (const mode of modes) {
    for (const phase of dropSteps)
      record(`drop-${mode}-${phase}`, { reason: "No equivalent deterministic late Scatter checkpoint on reference." });
    if (!side.playDemo || !demo || !menu) continue;
    if (mode === "turbo") {
      await click(points.turbo);
      const [x, y] = points.turbo;
      if (!(await observe(snapshot, (png) => cyanShare(png, x - 0.018, y - 0.021, x + 0.018, y + 0.021) > 0.1, 2600))) {
        for (const phase of dropSteps)
          record(`drop-${mode}-${phase}`, { reason: "Reference Turbo indicator did not confirm activation." });
        continue;
      }
    }
    const started = performance.now();
    const response = page.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/wallet/play") && response.ok(),
      { timeout: 6000 }).then(() => true, () => false);
    await click(points.spin);
    if (!await response) continue;
    await capture(`drop-${mode}-entered`, {
      region: surface, visualOnly: true,
      timing: { playResponseObservedAfterClickMs: performance.now() - started },
      reason: "Demo play observed. Random board and late Scatter timing cannot be matched to the internal fixture.",
    });
    // Wait until the regular Spin icon returns before sending the next play.
    await observe(snapshot, (png) => !isGame(png), 2400);
    if (!(await observe(snapshot, isGame, 15000))) break;
    await capture(`drop-${mode}-landed`, {
      region: surface, visualOnly: true,
      timing: { spinVisibleAfterClickMs: performance.now() - started },
      reason: "Demo spin settled. Outcome and exact Scatter landing are not comparable to the internal fixture.",
    });
  }
}
