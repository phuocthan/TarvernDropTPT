import { Assets, type Texture } from "pixi.js";
import { assetUrl } from "./asset-url.ts";
import type { ResourceManager } from "../resources/resource-manager.ts";
export { assetUrl } from "./asset-url.ts";

export async function loadTextures<T extends string>(
  files: Record<T, string>,
  resources?: ResourceManager,
): Promise<Map<string, Texture>> {
  const entries = await Promise.all(
    Object.entries<string>(files).map(async ([id, path]) => {
      return [id, resources ? await resources.load<Texture>(`symbol.${id}`) : await Assets.load<Texture>(assetUrl(path))] as const;
    }),
  );
  return new Map(entries);
}
