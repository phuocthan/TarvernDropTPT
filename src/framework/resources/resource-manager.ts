import type { ResourceAsset, ResourceDriver, ResourceManifest } from "./contracts.ts";
import { validateResourceManifest } from "./validate-manifest.ts";
export type ResourceProgress = { completed: number; total: number; failed: string[] };

/** A shared store gives each manager ownership without unloading another game's textures. */
export class ResourceStore {
  private entries = new Map<string, { promise: Promise<unknown>; refs: number; asset: ResourceAsset; url: string }>();
  private driver: ResourceDriver;
  private unloading = new Map<string, Promise<void>>();
  constructor(driver: ResourceDriver) { this.driver = driver; }
  key(asset: ResourceAsset, url: string) { return JSON.stringify([asset.type ?? "pixi", url, asset.family, asset.weight]); }
  async acquire(asset: ResourceAsset, url: string, retries: number) {
    const key = this.key(asset, url);
    await this.unloading.get(key);
    let entry = this.entries.get(key);
    if (!entry) {
      const promise = (async () => {
        for (let attempt = 0; ; attempt++) {
          try { return await this.driver.load(asset, url); }
          catch (error) { if (attempt >= retries) throw error; }
        }
      })();
      entry = { promise, refs: 0, asset, url }; this.entries.set(key, entry);
      void promise.catch(() => { if (this.entries.get(key) === entry) this.entries.delete(key); });
    }
    entry.refs++;
    return entry.promise;
  }
  async release(asset: ResourceAsset, url: string) {
    const key = this.key(asset, url); const entry = this.entries.get(key);
    if (!entry || --entry.refs > 0) return;
    this.entries.delete(key);
    const unloading = (async () => {
      const value = await entry.promise.catch(() => undefined);
      if (value !== undefined) await this.driver.unload(asset, url, value);
    })();
    this.unloading.set(key, unloading);
    try { await unloading; } finally { if (this.unloading.get(key) === unloading) this.unloading.delete(key); }
  }
}

/** Manifest, dependencies, progress and lifetime; no Pixi or browser globals in this class. */
export class ResourceManager {
  private manifest: ResourceManifest;
  private store: ResourceStore;
  private resolve: (src: string, base: string) => string;
  private pending = new Map<string, Promise<unknown>>();
  private values = new Map<string, unknown>();
  private owned = new Set<string>();
  private failed = new Set<string>();
  private listeners = new Set<(progress: ResourceProgress) => void>();
  private active = 0;
  private waiting: (() => void)[] = [];
  private closed = false;
  private disposing?: Promise<void>;
  constructor(manifest: ResourceManifest, store: ResourceStore, resolveUrl: (src: string, base: string) => string) {
    validateResourceManifest(manifest);
    this.manifest = manifest; this.store = store; this.resolve = resolveUrl;
    if (!Number.isInteger(manifest.concurrency ?? 4) || (manifest.concurrency ?? 4) < 1) throw Error("Invalid resource concurrency");
    if (!Number.isInteger(manifest.retries ?? 1) || (manifest.retries ?? 1) < 0 || (manifest.retries ?? 1) > 5) throw Error("Invalid resource retries");
    for (const [id, asset] of Object.entries(manifest.assets)) {
      if (!asset.src || (asset.type === "font" && !asset.family)) throw Error(`Invalid resource: ${id}`);
    }
    for (const name of Object.keys(manifest.bundles)) this.bundleAssets(name);
    for (const name of manifest.startup ?? []) this.bundleAssets(name);
  }
  private bundleAssets(name: string, visiting = new Set<string>()): string[] {
    const bundle = this.manifest.bundles[name];
    if (!bundle) throw Error(`Unknown resource bundle: ${name}`);
    if (visiting.has(name)) throw Error(`Cyclic resource bundle: ${name}`);
    visiting.add(name);
    const ids = [...(bundle.dependsOn ?? []).flatMap((dependency) => this.bundleAssets(dependency, visiting)), ...bundle.assets];
    visiting.delete(name);
    for (const id of ids) if (!Object.hasOwn(this.manifest.assets, id)) throw Error(`Unknown resource: ${id}`);
    return [...new Set(ids)];
  }
  url(id: string) {
    const asset = this.manifest.assets[id]; if (!asset) throw Error(`Unknown resource: ${id}`);
    return this.resolve(asset.src, this.manifest.base ?? "./");
  }
  get<T>(id: string): T {
    if (!this.values.has(id)) throw Error(`Resource not loaded: ${id}`);
    return this.values.get(id) as T;
  }
  onProgress(listener: (progress: ResourceProgress) => void) {
    this.listeners.add(listener); listener(this.progress());
    return () => { this.listeners.delete(listener); };
  }
  progress(): ResourceProgress {
    const ids = [...new Set((this.manifest.startup ?? Object.keys(this.manifest.bundles)).flatMap((name) => this.bundleAssets(name)))];
    return { completed: ids.filter((id) => this.values.has(id) || this.failed.has(id)).length, total: ids.length, failed: [...this.failed] };
  }
  private notify() { for (const listener of this.listeners) listener(this.progress()); }
  load<T = unknown>(id: string): Promise<T> {
    if (this.closed) return Promise.reject(Error("Resources disposed"));
    if (!this.manifest.assets[id]) return Promise.reject(Error(`Unknown resource: ${id}`));
    let promise = this.pending.get(id);
    if (!promise) {
      promise = this.loadAsset(id); this.pending.set(id, promise);
      void promise.catch(() => { if (this.pending.get(id) === promise) this.pending.delete(id); });
    }
    return promise as Promise<T>;
  }
  private async loadAsset(id: string) {
    if (this.active >= (this.manifest.concurrency ?? 4)) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    const asset = this.manifest.assets[id];
    try {
      const value = await this.store.acquire(asset, this.url(id), this.manifest.retries ?? 1);
      this.owned.add(id); this.values.set(id, value); this.failed.delete(id); this.notify();
      return value;
    } catch (error) {
      this.failed.add(id); this.notify();
      if (!asset.optional) throw error;
      // Optional failure is observable and can be retried explicitly on a later load.
      this.pending.delete(id);
      return undefined;
    } finally {
      const next = this.waiting.shift();
      if (next) next(); else this.active--;
    }
  }
  async loadBundle(name: string) {
    this.bundleAssets(name);
    const bundle = this.manifest.bundles[name];
    await Promise.all((bundle.dependsOn ?? []).map((dependency) => this.loadBundle(dependency)));
    await Promise.all(bundle.assets.map((id) => this.load(id)));
  }
  async prepare() { await Promise.all((this.manifest.startup ?? []).map((name) => this.loadBundle(name))); }
  dispose() {
    return this.disposing ??= this.disposeOwned();
  }
  private async disposeOwned() {
    this.closed = true;
    await Promise.allSettled(this.pending.values());
    await Promise.all([...this.owned].map((id) => this.store.release(this.manifest.assets[id], this.url(id))));
    this.owned.clear(); this.values.clear(); this.pending.clear(); this.listeners.clear();
  }
}
