# PixiJS slot framework · Tavern Drop

The TypeScript/PixiJS 8 framework shares session, transport, reel rendering, asset loading, and audio across game modules. Tavern Drop supplies its own board configuration, UI, art, and Spine presentation. Its rules run on a local mock server.

- `/` runs Tavern Drop with the reference symbol art, logo, backdrop, chest textures, sound cues, and a Spine mascot on desktop.
- `/?game=reuse` runs the configurable 3 × 3 example with the same client session and reel renderer and a separate demo wallet.
- In Vite development, `/asset-viewer/index.html` opens the asset and Spine viewer.

The framework implementation lives in this repository. It uses the shared-core/game-module split as an architecture pattern and has no code or runtime dependency from Gen3. Tavern art and audio came from the Paperclip Gaming reference demo and are used here as reference assets. Spine is a separate dependency with its [runtime license](https://esotericsoftware.com/spine-runtimes-license) included under the asset viewer's vendor directory. Confirm the rights to distribute the art, audio, and Spine runtime before commercial handover.

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

See the [reference audit and unresolved rules](docs/reference-analysis.md) for the original mock implementation and its provisional rules. See [template architecture and extension guide](docs/template-architecture.md) for reuse boundaries.

See the [framework flowchart and JSON configuration standard](docs/framework-flow.md) for adding a game to the shared catalog.

The fake server owns all demo outcomes and balances. It is not certified math; no real money. Sessions reset on server restart. Browser recovery retries the same command only within a live mock session. The reference asset integration is local. The approved game math, final client asset pack, and production API are pending.
