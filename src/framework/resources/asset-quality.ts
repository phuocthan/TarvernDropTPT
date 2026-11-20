/**
 * Texture quality tier, as chosen by the reference v13 loader (JT()): phones get the `sd`
 * atlas (a quarter of the pixels, one page), desktops get `hd`. iOS is always `sd`; Android is
 * `hd` only above 8 GB of reported device memory. `?quality=hd|sd` overrides it for testing.
 * Resource sources use it through the `{quality}` placeholder.
 */
export type AssetQuality = "hd" | "sd";

interface NavigatorLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  deviceMemory?: number;
}

export function detectAssetQuality(nav: NavigatorLike, search = ""): AssetQuality {
  const forced = new URLSearchParams(search).get("quality");
  if (forced === "hd" || forced === "sd") return forced;
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
  if (ios) return "sd";
  if (/Android/i.test(nav.userAgent)) return (nav.deviceMemory ?? 0) > 8 ? "hd" : "sd";
  return "hd";
}
