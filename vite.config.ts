import { existsSync, statSync } from "node:fs";
import { cp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, normalizePath, type Plugin } from "vite";
import { gamePaths, readGameConfig } from "./tools/game-profile.ts";

const target = process.env.GAME_TARGET;
const paths = target ? gamePaths(target) : undefined;

function standalone(slug: string, output: NonNullable<typeof paths>): Plugin {
  const game = readGameConfig(output.config);
  const main = normalizePath(resolve("src/main.ts"));
  const tavern = game.routing.skin === "tavern";
  const assets = [`games/${slug}`, ...(tavern ? ["tavern-assets"] : [])];
  const loading = game.presentation.loadingScreen;
  const assetReferences = [
    ...game.symbols.flatMap((symbol) => symbol.image ? [symbol.image] : []),
    ...(loading ? [loading.background, loading.brandLogo, loading.gameLogo] : []),
    ...(loading?.brandIntro ? [loading.brandIntro.src] : []),
  ];
  for (const asset of assetReferences) {
    if (
      !assets.some((folder) => asset.startsWith(folder + "/")) ||
      asset.includes("\\") ||
      asset.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw Error(`Asset "${asset}" for ${slug} must be under public/${assets.join(" or public/")}.`);
    }
    if (!statSync(resolve("public", asset), { throwIfNoEntry: false })?.isFile())
      throw Error(`Asset "public/${asset}" for ${slug} is missing.`);
  }
  const skin = tavern
    ? ["/src/games/tavern/app.ts", "mountTavern"]
    : ["/src/framework/presentation/basic-game.ts", "mountBasicGame"];

  return {
    name: "standalone-game",
    apply: "build",
    enforce: "pre",
    transformIndexHtml(html) {
      const title = game.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
    },
    load(id) {
      if (id !== main) return;
      return `
        import "/src/style.css";
        import { launchGame } from "/src/framework/presentation/launch-game.ts";
        const game = ${JSON.stringify(game)};
        const root = document.querySelector("#app");
        await launchGame(root, game, async (loader) => {
          const { ${skin[1]}: mount } = await import(${JSON.stringify(skin[0])});
          await mount(root, game, loader);
        });
      `;
    },
    async writeBundle() {
      for (const folder of assets) {
        const source = resolve("public", folder);
        if (existsSync(source))
          await cp(source, resolve(output.dist, folder), { recursive: true });
      }
      // Keep the mock server on the same validated definition as this build.
      await writeFile(output.builtConfig, JSON.stringify(game, null, 2) + "\n");
    },
  };
}

export default defineConfig({
  base: "./",
  server: { proxy: { "/api": process.env.LOCAL_API_ORIGIN || "http://127.0.0.1:4000" } },
  ...(target && paths ? {
    plugins: [standalone(target, paths)],
    build: { outDir: paths.dist, copyPublicDir: false, emptyOutDir: true },
  } : {}),
});
