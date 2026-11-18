import type { ResourceManifest } from "./contracts.ts";
export function validateResourceManifest(manifest: ResourceManifest) {
  if (!manifest || typeof manifest !== "object" || !manifest.assets || !manifest.bundles ||
      Array.isArray(manifest.assets) || Array.isArray(manifest.bundles)) throw Error("Invalid resource manifest");
  for (const [id, asset] of Object.entries(manifest.assets)) {
    if (!asset || typeof asset.src !== "string" || !asset.src ||
        (asset.type !== undefined && !["pixi", "json", "font"].includes(asset.type)) ||
        (asset.type === "font" && !asset.family)) throw Error(`Invalid resource asset: ${id}`);
  }
  for (const [name, bundle] of Object.entries(manifest.bundles)) {
    if (!bundle || !Array.isArray(bundle.assets) || !bundle.assets.every((id) => Object.hasOwn(manifest.assets, id)))
      throw Error(`Invalid resource bundle: ${name}`);
    if (bundle.dependsOn && (!Array.isArray(bundle.dependsOn) || !bundle.dependsOn.every((id) => Object.hasOwn(manifest.bundles, id))))
      throw Error(`Invalid resource dependencies: ${name}`);
  }
  const visit = (name: string, parents: Set<string>) => {
    if (!Object.hasOwn(manifest.bundles, name) || parents.has(name)) throw Error(`Invalid resource dependency graph: ${name}`);
    const next = new Set(parents).add(name);
    for (const dependency of manifest.bundles[name].dependsOn ?? []) visit(dependency, next);
  };
  for (const name of Object.keys(manifest.bundles)) visit(name, new Set());
  if (manifest.startup && (!Array.isArray(manifest.startup) || !manifest.startup.every((name) => Object.hasOwn(manifest.bundles, name))))
    throw Error("Invalid startup bundles");
  if (manifest.base !== undefined && typeof manifest.base !== "string") throw Error("Invalid resource base");
  if (manifest.concurrency !== undefined && (!Number.isInteger(manifest.concurrency) || manifest.concurrency < 1 || manifest.concurrency > 32)) throw Error("Invalid resource concurrency");
  if (manifest.retries !== undefined && (!Number.isInteger(manifest.retries) || manifest.retries < 0 || manifest.retries > 5)) throw Error("Invalid resource retries");
}
