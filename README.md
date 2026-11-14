# Slot template · Tavern first game

PixiJS 8 + TypeScript with a Node HTTP mock backend, reusable board renderer and a separate Tavern skin. Reference-site access is still blocked; this is **not yet a verified recreation of Tavern Drop**. All rules and artwork are provisional.

## Development

Node >=22.18, npm:

```sh
npm ci
npm run dev
```

Vite serves the client (normally port 5173) and proxies the fake API on port 4000. Production:

```sh
npm run build
npm start
```

The Node server serves `dist` and `/api` on `$PORT` (default 4000). Railway configuration is included. This version requires a Node host; static GitHub Pages alone is insufficient.

```sh
npm test
npm run test:browser
```

Browser tests use `/usr/bin/chromium` in the current cloud environment; set `CHROMIUM_PATH` or install Playwright Chromium on another machine.

Read [reference audit and unresolved rules](docs/reference-analysis.md) before deciding game fidelity or final math. See [template architecture and extension guide](docs/template-architecture.md) for reuse boundaries.

The fake server owns all demo outcomes and balances. It is not certified math; no real money. Sessions reset on server restart. Browser recovery retries the same command only within a live mock session. Artwork and audio are code-generated placeholders; original provider assets and Spine files have not been accessed or integrated.
