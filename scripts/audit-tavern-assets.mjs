import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = join(root, "public/tavern-assets/assets");
const auditRoot = join(root, ".runtime/tavern-asset-audit");
const extensions = new Set([
  ".atlas", ".gif", ".jpeg", ".jpg", ".json", ".mp3", ".ogg", ".png",
  ".skel", ".svg", ".wav", ".webp", ".woff", ".woff2", ".xml",
]);

function isAssetPath(path) {
  return extensions.has(extname(path).toLowerCase()) &&
    path.split("/").every((part) => /^[\w.-]+$/.test(part) && part !== "." && part !== "..");
}

async function listAssets(directory, prefix = "") {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) paths.push(...await listAssets(join(directory, entry.name), path + "/"));
    else if (entry.isFile() && isAssetPath(path)) paths.push(path);
  }
  return paths;
}

async function describe(directory, path) {
  const bytes = await readFile(join(directory, path));
  return {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function fetchAsset(base, path, destination) {
  const response = await fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404 || response.status === 410) return false;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (response.headers.get("content-type")?.includes("text/html"))
    throw new Error("Received an HTML page instead of an asset");
  const target = join(destination, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return true;
}

async function main([source, ...extraPaths]) {
  if (!source)
    throw new Error("Usage: node scripts/audit-tavern-assets.mjs <public assets base URL or local folder> [extra/asset.webp ...]");
  const remote = /^https?:\/\//i.test(source);
  const base = remote ? new URL(source.endsWith("/") ? source : source + "/") : null;
  if (base && (base.username || base.password || base.search || base.hash))
    throw new Error("Use a public asset directory URL without credentials, query or fragment");
  if (extraPaths.some((path) => !isAssetPath(path)) || (!base && extraPaths.length))
    throw new Error("Extra paths must be asset paths relative to the public URL");

  const baselinePaths = new Set(await listAssets(baseline));
  if (!baselinePaths.size) throw new Error("The checked-in baseline is empty");
  const local = base ? null : resolve(source);
  const localPaths = local ? new Set(await listAssets(local)) : null;
  const paths = [...new Set([...baselinePaths, ...(localPaths ?? extraPaths)])].sort();
  await mkdir(auditRoot, { recursive: true });
  const reportDir = await mkdtemp(join(auditRoot, new Date().toISOString().slice(0, 10) + "-"));
  const candidate = local ?? join(reportDir, "assets");
  const files = [];

  async function check(path) {
    const before = baselinePaths.has(path) ? await describe(baseline, path) : null;
    try {
      const present = base ? await fetchAsset(base, path, candidate) : localPaths.has(path);
      if (!present)
        return { path, status: before ? "missing" : "not-found", before, after: null };
      const after = await describe(candidate, path);
      const status = !before ? "added" : before.sha256 === after.sha256 ? "unchanged" : "changed";
      return { path, status, before, after };
    } catch (error) {
      return { path, status: "error", before, after: null, error: error.message };
    }
  }

  for (let i = 0; i < paths.length; i += 4)
    files.push(...await Promise.all(paths.slice(i, i + 4).map(check)));

  const totals = { unchanged: 0, changed: 0, added: 0, missing: 0, "not-found": 0, error: 0 };
  for (const file of files) totals[file.status]++;
  const report = join(reportDir, "report.json");
  await writeFile(report, JSON.stringify({
    comparedAt: new Date().toISOString(), source: base?.href ?? local, baseline, totals, files,
  }, null, 2) + "\n");
  console.table(totals);
  for (const file of files.filter(({ status }) => status !== "unchanged"))
    console.log(`${file.status}: ${file.path}${file.error ? " (" + file.error + ")" : ""}`);
  console.log(report);
  if (totals.error) process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
