import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { writeComparisonReport } from "./comparison-report.mjs";

export async function compareGame(profile, options) {
  await mkdir(options.output, { recursive: true });
  const directory = await mkdtemp(join(options.output, new Date().toISOString().slice(0, 10) + "-"));
  const report = {
    profile: profile.id, mode: options.mode, createdAt: new Date().toISOString(),
    sources: Object.fromEntries(Object.entries(options.sides).map(([key, side]) => [key, new URL(side.url).origin])),
    scenarios: [],
  };
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: !options.headed,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    report.browserVersion = browser.version();
    for (const { id: viewportId, ...viewport } of profile.viewports) {
      const steps = new Map(profile.steps.map(([id, label]) => [id, { id, label }]));
      const videos = {};
      for (const [key, side] of Object.entries(options.sides)) {
        const prefix = `${viewportId}-${key}`;
        const context = await browser.newContext({
          viewport, deviceScaleFactor: 1, serviceWorkers: "block",
          storageState: side.storageState,
          ...(options.video ? { recordVideo: { dir: directory, size: viewport } } : {}),
        });
        const page = await context.newPage();
        if (options.video) {
          const path = await page.video().path();
          videos[key] = path.split(/[\\/]/).at(-1);
        }
        const record = (id, data) => {
          if (!steps.has(id)) throw new Error(`Unknown checkpoint ${id}`);
          steps.get(id)[key] = data;
        };
        const capture = async (id, { region, style, crop, ...data } = {}) => {
          const image = `${prefix}-${id}.png`;
          const path = join(directory, image);
          let box = region ? await region.boundingBox() : undefined;
          if (region && !box) throw new Error("Capture region not visible");
          if (box && crop) {
            const [x, y, width, height] = crop;
            box = { x: box.x + x * box.width, y: box.y + y * box.height, width: width * box.width, height: height * box.height };
          }
          const clip = box && {
            x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)),
            width: Math.min(viewport.width, Math.ceil(box.x + box.width)) - Math.max(0, Math.floor(box.x)),
            height: Math.min(viewport.height, Math.ceil(box.y + box.height)) - Math.max(0, Math.floor(box.y)),
          };
          await page.screenshot({ path, clip, style, timeout: options.timeoutMs });
          record(id, { image, ...data });
        };
        try {
          await profile.run({ page, side, key, directory, prefix, options, capture, record });
        } catch (error) {
          for (const [id, step] of steps) {
            if (!step[key]) record(id, side.reference
              ? { reason: "Demo checkpoint not observed. Check the session link and any overlay." }
              : { failures: [error.message.split("\n")[0].replace(/https?:\/\/\S+/g, "[URL redacted]")] });
          }
        } finally {
          await context.close();
        }
        for (const [id, step] of steps) {
          if (!step[key]) record(id, side.reference
            ? { reason: "Reference checkpoint was not observed." }
            : { failures: ["Internal checkpoint was not recorded."] });
        }
      }
      report.scenarios.push({ viewport: viewportId, size: viewport, steps: [...steps.values()], videos });
    }
  } finally {
    await browser.close();
  }
  return { directory, summary: await writeComparisonReport(directory, report) };
}
