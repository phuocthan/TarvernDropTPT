# PixiJS slot framework · Tavern Drop

The TypeScript/PixiJS 8 framework shares session, transport, reel rendering, asset loading, and audio across game modules. Tavern Drop supplies its own board configuration, UI, art, and Spine presentation. Its rules run on a local mock server.

- `/?game=tarvern` runs Tavern Drop. `/` and `/?game=tavern` also open this game.
- `/?game=default` runs the configurable 3 × 3 example with the shared reel renderer and a separate demo wallet. `/?game=reuse` still works.
- `/?game=viewer` opens the animation player and asset gallery in Vite and on hosts that run `npm start`, including Railway. To disable the viewer on a particular host, start it with `npm start -- --no-animator-viewer`.

The framework implementation lives in this repository. It uses the shared-core/game-module split as an architecture pattern and has no code or runtime dependency from Gen3. Tavern art and audio came from the Paperclip Gaming reference demo and are used here as reference assets. Spine is a separate dependency with its [runtime license](https://esotericsoftware.com/spine-runtimes-license) included under the asset viewer's vendor directory. Confirm the rights to distribute the art, audio, and Spine runtime before commercial handover.

## Development

See the [combined Tavern + 3×3 framework chart and handover assessment](docs/framework-shared-chart.md) for the shared services actually used by each game, game-specific presentation, config policies and remaining SDK work.

The [Gen3 architecture review and resource standard](docs/framework-gen3-review.md) documents the shared app, resource, remote, network, audio, UI and slot-core boundaries. Each game can declare resource bundles/dependencies in its JSON. POST requests use clean URLs and put `gameCode` in the JSON payload. Local development watches backend changes to keep reload/login on the same API contract.

The Tavern and 3×3 configurations use the resumable KRW `/api/v1` mock from [FE–BE Proposal](docs/FE-BE-Proposal.md). See [localhost backend instructions, adapter and request examples](docs/backend-localhost-v1.md). The reusable transport maps numeric boards and server checkpoints into presentation objects; the client acknowledges each completed step.

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

## Start a new game

```sh
npm run game:new -- coral-slot "Coral Slot"
npm run game:build -- coral-slot
npm run game:start -- coral-slot
```

Edit `src/games/coral-slot/game.config.json` for the board, symbols, paylines and reel motion. The standalone build opens the selected game at `/` and includes its own mock API. See the [deployment guide and reuse audit](docs/reusable-game-deployment.md) for custom art, hosting commands and the production backend work.

See the [framework class diagrams and Tavern Drop runtime](docs/framework-classes-and-tavern-runtime.md) for the responsibilities of each class and game module, plus the spin, bonus, and recovery flows.

See the [Milestone 1 handoff and acceptance checklist](docs/milestone-1.md) and the [client release export procedure](docs/milestone-release.md).

See the [Tavern asset inventory](docs/tavern-asset-inventory.md) for CDN verification and the source of the HUD icons.

See the [Tavern performance notes](docs/tavern-performance.md) for the local profiling results and hardware checks.

The fake server owns all demo outcomes and balances. It is not certified math; no real money. The v1 backend persists rounds, receipts and synthetic wallets across restart. A browser test identity is retained in local storage; clearing that identity starts another test account. The reference asset integration is local. Approved math, final client assets and the production API are pending.
