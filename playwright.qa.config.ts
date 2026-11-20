import { existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import browserConfig from "./playwright.config";

const root = resolve(".runtime/qa-behavior");
mkdirSync(root, { recursive: true });
const run = process.env.FW_PIXI_QA_RUN_DIRECTORY ?? mkdtempSync(join(root, `${new Date().toISOString().slice(0, 10)}-`));
process.env.FW_PIXI_QA_RUN_DIRECTORY = run;
const localUrl = "http://127.0.0.1:4194";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || localUrl;
const origin = new URL(baseURL);
if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) {
  throw new Error("Behavior QA expects a local Vite dev server");
}
const windowsChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const linuxChrome = "/usr/bin/chromium";
const installedChrome = process.platform === "win32" ? windowsChrome : linuxChrome;

export default defineConfig(browserConfig, {
  grep: /@qa-behavior/,
  retries: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: join(run, "artifacts"),
  reporter: [
    ["list"],
    ["html", { outputFolder: join(run, "html"), open: "never" }],
    ["./src/framework/testing/behavior-reporter.ts", { directory: run, profile: "tavern-drop" }],
  ],
  use: {
    baseURL,
    launchOptions: {
      ...browserConfig.use?.launchOptions,
      executablePath: process.env.CHROMIUM_PATH || (existsSync(installedChrome) ? installedChrome : undefined),
    },
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? [] : [
    {
      command: "node --experimental-strip-types server.js",
      port: 4195,
      env: { PORT: "4195", MOCK_API_DATA_FILE: join(run, "mock-wallet.json") },
    },
    {
      command: "vite --host 127.0.0.1 --port 4194 --strictPort",
      url: localUrl,
      env: { LOCAL_API_ORIGIN: "http://127.0.0.1:4195" },
    },
  ],
});
