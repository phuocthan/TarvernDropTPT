import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gamePaths, readGameConfig } from "./game-profile.ts";

const [action, slug, ...title] = process.argv.slice(2);

function run(args, target) {
  const child = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, GAME_TARGET: target },
  });
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
}

try {
  if (!slug) throw Error("Pass the game folder name after --.");
  const paths = gamePaths(slug);
  switch (action) {
    case "new": {
      const template = readGameConfig(gamePaths("reuse").config);
      const game = {
        ...template,
        id: slug,
        title: title.join(" ").trim() || slug,
        routing: { query: slug, apiBase: `/api/${slug}`, skin: "basic", contract: "proposal-v1" },
        resources: { assets: {}, bundles: { core: { assets: [] } }, startup: ["core"], concurrency: 4, retries: 1 },
      };
      mkdirSync(dirname(paths.config), { recursive: true });
      writeFileSync(paths.config, JSON.stringify(game, null, 2) + "\n", { flag: "wx" });
      console.log(`Created src/games/${slug}/game.config.json`);
      break;
    }
    case "build":
      readGameConfig(paths.config);
      run([resolve("node_modules", "typescript", "bin", "tsc"), "--noEmit"], slug);
      if (!process.exitCode)
        run([resolve("node_modules", "vite", "bin", "vite.js"), "build"], slug);
      break;
    case "start":
      run(["--experimental-strip-types", "server.js"], slug);
      break;
    default:
      throw Error("Expected one of: game:new, game:build, game:start.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
