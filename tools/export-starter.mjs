import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const runtime = resolve(workspace, ".runtime");
await mkdir(runtime, { recursive: true });
const output = await mkdtemp(join(runtime, "fw-pixi-starter-"));

for (const path of [
  "index.html", "tsconfig.json", "playwright.config.ts",
  "server.js", "server", "vite.config.ts",
  "src/main.ts", "src/style.css", "src/framework", "src/games/basic-entry.ts", "src/games/gem",
  "src/games/reuse/game.config.json", "tests/browser/gem.spec.ts", "tools/game.mjs", "tools/game-profile.ts",
]) {
  const destination = join(output, path);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(workspace, path), destination, { recursive: true });
}

const pkg = JSON.parse(await readFile(join(workspace, "package.json"), "utf8"));
pkg.name = "fw-pixi-starter";
pkg.scripts = Object.fromEntries(["dev", "build", "game:new", "game:build", "game:start", "test:browser"]
  .map((name) => [name, pkg.scripts[name]]));
pkg.scripts.test = pkg.scripts["test:browser"];
const lock = JSON.parse(await readFile(join(workspace, "package-lock.json"), "utf8"));
lock.name = lock.packages[""].name = pkg.name;
for (const [name, data] of [["package.json", pkg], ["package-lock.json", lock]])
  await writeFile(join(output, name), JSON.stringify(data, null, 2) + "\n");
await writeFile(join(output, "src/games/catalog.ts"), `import { createGameCatalog } from "../framework/app/game-catalog.ts";
import { registration } from "./gem/definition.ts";

export const { defaultGame, games, gamePresentation } = createGameCatalog(registration);
`);
await cp(join(workspace, "docs/fw-pixi-starter.md"), join(output, "README.md"));
await writeFile(join(output, ".gitignore"), "node_modules/\ndist/\n.runtime/\ntest-results/\nplaywright-report/\n");
console.log(output);
