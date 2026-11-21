# Tavern Drop — Milestone 2

The complete Tavern Drop **base game** on the reusable `fw-pixi` TypeScript/PixiJS framework, with the original Tavern Drop v13 art, Spine animations, fonts and sounds. The same framework also runs a 3×3 example. The Tavern and Drop bonus games follow in Milestone 3; in this build, confirming a Bonus Buy shows **Coming Soon in M3** and no bet is placed.

Results, balances and the KRW demo wallet come from the included mock API.

## Run

Node.js 22.18 or newer and npm:

```sh
npm ci
npm test
npm run build
npm start
```

Open `http://localhost:4000/`, press **Press to continue** and spin.

| URL | Opens |
| --- | --- |
| `/` or `/?game=tavern` | Tavern Drop 5×5 |
| `/?game=reuse` | 3×3 example on the same framework |
| `/?game=viewer` | Asset viewer: Spine clips, images and sound cues |
| add `&quality=hd` or `&quality=sd` | Forces the texture tier |

Development server with hot reload: `npm run dev` (game on port 5173, API on 4000). Browser tests: `npm run test:browser` (set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`).

Designated mock review sessions can open **Feature buy → Bonus debug** for error-state testing. Set `MOCK_DEBUG_BONUS=0` to reject debug requests at the server.

## Documents

| Document | Content |
| --- | --- |
| [Upgrade from M1 and deploy](docs/milestone-2-upgrade-and-deploy.md) | What changed since M1, upgrade steps, Railway and Node deployment, applying M2 to the client project |
| [Features and test guide](docs/milestone-2-features-and-testing.md) ([PDF](docs/milestone-2-features-and-testing.pdf)) | Every M2 scope item, how to test it and the expected result |
| [Asset and sound checklist](docs/milestone-2-asset-checklist.md) ([PDF](docs/milestone-2-asset-checklist.pdf)) | Every file, sound cue and Spine clip: used or not, where, and whether it matches the original |
| [Error-state evidence](docs/milestone-2-evidence/error-states/README.md) | Insufficient balance, connection lost, reconnecting and retry captures |
| [fw-pixi architecture](docs/fw-pixi-architecture.md) | Framework structure and resource pipeline |
| [API fields](docs/milestone-1-api.md) | Request and response fields of the mock API |
| [Asset inventory](docs/tavern-asset-inventory.md) | Asset sources and how to recheck them against the provider's CDN |
| [Milestone 1](docs/milestone-1.md) | M1 scope, kept for reference |

[`SOURCE_REVISION`](SOURCE_REVISION) records the development commit of this snapshot. [`EXPORT_MANIFEST.json`](EXPORT_MANIFEST.json) lists the SHA-256 of every exported file. Earlier milestone tags are unchanged.

The `korRelease/` folder holds the Milestone 1 copy in the client repository layout. It is not changed by this release.
