import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { MockGame } from "./server/mock-game.ts";
import { games as catalog } from "./src/games/catalog.ts";

// Each demo has its own sessions and cookies.
const games = new Map(catalog.map((definition) => [
  definition.routing.apiBase,
  { definition, cookie: `${definition.routing.query}-session`, sessions: new Map() },
]));
const root = resolve("dist");
const viewerRoot = resolve("asset-viewer");
const loopbackPeers = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const loopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
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
      if (
        process.argv.includes("--no-animator-viewer") ||
        !loopbackPeers.has(req.socket.remoteAddress) ||
        !loopbackHost.test(req.headers.host ?? "")
      ) {
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
