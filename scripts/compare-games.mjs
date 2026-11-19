import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { compareGame } from "../src/framework/testing/compare-game.mjs";
import { tavernComparison } from "../src/games/tavern/testing/comparison-profile.mjs";

function target(input, baseDirectory, reference = false) {
  const raw = typeof input === "string" ? { url: input } : input;
  let url;
  try { url = new URL(raw?.url); }
  catch { throw new Error("Each comparison target needs a valid URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Comparison targets must be HTTP(S) URLs");
  if (raw.testStyle && (reference || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    throw new Error("Test style injection is available on loopback targets only");
  return {
    url: url.href, reference, playDemo: reference && raw.playDemo === true,
    ...(raw.storageState ? { storageState: resolve(baseDirectory, raw.storageState) } : {}),
    ...(raw.testStyle ? { testStyle: raw.testStyle } : {}),
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    config: { type: "string" }, baseline: { type: "string" }, candidate: { type: "string" },
    reference: { type: "string" }, suite: { type: "string", default: "smoke" },
    video: { type: "boolean" }, headed: { type: "boolean" },
  } });
  if (values.suite !== "smoke") throw new Error("The available comparison suite is smoke (Tavern Drop P0)");
  let config = {};
  if (values.config) {
    const text = await readFile(values.config, "utf8");
    try { config = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch { throw new Error("Comparison config is not valid JSON"); }
    if (!config || typeof config !== "object" || Array.isArray(config))
      throw new Error("Comparison config must be a JSON object");
  }
  const baseDirectory = values.config ? dirname(resolve(values.config)) : process.cwd();
  const reference = values.reference ?? config.reference;
  const baseline = values.baseline ?? config.baseline;
  if (!!reference === !!baseline) throw new Error("Supply exactly one baseline or reference URL");
  const timeoutMs = config.timeoutMs ?? 45000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 3000 || timeoutMs > 120000)
    throw new Error("timeoutMs must be between 3000 and 120000");
  const result = await compareGame(tavernComparison, {
    mode: reference ? "reference" : "internal",
    sides: {
      baseline: target(reference ?? baseline, baseDirectory, !!reference),
      candidate: target(values.candidate ?? config.candidate, baseDirectory),
    },
    output: resolve(".runtime/game-compare"),
    timeoutMs, video: values.video ?? config.video, headed: values.headed ?? config.headed,
  });
  console.table(result.summary);
  console.log(join(result.directory, "index.html"));
  if (result.summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message.split("\n")[0].replace(/https?:\/\/\S+/g, "[URL redacted]"));
  process.exitCode = 1;
});
