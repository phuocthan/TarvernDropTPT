import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { MockGame } from "./server/mock-game.ts";
import { ProposalBackend, ProposalError } from "./server/proposal-backend.ts";
import { gamePaths, readGameConfig } from "./tools/game-profile.ts";

const target = process.env.GAME_TARGET;
const profile = target ? gamePaths(target) : null;
let catalog;
if (profile) {
  try {
    catalog = [readGameConfig(profile.builtConfig)];
  } catch (error) {
    throw Error(`Cannot open built game "${target}". Run npm run game:build -- ${target} first.`, { cause: error });
  }
} else {
  ({ games: catalog } = await import("./src/games/catalog.ts"));
}

const proposal = new ProposalBackend(catalog, process.env.MOCK_API_DATA_FILE || ".runtime/backend-v1.json");
proposal.sweepExpired();
setInterval(() => {
  try { proposal.sweepExpired(); } catch (error) { console.error("Proposal settlement sweep failed", error); }
}, 60000).unref();

// Each demo has its own sessions and cookies.
const games = new Map(catalog.map((definition) => [
  definition.routing.apiBase,
  { definition, cookie: `${definition.routing.query}-session`, sessions: new Map() },
]));
const root = profile?.dist ?? resolve("dist");
const viewerRoot = resolve("asset-viewer");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
};
function json(res, status, body) {
  res
    .writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    .end(JSON.stringify(body));
}
createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (path.startsWith("/api/v1/")) {
      if (new URL(req.url, "http://localhost").search) return json(res, 400, { error: "QUERY_PARAMETERS_NOT_ALLOWED" });
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
      }
      if (req.headers["sec-fetch-site"] === "cross-site") return json(res, 403, { error: "INVALID_ORIGIN" });
      try {
        let body = {};
        if (req.method === "POST") {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw) > 8192) return json(res, 413, { error: "REQUEST_TOO_LARGE" });
          }
          try { body = JSON.parse(raw || "{}"); } catch { return json(res, 400, { error: "INVALID_JSON" }); }
          if (!body || Array.isArray(body) || typeof body !== "object") return json(res, 400, { error: "INVALID_JSON" });
        }
        if (typeof body.gameCode !== "string" || !body.gameCode) return json(res, 400, { error: "GAME_CODE_REQUIRED" });
        const result = proposal.handle(req.method, path.slice("/api/v1".length), body, {
          sessionId: req.headers["session-id"] || "",
          token: (req.headers.authorization || "").replace(/^Bearer /, ""),
          playToken: req.headers["play-token"] || "",
        });
        return json(res, 200, result);
      } catch (error) {
        if (error instanceof ProposalError) return json(res, error.status, { error: error.message, synthetic: true });
        console.error("Proposal API failed", error);
        return json(res, 500, { error: "INTERNAL_ERROR" });
      }
    }
    if (path.startsWith("/api/")) {
      const lastSlash = path.lastIndexOf("/");
      const game = games.get(path.slice(0, lastSlash));
      if (!game) return json(res, 404, { error: "NOT_FOUND" });
        const { sessions, cookie, definition } = game;
      const endpoint = path.slice(lastSlash);
      const id = req.headers.cookie
        ?.split(";")
        .map((value) => value.trim())
        .find((value) => value.startsWith(cookie + "="))
        ?.slice(cookie.length + 1);
      if (req.method === "GET" && endpoint === "/session") {
        const sessionId = id && sessions.has(id) ? id : randomUUID();
        if (!sessions.has(sessionId)) {
          if (sessions.size >= 500)
            return json(res, 503, { error: "DEMO_SESSION_LIMIT" });
          sessions.set(sessionId, new MockGame(definition));
        }
        res.setHeader(
          "Set-Cookie",
          `${cookie}=${sessionId}; HttpOnly; SameSite=Lax; Path=/`,
        );
        return json(res, 200, sessions.get(sessionId).state);
      }
      if (req.method === "POST" && endpoint === "/command") {
        if (!id || !sessions.has(id))
          return json(res, 409, { error: "SESSION_EXPIRED" });
        if (req.headers["sec-fetch-site"] === "cross-site")
          return json(res, 403, { error: "INVALID_ORIGIN" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 8192)
            return json(res, 413, { error: "REQUEST_TOO_LARGE" });
        }
        try {
          const command = JSON.parse(body);
          return json(res, 200, sessions.get(id).execute(command));
        } catch (error) {
          return json(res, 409, { error: error.message || "INVALID_COMMAND" });
        }
      }
      return json(res, 404, { error: "NOT_FOUND" });
    }
    let staticRoot = root;
    let staticPath = path === "/" ? "/index.html" : decodeURIComponent(path);
    if (staticPath.startsWith("/asset-viewer/")) {
      if (profile || process.argv.includes("--no-animator-viewer")) {
        res.writeHead(404).end("Not found");
        return;
      }
      staticRoot = viewerRoot;
      staticPath = staticPath.slice("/asset-viewer".length);
      if (staticPath === "/") staticPath = "/index.html";
    }
    const file = resolve(staticRoot, "." + staticPath);
    if (!file.startsWith(staticRoot + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(Number(process.env.PORT) || 4000, "0.0.0.0");
