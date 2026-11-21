import { existsSync, statSync } from "node:fs";
import { cp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, normalizePath, type Plugin } from "vite";
import { resolveResourceUrl } from "./src/framework/remote/asset-resolver.ts";
import type { AssetQuality } from "./src/framework/resources/asset-quality.ts";
import { gamePresentation } from "./src/games/catalog.ts";
import { gamePaths, readGameConfig } from "./tools/game-profile.ts";

const target = process.env.GAME_TARGET;
const paths = target ? gamePaths(target) : undefined;

function standalone(slug: string, output: NonNullable<typeof paths>): Plugin {
  const game = readGameConfig(output.config);
  const main = normalizePath(resolve("src/main.ts"));
  const presentation = gamePresentation(game.routing.skin);
  const assets = [`games/${slug}`, ...presentation.assets];
  const loading = game.presentation.loadingScreen;
  const assetReferences = [
    ...game.symbols.flatMap((symbol) => symbol.image ? [symbol.image] : []),
    ...(loading ? [loading.background, loading.brandLogo, loading.gameLogo] : []),
    ...(loading?.brandIntro ? [loading.brandIntro.src] : []),
  ];
  const checkLocalAsset = (asset: string, label: string) => {
    if (
      !assets.some((folder) => asset.startsWith(folder + "/")) ||
      asset.includes("\\") ||
      asset.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw Error(`${label} "${asset}" for ${slug} must be under public/${assets.join(" or public/")}.`);
    }
    if (!statSync(resolve("public", asset), { throwIfNoEntry: false })?.isFile())
      throw Error(`${label} "public/${asset}" for ${slug} is missing.`);
  };
  for (const asset of assetReferences) checkLocalAsset(asset, "Asset");
  const manifest = game.resources;
  if (manifest) {
    const baseUrl = "https://standalone-build.invalid/";
    const qualities: AssetQuality[] = ["hd", "sd"];
    for (const [id, asset] of Object.entries(manifest.assets)) {
      if (asset.optional) continue;
      const bundles = Object.entries(manifest.bundles).filter(([, bundle]) => bundle.assets.includes(id)).map(([name]) => name);
      if (!bundles.length) continue;
      const urls = new Set(qualities.map((quality) => resolveResourceUrl(asset.src, manifest.base ?? "", {
        baseUrl, quality, brand: manifest.brand, version: manifest.version, locale: game.currency?.locale,
      })));
      for (const href of urls) {
        const url = new URL(href);
        if (url.origin === new URL(baseUrl).origin)
          checkLocalAsset(decodeURIComponent(url.pathname.slice(1)), `Resource ${id} (${bundles.join(", ")})`);
      }
    }
  }

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
          const { mount } = await import(${JSON.stringify(presentation.mount)});
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

// Dev server only: `?rafTimer` drives animation frames from timers, so automated checks
// can run the game in a background (hidden) browser tab that pauses requestAnimationFrame.
const hiddenTabFrames: Plugin = {
  name: "dev-hidden-tab-frames",
  apply: "serve",
  transformIndexHtml: () => [{
    tag: "script",
    injectTo: "head-prepend",
    children: `if (/[?&]rafTimer\\b/.test(location.search)) {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      // Web Animations follow the paused document timeline; finish them on a timer instead.
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        const animation = animate.call(this, keyframes, options);
        const timing = typeof options === "number" ? { duration: options } : options ?? {};
        if (timing.iterations !== Infinity) {
          const total = (Number(timing.delay) || 0) + (Number(timing.duration) || 0) * (timing.iterations ?? 1);
          setTimeout(() => { try { if (animation.playState === "running") animation.finish(); } catch {} }, total);
        }
        return animation;
      };
      // Image decode waits for a visible frame too; resolve it once the bytes are loaded.
      HTMLImageElement.prototype.decode = function () {
        return this.complete ? Promise.resolve() : new Promise((resolve, reject) => {
          this.addEventListener("load", () => resolve(), { once: true });
          this.addEventListener("error", reject, { once: true });
        });
      };
    }`,
  }],
};

export default defineConfig({
  base: "./",
  server: {
    proxy: { "/api": process.env.LOCAL_API_ORIGIN || "http://127.0.0.1:4000" },
    watch: { ignored: ["**/.runtime/**"] },
  },
  ...(target && paths ? {
    plugins: [standalone(target, paths), hiddenTabFrames],
    build: { outDir: paths.dist, copyPublicDir: false, emptyOutDir: true },
  } : { plugins: [hiddenTabFrames] }),
});
