import { test, expect } from "@playwright/test";

test("Continue ignores early clicks and appears only after the readiness promise", async ({ page }) => {
  await page.goto("/?game=default");
  const result = await page.evaluate(async () => {
    const { waitForContinue } = await import("/src/framework/presentation/scene.ts");
    const surface = document.createElement("div"), button = document.createElement("button");
    surface.append(button); document.body.append(surface);
    let release!: () => void, accepted = false;
    const readiness = new Promise<void>((resolve) => { release = resolve; });
    const done = waitForContinue(surface, button, readiness).then(() => { accepted = true; });
    surface.click(); await Promise.resolve();
    const early = { accepted, hidden: button.hidden, disabled: button.disabled };
    release(); await Promise.resolve(); await Promise.resolve();
    const ready = { hidden: button.hidden, disabled: button.disabled };
    surface.click(); await done; surface.remove();
    return { early, ready, accepted };
  });
  expect(result.early).toEqual({ accepted: false, hidden: true, disabled: true });
  expect(result.ready).toEqual({ hidden: false, disabled: false });
  expect(result.accepted).toBe(true);
});

test("foreground win renders outside the reel mask while normal symbols remain clipped", async ({ page }) => {
  await page.goto("/?game=default");
  await expect(page.locator("#reuse-spin")).toBeEnabled();
  const result = await page.evaluate(async () => {
    const { BoardView } = await import("/src/framework/presentation/board.ts");
    const { reuse } = await import("/src/games/reuse/definition.ts");
    const { Container, Graphics } = await import("/node_modules/.vite/deps/pixi__js.js");
    const config = structuredClone(reuse);
    config.presentation.foregroundWinSymbols = ["A"];
    config.presentation.winOverflowPaddingPx = 32;
    const host = document.createElement("div"); host.style.width = "300px"; document.body.append(host);
    const board = new BoardView(config, () => {
      const view = new Container(), shape = new Graphics(); view.addChild(shape);
      return { view, set(id: string) { shape.clear().rect(-20, -24, 136, 144).fill(id === "A" ? 0x00ff00 : 0xff0000); } };
    });
    await board.mount(host);
    const alpha = (x: number, y: number) => {
      board.app.render();
      const gl = board.app.renderer.gl, pixel = new Uint8Array(4), resolution = board.app.renderer.resolution;
      gl.readPixels(Math.floor(x * resolution), board.app.canvas.height - Math.floor(y * resolution) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[3];
    };
    const before = alpha(72, 16);
    await board.focusWins([{ reel: 0, row: 0 }, { reel: 2, row: 2 }]);
    const raised = { top: alpha(72, 16), bottom: alpha(276, 346), neighbor: alpha(174, 16),
      focused: board.app.canvas.hasAttribute("data-foreground-win-focus") };
    board.clearHighlight(); const cleared = alpha(72, 16);
    board.destroy(); host.remove(); return { before, raised, cleared };
  });
  expect(result.before).toBe(0);
  expect(result.raised.top).toBe(255);
  expect(result.raised.bottom).toBe(255);
  expect(result.raised.neighbor).toBe(0);
  expect(result.raised.focused).toBe(true);
  expect(result.cleared).toBe(0);
});

test("allowForceStop false rejects immediate stopping without changing the recorded board", async ({ page }) => {
  await page.goto("/?game=default");
  await expect(page.locator("#reuse-spin")).toBeEnabled();
  const result = await page.evaluate(async () => {
    const { BoardView } = await import("/src/framework/presentation/board.ts");
    const { reuse } = await import("/src/games/reuse/definition.ts");
    const { Container } = await import("/node_modules/.vite/deps/pixi__js.js");
    const config = structuredClone(reuse); config.presentation.allowForceStop = false;
    const host = document.createElement("div"); host.style.width = "300px"; document.body.append(host);
    const board = new BoardView(config, () => ({ view: new Container(), set() {} }));
    await board.mount(host);
    board.start(false, "drop"); const stopping = board.stop(config.initialBoard);
    const rejected = board.skip() === false, stillMoving = board.isMoving;
    await stopping;
    const stopped = !board.isMoving;
    board.destroy(); host.remove(); return { rejected, stillMoving, stopped };
  });
  expect(result).toEqual({ rejected: true, stillMoving: true, stopped: true });
});

test("3x3 allowForceStop true offers Stop without placing another wager", async ({ page }) => {
  await page.goto("/?game=default");
  await expect(page.locator("#reuse-spin")).toBeEnabled();
  let release!: () => void, requests = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  // Count wagers only; the completion ACK of the same round also posts to /spin.
  await page.route("**/api/v1/spin", async (route) => {
    if (route.request().postDataJSON()?.isFreespin === 0) requests++;
    await gate;
    await route.continue();
  });
  try {
    await page.locator("#reuse-spin").click();
    await expect(page.locator("#reuse-spin")).toHaveText("Stop");
    await page.locator("#reuse-spin").click();
    expect(requests).toBe(1);
    release();
    await expect(page.locator("#reuse-spin")).toHaveText("Spin");
    expect(requests).toBe(1);
  } finally { release(); }
});
