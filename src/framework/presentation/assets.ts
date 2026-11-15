import { Assets, type Texture } from "pixi.js";

export function assetUrl(path: string) {
  return new URL(import.meta.env.BASE_URL + path, document.baseURI).href;
}

export async function loadTextures<T extends string>(
  files: Record<T, string>,
): Promise<Map<string, Texture>> {
  const entries = await Promise.all(
    Object.entries<string>(files).map(async ([id, path]) => {
      return [id, await Assets.load<Texture>(assetUrl(path))] as const;
    }),
  );
  return new Map(entries);
}
