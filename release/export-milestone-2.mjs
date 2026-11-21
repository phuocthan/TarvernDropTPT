#!/usr/bin/env node
// Milestone 2 client export: an explicit file list from one development commit.
// Usage: node release/export-milestone-2.mjs --destination <empty folder outside the repo> [--revision <commit>]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) =>
  value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!args.destination) throw Error("Pass --destination <empty folder outside the repository>.");
const destination = resolve(args.destination);
// The ignored .runtime folder is allowed so a local verification copy can sit beside the source.
if ((destination === source || destination.startsWith(source + sep)) && !destination.startsWith(join(source, ".runtime") + sep))
  throw Error("Use a separate export directory outside the development repository (or under .runtime/).");
if (existsSync(destination) && readdirSync(destination).length)
  throw Error("The export directory must be empty.");

const git = (...command) => {
  const result = spawnSync("git", ["-C", source, ...command], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (result.status !== 0) throw Error(`git ${command.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
};
const commit = git("rev-parse", "--verify", `${args.revision ?? "HEAD"}^{commit}`);
const tracked = new Set(git("ls-tree", "-r", "--name-only", commit).split("\n"));

// Everything the client needs to build, run, test and review M2. The delivered M1 documents
// (docs/milestone-1*, docs/architecture.md) stay as published in the release repository. AI-related notes, research
// captures, internal communication, non-English drafts and local tooling stay in development.
const entries = [
  ".gitignore", "index.html", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
  "server.js", "railway.json", "playwright.config.ts",
  "server", "tools/game-profile.ts", "tools/game.mjs", "scripts/audit-tavern-assets.mjs",
  "src", "public", "asset-viewer",
  ...[...tracked].filter((path) => /^tests\/[^/]+\.test\.ts$/.test(path)),
  ...[...tracked].filter((path) => path.startsWith("tests/browser/") && !/-temp\.spec\.ts$/.test(path)),
  "docs/milestone-2-upgrade-and-deploy.md",
  "docs/milestone-2-features-and-testing.md", "docs/milestone-2-features-and-testing.pdf",
  "docs/milestone-2-asset-checklist.md", "docs/milestone-2-asset-checklist.pdf",
  "docs/milestone-2-evidence",
  "docs/fw-pixi-architecture.md", "docs/tavern-asset-inventory.md",
  "release/milestone-2/README.md",
];
for (const entry of entries)
  if (!tracked.has(entry) && ![...tracked].some((path) => path.startsWith(entry + "/")))
    throw Error(`${entry} is not in commit ${commit}.`);

mkdirSync(destination, { recursive: true });
const archive = join(tmpdir(), `milestone-2-${process.pid}-${Date.now()}.tar`);
try {
  git("archive", "--format=tar", `--output=${archive}`, commit, "--", ...entries);
  const unpack = spawnSync("tar", ["-xf", archive, "-C", destination], { encoding: "utf8" });
  if (unpack.status !== 0) throw Error(`tar failed: ${unpack.stderr}`);
} finally {
  rmSync(archive, { force: true });
}
renameSync(join(destination, "release/milestone-2/README.md"), join(destination, "README.md"));
rmSync(join(destination, "release"), { recursive: true });
writeFileSync(join(destination, "SOURCE_REVISION"), commit + "\n");

const files = [];
const walk = (folder) => {
  for (const name of readdirSync(folder).sort()) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(destination, path).split(sep).join("/"));
  }
};
walk(destination);
const text = /\.(ts|js|mjs|json|md|txt|css|html|xml|atlas|svg)$/;
const manifest = files.map((path) => {
  let bytes = readFileSync(join(destination, path));
  if (text.test(path) || path === ".gitignore" || path === "SOURCE_REVISION")
    bytes = Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
  return { path, sha256: createHash("sha256").update(bytes).digest("hex") };
});
writeFileSync(join(destination, "EXPORT_MANIFEST.json"), JSON.stringify({
  milestone: "M2",
  checksumNormalization: "UTF-8 text with LF line endings; binary files unchanged",
  sourceRevision: commit,
  files: manifest,
}, null, 2) + "\n");
console.log(`Exported milestone 2 from ${commit} to ${destination} (${files.length + 1} files)`);
