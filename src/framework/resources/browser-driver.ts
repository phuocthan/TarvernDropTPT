import { Assets } from "pixi.js";
import FontFaceObserver from "fontfaceobserver";
import { JsonClient } from "../network/json-client.ts";
import type { ResourceDriver } from "./contracts.ts";

const json = new JsonClient();
export const browserResourceDriver: ResourceDriver = {
  async load(asset, url) {
    if (asset.type === "json") return json.request(url);
    if (asset.type === "font") {
      const face = new FontFace(asset.family!, `url(${JSON.stringify(url)})`, { weight: asset.weight ?? "400" });
      await face.load(); document.fonts.add(face);
      try { await new FontFaceObserver(asset.family!, { weight: asset.weight ?? "400" }).load(null, 12000); }
      catch (error) { document.fonts.delete(face); throw error; }
      return face;
    }
    return Assets.load(url);
  },
  async unload(asset, url, value) {
    if (asset.type === "json") return;
    if (asset.type === "font") { document.fonts.delete(value as FontFace); return; }
    await Assets.unload(url);
  },
};
