import type { GameDefinition } from "../domain/contracts.ts";
import type { BrandLoader } from "../presentation/brand-loading.ts";
import { resolveResourceUrl } from "../remote/asset-resolver.ts";
import { ResourceManager, ResourceStore } from "../resources/resource-manager.ts";
import { browserResourceDriver } from "../resources/browser-driver.ts";
import { Disposables } from "../shared/disposables.ts";

const store = new ResourceStore(browserResourceDriver);
const instances = new WeakMap<GameDefinition, GameRuntime>();

/** Per-game service scope; game skins share this ownership instead of making independent loaders. */
export class GameRuntime {
  readonly resources: ResourceManager;
  readonly lifetime = new Disposables();
  constructor(game: GameDefinition) {
    const baseUrl = new URL(import.meta.env.BASE_URL, document.baseURI).href;
    const manifest = structuredClone(game.resources ?? { assets: {}, bundles: {} });
    const images = game.symbols.filter((symbol) => symbol.image);
    for (const symbol of images) manifest.assets[`symbol.${symbol.id}`] ??= { src: new URL(symbol.image!, baseUrl).href };
    if (images.length && !manifest.bundles["symbols-static"]) {
      manifest.bundles["symbols-static"] = { assets: images.map((symbol) => `symbol.${symbol.id}`) };
      manifest.startup = [...(manifest.startup ?? []), "symbols-static"];
    }
    this.resources = new ResourceManager(manifest, store,
      (src, base) => resolveResourceUrl(src, base, { baseUrl,
        locale: game.currency?.locale, brand: game.resources?.brand, version: game.resources?.version }));
  }
  async prepare(loader?: Pick<BrandLoader, "update">) {
    const unsubscribe = this.resources.onProgress(({ completed, total }) => {
      if (total) loader?.update(completed, total);
    });
    this.lifetime.add(unsubscribe);
    await this.resources.prepare();
  }
  async dispose() {
    try { this.lifetime.dispose(); } finally { await this.resources.dispose(); }
  }
}
export function gameRuntime(game: GameDefinition) {
  let runtime = instances.get(game);
  if (!runtime) { runtime = new GameRuntime(game); instances.set(game, runtime); }
  return runtime;
}
