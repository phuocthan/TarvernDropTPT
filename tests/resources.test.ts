import { test } from "node:test";
import assert from "node:assert/strict";
import { ResourceManager, ResourceStore } from "../src/framework/resources/resource-manager.ts";
import type { ResourceDriver, ResourceManifest } from "../src/framework/resources/contracts.ts";
import { resolveResourceUrl } from "../src/framework/remote/asset-resolver.ts";
import { Disposables } from "../src/framework/shared/disposables.ts";

const manifest = (): ResourceManifest => ({ assets: { atlas: { src: "atlas" }, spine: { src: "spine" } },
  bundles: { atlas: { assets: ["atlas"] }, scene: { dependsOn: ["atlas"], assets: ["spine"] } }, startup: ["scene"] });
const resolve = (src: string) => src;
test("resources load dependencies first, deduplicate consumers, and report actual progress", async () => {
  const loaded: string[] = []; let unloads = 0;
  const store = new ResourceStore({ async load(_asset, url) { loaded.push(url); return { url }; }, async unload() { unloads++; } });
  const manager = new ResourceManager(manifest(), store, resolve);
  const progress: number[] = []; manager.onProgress((value) => progress.push(value.completed));
  await Promise.all([manager.prepare(), manager.loadBundle("scene"), manager.loadBundle("scene")]);
  assert.deepEqual(loaded, ["atlas", "spine"]);
  assert.equal(manager.get<{ url: string }>("spine").url, "spine");
  assert.deepEqual(progress, [0, 1, 2]);
  await manager.dispose(); assert.equal(unloads, 2);
  await assert.rejects(manager.load("spine"), /disposed/);
});
test("shared resource stays alive until the final game's ownership is released", async () => {
  let loads = 0, unloads = 0;
  const store = new ResourceStore({ async load() { loads++; return {}; }, async unload() { unloads++; } });
  const a = new ResourceManager(manifest(), store, resolve), b = new ResourceManager(manifest(), store, resolve);
  await Promise.all([a.prepare(), b.prepare()]); assert.equal(loads, 2);
  await Promise.all([a.dispose(), a.dispose()]); assert.equal(unloads, 0);
  assert.ok(b.get("atlas"));
  await b.dispose(); assert.equal(unloads, 2);
});
test("resource concurrency remains bounded while queued bundles complete", async () => {
  let active = 0, max = 0;
  const driver: ResourceDriver = { async load() {
    max = Math.max(max, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2)); active--; return {};
  }, async unload() {} };
  const ids = Array.from({ length: 12 }, (_, i) => String(i));
  const manager = new ResourceManager({ concurrency: 2, assets: Object.fromEntries(ids.map((id) => [id, { src: id }])),
    bundles: { all: { assets: ids } }, startup: ["all"] }, new ResourceStore(driver), resolve);
  await manager.prepare(); assert.equal(max, 2); assert.equal(manager.progress().completed, 12);
  await manager.dispose();
});
test("failed required assets can retry and optional failures are observable without blocking", async () => {
  let failing = true, attempts = 0;
  const store = new ResourceStore({ async load() { attempts++; if (failing) throw Error("offline"); return {}; }, async unload() {} });
  const definition = manifest(); definition.retries = 1;
  definition.assets.atlas.optional = true;
  const manager = new ResourceManager(definition, store, resolve);
  await manager.load("atlas"); assert.equal(attempts, 2); assert.deepEqual(manager.progress().failed, ["atlas"]);
  await assert.rejects(manager.load("spine"), /offline/);
  failing = false;
  await manager.load("atlas"); await manager.load("spine");
  assert.deepEqual(manager.progress().failed, []); assert.equal(manager.progress().completed, 2);
  await manager.dispose();
});
test("reacquiring a resource waits for its old unload before loading a new instance", async () => {
  let finishUnload!: () => void; const calls: string[] = [];
  const store = new ResourceStore({ async load() { calls.push("load"); return {}; },
    async unload() { calls.push("unload"); await new Promise<void>((resolve) => { finishUnload = resolve; }); } });
  const asset = { src: "a" }; await store.acquire(asset, "a", 0);
  const releasing = store.release(asset, "a"); await Promise.resolve();
  const loading = store.acquire(asset, "a", 0); await Promise.resolve();
  assert.deepEqual(calls, ["load", "unload"]);
  finishUnload(); await releasing; await loading;
  assert.deepEqual(calls, ["load", "unload", "load"]);
});
test("bad manifests and cyclic dependencies fail before issuing network requests", () => {
  const store = new ResourceStore({ async load() { throw Error("should not load"); }, async unload() {} });
  const definition = manifest(); definition.bundles.atlas.dependsOn = ["scene"];
  assert.throws(() => new ResourceManager(definition, store, resolve), /dependency graph/);
  definition.bundles.atlas.dependsOn = ["missing"];
  assert.throws(() => new ResourceManager(definition, store, resolve), /dependencies/);
});
test("remote resource resolution preserves CDN folders and expands brand/locale/version safely", () => {
  assert.equal(resolveResourceUrl("{locale}/font.woff2", "https://cdn.example/{brand}/{version}/", {
    baseUrl: "https://game.example/", brand: "demo", locale: "ko-KR", version: "v1" }), "https://cdn.example/demo/v1/ko-KR/font.woff2");
  assert.throws(() => resolveResourceUrl("javascript:alert(1)", "./", { baseUrl: "https://game.example/" }), /protocol/);
});
test("lifetime releases listeners in reverse order even when one cleanup throws", () => {
  const lifetime = new Disposables(); const calls: number[] = [];
  lifetime.add(() => { calls.push(1); }); lifetime.add(() => { calls.push(2); throw Error("cleanup"); });
  assert.throws(() => lifetime.dispose(), AggregateError); assert.deepEqual(calls, [2, 1]);
  lifetime.dispose();
});
