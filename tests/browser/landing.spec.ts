import { test, expect } from "@playwright/test";

for (const mode of ["normal", "drop"] as const) {
  for (const skip of [false, true]) {
    test(`${mode} landing ${skip ? "Skip resets" : "squashes and rebounds"} without shrinking authored symbols`, async ({ page }) => {
      await page.goto("/?game=default");
      await expect(page.locator("#reuse-spin")).toBeEnabled();
      const result = await page.evaluate(async ({ mode, skip }) => {
        const { BoardView } = await import("/src/framework/presentation/board.ts");
        const { reuse } = await import("/src/games/reuse/definition.ts");
        const { Container, Graphics } = await import("/node_modules/.vite/deps/pixi__js.js");
        const config = structuredClone(reuse);
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:0;top:0;width:306px;height:306px;background:#201a25;z-index:99999";
        document.body.append(host);
        const symbols: InstanceType<typeof Container>[] = [];
        const board = new BoardView(config, () => {
          const view = new Container(); view.scale.set(1.15);
          view.addChild(new Graphics().roundRect(8, 8, 70, 70, 10).fill(0xffcc44));
          symbols.push(view);
          return { view, set() {} };
        });
        await board.mount(host);
        const samples: { x: number; y: number }[] = [];
        board.app.ticker.add(() => {
          for (const symbol of symbols) samples.push({ x: symbol.parent.scale.x, y: symbol.parent.scale.y });
        });
        board.start(false, mode);
        await new Promise((resolve) => setTimeout(resolve, 60));
        const finished = board.stop(config.initialBoard);
        if (skip) setTimeout(() => board.skip(), 80);
        await finished;
        const final = symbols.map((symbol) => ({ x: symbol.parent.scale.x, y: symbol.parent.scale.y,
          authoredX: symbol.scale.x, authoredY: symbol.scale.y }));
        board.destroy(); host.remove();
        return { minY: Math.min(...samples.map((sample) => sample.y)), maxY: Math.max(...samples.map((sample) => sample.y)),
          maxX: Math.max(...samples.map((sample) => sample.x)), final };
      }, { mode, skip });
      if (!skip) {
        expect(result.minY).toBeLessThan(0.95);
        expect(result.maxY).toBeGreaterThan(1.02);
        expect(result.maxX).toBeGreaterThan(1.05);
      }
      for (const symbol of result.final) {
        expect(symbol.x).toBe(1); expect(symbol.y).toBe(1);
        expect(symbol.authoredX).toBe(1.15); expect(symbol.authoredY).toBe(1.15);
      }
    });
  }
}
