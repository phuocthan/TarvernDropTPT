import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAssetQuality } from "../src/framework/resources/asset-quality.ts";
import { resolveResourceUrl } from "../src/framework/remote/asset-resolver.ts";

const desktop = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", platform: "Win32", maxTouchPoints: 0 };
const android = (deviceMemory?: number) => ({ userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/130 Mobile", deviceMemory });

test("asset quality follows the reference tiers", () => {
  assert.equal(detectAssetQuality(desktop), "hd");
  assert.equal(detectAssetQuality({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }), "sd");
  assert.equal(detectAssetQuality({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 }), "sd");
  assert.equal(detectAssetQuality(android(8)), "sd");
  assert.equal(detectAssetQuality(android()), "sd");
  assert.equal(detectAssetQuality(android(12)), "hd");
  assert.equal(detectAssetQuality(android(4), "?quality=hd"), "hd");
  assert.equal(detectAssetQuality(desktop, "?quality=sd"), "sd");
});

test("{quality} resolves in resource sources", () => {
  assert.equal(
    resolveResourceUrl("{quality}/td_master.atlas", "tavern-assets/assets/", { baseUrl: "https://game.test/", quality: "sd" }),
    "https://game.test/tavern-assets/assets/sd/td_master.atlas",
  );
});
