import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const defaultBoard = "ncXK6YWm";
const defaultList = "To-do";
const startMarker = "**QA report · managed section**";
const endMarker = "**End QA report**";

function findings(report, reviewSteps, runId) {
  const grouped = new Map();
  const availableReviews = new Set();
  for (const { viewport, size, steps } of report.scenarios) {
    for (const step of steps) {
      if (step.status === "review") availableReviews.add(step.id);
      if (step.status !== "failed" && !(step.status === "review" && reviewSteps.includes(step.id))) continue;
      if (!grouped.has(step.id)) grouped.set(step.id, { label: step.label, rows: [] });
      grouped.get(step.id).rows.push({ viewport, size, step });
    }
  }
  for (const id of reviewSteps) {
    if (!availableReviews.has(id)) throw Error(`No review checkpoint named ${id} in this report`);
  }
  return Array.from(grouped, ([id, { label, rows }]) => {
    const fingerprint = createHash("sha256").update(JSON.stringify([report.profile, report.mode, id])).digest("hex").slice(0, 24);
    const marker = `QA fingerprint: \`${fingerprint}\``;
    const details = rows.flatMap(({ viewport, size, step }) => [
      `- ${size ? `${viewport} (${size.width}×${size.height})` : label} · ${step.status}`,
      ...((step.failures ?? []).map((message) => `  - ${message.replace(/https?:\/\/\S+/g, "[URL redacted]")}`)),
      ...((step.geometry ?? []).map(({ name, reason, axes }) => `  - ${name}: ${reason ?? Object.entries(axes).map(([axis, px]) => `${axis} ${px} px`).join(", ")}`)),
      ...(step.diff?.percentage === undefined ? [] : [`  - Differing pixels: ${step.diff.percentage}%`]),
    ]);
    const description = [
      startMarker, marker, "", `Run: ${runId} · ${report.mode} · Chromium ${report.browserVersion ?? "unknown"}`,
      `Reproduce: ${rows[0].step.reproduce ?? `Run the ${report.profile} smoke suite and inspect checkpoint \`${id}\` at the viewport below.`}`,
      `Expected: ${rows[0].step.expected ?? "The candidate passes the checkpoint and matches the comparable baseline behavior."}`,
      "", "Actual", ...details, "", endMarker,
    ].join("\n");
    const images = [...new Set(rows.flatMap(({ step }) => step.evidence ?? [step.baseline?.image, step.candidate?.image, step.diff?.image]).filter(Boolean))];
    return { name: `[QA] ${label}`, marker, description, images };
  });
}

function trelloClient(key, token) {
  return async (method, path, body) => {
    const response = await fetch(`https://api.trello.com/1/${path}`, {
      method,
      headers: {
        Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`,
        Accept: "application/json",
        ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(`Trello ${method} ${path.split("?")[0]} failed (HTTP ${response.status})`);
    return response.json();
  };
}

function updateDescription(previous, finding) {
  const start = previous.indexOf(startMarker);
  const end = previous.indexOf(endMarker, start);
  if (start === -1 || end === -1) return `${previous}\n\n${finding.description}`;
  return previous.slice(0, start) + finding.description + previous.slice(end + endMarker.length);
}

async function publish(issues, directory, runId, board, listName) {
  const { TRELLO_API_KEY: key, TRELLO_API_TOKEN: token } = process.env;
  if (!key || !token) throw Error("Set TRELLO_API_KEY and TRELLO_API_TOKEN before publishing");
  const request = trelloClient(key, token);
  const lists = await request("GET", `boards/${encodeURIComponent(board)}/lists?filter=open&fields=id,name`);
  const listKey = (name) => name.replace(/[\s-]+/g, "").toLowerCase();
  const matching = lists.filter(({ name }) => listKey(name) === listKey(listName));
  if (matching.length !== 1) throw Error(`Expected one open Trello list matching '${listName}', found ${matching.length}`);
  const [{ id: idList }] = matching;
  const cards = await request("GET", `boards/${encodeURIComponent(board)}/cards?filter=open&fields=id,desc,url`);

  for (const issue of issues) {
    const evidence = await Promise.all(issue.images.map(async (file) => {
      if (typeof file !== "string" || !/^[\w.-]+\.png$/i.test(file)) throw Error("Invalid screenshot filename in QA report");
      const path = join(directory, file);
      if (resolve(await realpath(path)) !== path) throw Error("Screenshot must be a regular path inside the report directory");
      return { name: `${runId}-${file}`, data: await readFile(path) };
    }));
    const existing = cards.filter(({ desc }) => desc.split("\n").includes(issue.marker));
    if (existing.length > 1) throw Error(`Multiple open cards already match ${issue.name}`);
    let [card] = existing;
    if (card) {
      const desc = updateDescription(card.desc, issue);
      if (card.desc !== desc) card = await request("PUT", `cards/${card.id}`, { desc });
    } else {
      card = await request("POST", "cards", { idList, name: issue.name, desc: issue.description });
    }
    if (evidence.length) {
      const attachments = existing.length ? await request("GET", `cards/${card.id}/attachments?fields=name`) : [];
      for (const { name, data } of evidence) {
        if (attachments.some((attachment) => attachment.name === name)) continue;
        const form = new FormData();
        form.set("name", name);
        form.set("file", new Blob([data], { type: "image/png" }), name);
        await request("POST", `cards/${card.id}/attachments`, form);
      }
    }
    console.log(`${issue.name} · ${card.url}`);
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    report: { type: "string" }, review: { type: "string", multiple: true, default: [] }, publish: { type: "boolean" },
  } });
  if (!values.report) throw Error("Usage: npm run qa:trello -- --report <path-to-run.json> [--review <step-id>] [--publish]");
  const path = await realpath(resolve(values.report));
  const directory = dirname(path);
  const runId = basename(directory);
  const report = JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  if (!report.profile || !["internal", "reference", "behavior"].includes(report.mode) || !Array.isArray(report.scenarios))
    throw Error("Expected a comparison or behavior QA run.json report");
  const issues = findings(report, values.review, runId);
  const board = process.env.TRELLO_BOARD_ID || defaultBoard;
  const list = process.env.TRELLO_LIST_NAME || defaultList;
  if (!issues.length) console.log("No QA findings selected for Trello.");
  else if (values.publish) await publish(issues, directory, runId, board, list);
  else {
    console.log(`Preview · board ${board} · list ${list}`);
    for (const { name, description, images } of issues)
      console.log(`\n${name}\n${description}\nScreenshots: ${images.length}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
