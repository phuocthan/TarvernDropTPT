import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { MockGame } from "./server/mock-game.ts";
import { tavern } from "./src/games/tavern/definition.ts";

const sessions = new Map(); // Demo sessions reset on server restart. Production uses durable storage.
const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
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
      const id = /(?:^|;\s*)tavern-session=([a-f0-9-]+)/.exec(
        req.headers.cookie || "",
      )?.[1];
      if (req.method === "GET" && path === "/api/session") {
        const sessionId = id && sessions.has(id) ? id : randomUUID();
        if (!sessions.has(sessionId)) {
          if (sessions.size >= 500)
            return json(res, 503, { error: "DEMO_SESSION_LIMIT" });
          sessions.set(sessionId, new MockGame(tavern));
        }
        res.setHeader(
          "Set-Cookie",
          `tavern-session=${sessionId}; HttpOnly; SameSite=Lax; Path=/`,
        );
        return json(res, 200, sessions.get(sessionId).state);
      }
      if (req.method === "POST" && path === "/api/command") {
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
          return json(res, 200, sessions.get(id).execute(JSON.parse(body)));
        } catch (error) {
          return json(res, 409, { error: error.message || "INVALID_COMMAND" });
        }
      }
      return json(res, 404, { error: "NOT_FOUND" });
    }
    const file = resolve(
      root,
      "." + (path === "/" ? "/index.html" : decodeURIComponent(path)),
    );
    if (!file.startsWith(root + sep)) {
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
