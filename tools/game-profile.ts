import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGameConfig } from "../src/framework/game-config.ts";

export function gamePaths(slug: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug))
    throw Error("Game slug must start with a letter and use lowercase letters, numbers or hyphens.");
  const profile = resolve(".runtime", "deploy", slug);
  return {
    config: resolve("src", "games", slug, "game.config.json"),
    dist: resolve(profile, "dist"),
    builtConfig: resolve(profile, "game.config.json"),
  };
}

export function readGameConfig(file: string) {
  return loadGameConfig(JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")));
}
