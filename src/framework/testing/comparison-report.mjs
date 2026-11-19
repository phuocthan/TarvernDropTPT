import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

async function diff(directory, key, before, after) {
  const [a, b] = await Promise.all([before, after].map(async (path) =>
    PNG.sync.read(await readFile(join(directory, path)))));
  if (a.width !== b.width || a.height !== b.height) return { reason: "Different capture dimensions" };
  const output = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, output.data, a.width, a.height, { threshold: 0.15 });
  const image = `${key}-diff.png`;
  await writeFile(join(directory, image), PNG.sync.write(output));
  return { image, percentage: Number((100 * pixels / (a.width * a.height)).toFixed(3)) };
}

function geometry(before, after) {
  const deltas = [];
  for (const [name, box] of Object.entries(before ?? {})) {
    const other = after?.[name];
    if (!box || !other) {
      if (box || other) deltas.push({ name, reason: "Control missing on one side" });
      continue;
    }
    const axes = Object.fromEntries(["x", "y", "width", "height"].map((axis) =>
      [axis, Number((other[axis] - box[axis]).toFixed(2))]));
    if (Object.values(axes).some((value) => Math.abs(value) > 2)) deltas.push({ name, axes });
  }
  return deltas;
}

export async function writeComparisonReport(directory, report) {
  const summary = { passed: 0, failed: 0, review: 0, notObserved: 0 };
  for (const row of report.scenarios) {
    for (const [index, step] of row.steps.entries()) {
      const { baseline, candidate } = step;
      const key = `${row.viewport}-${index}`;
      if (baseline?.image && candidate?.image)
        step.diff = await diff(directory, key, baseline.image, candidate.image);
      step.geometry = report.mode === "internal" ? geometry(baseline?.boxes, candidate?.boxes) : [];
      step.timingDeltaMs = Object.fromEntries(Object.entries(baseline?.timing ?? {})
        .filter(([name]) => name !== "readyAtMs" && Number.isFinite(candidate?.timing?.[name]))
        .map(([name, value]) => [name, Number((candidate.timing[name] - value).toFixed(1))]));
      const failures = [...(baseline?.failures ?? []), ...(candidate?.failures ?? [])];
      if (report.mode === "internal" && (baseline?.fixtureResult || candidate?.fixtureResult) &&
          JSON.stringify(baseline?.fixtureResult) !== JSON.stringify(candidate?.fixtureResult))
        failures.push("Fixture result differed between the two targets");
      if (failures.length) step.failures = failures;
      if (failures.length || step.geometry.length) step.status = "failed";
      else if (!baseline || !candidate || baseline.reason || candidate.reason) step.status = "notObserved";
      else if (baseline.visualOnly || candidate.visualOnly || step.diff?.percentage > 1 || step.diff?.reason) step.status = "review";
      else step.status = "passed";
      summary[step.status]++;
    }
  }
  report.summary = summary;
  await writeFile(join(directory, "run.json"), JSON.stringify(report, null, 2) + "\n");
  const figure = (caption, path) => path
    ? `<figure><figcaption>${escape(caption)}</figcaption><a href="${escape(path)}"><img src="${escape(path)}" loading="lazy"></a></figure>`
    : `<figure><figcaption>${escape(caption)}</figcaption><p>Capture unavailable</p></figure>`;
  const sections = report.scenarios.map(({ viewport, steps, videos }) => `<section><h2>${escape(viewport)}</h2>
    ${Object.entries(videos).map(([side, path]) => `<a href="${escape(path)}">${escape(side)} video</a>`).join(" · ")}
    ${steps.map((step) => `<article><h3>${escape(step.label)} · ${escape(step.status)}</h3>
      <div class="images">${figure("Baseline / reference", step.baseline?.image)}
      ${figure("Candidate", step.candidate?.image)}${figure("Difference", step.diff?.image)}</div>
      <p>${step.diff?.percentage === undefined ? escape(step.diff?.reason) : `${step.diff.percentage}% differing pixels`}</p>
      <pre>${escape(JSON.stringify({
        baseline: step.baseline, candidate: step.candidate, geometry: step.geometry, timingDeltaMs: step.timingDeltaMs,
        failures: step.failures,
      }, null, 2))}</pre></article>`).join("")}</section>`).join("");
  await writeFile(join(directory, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width"><title>Game comparison</title>
    <style>body{font:16px system-ui;margin:2rem;background:#161719;color:#eee}a{color:#9cd9ff}
    article{padding:1rem;border:1px solid #555;margin:1rem 0}.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}
    figure{margin:0}img{width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
    <h1>Game comparison</h1><p>${escape(report.mode)} · ${escape(JSON.stringify(summary))}</p>
    <p><a href="run.json">JSON report</a></p>${sections}</html>`);
  return summary;
}
