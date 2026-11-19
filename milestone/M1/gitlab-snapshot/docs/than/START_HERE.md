# Tavern Drop M1 - first runnable client

This branch starts from the approved GitLab commit `880a75e406d3a28c03dfa39b3ead93d1a4b4a13b`. The original seed and its 22 synthetic `player-draft-v2` cases are preserved.

| Path | Purpose |
| --- | --- |
| `apps/player-web/than/` | Shared TypeScript/PixiJS `fw-pixi` source, lockfile, tests and separate build profiles |
| `games/slot-001/client/than/` | 5×5 presentation configuration, optional Spine bindings and runtime inventory |
| `contracts/player-draft-v2/than/` | Proposed adapter mapping and four KRW request/response sequences for Team A |

## Hosted Tavern Drop progress build

Open the [current playable Tavern Drop build](https://slotdemo.up.railway.app/) to review the 5 x 5 game presentation. Continue past the opening screen and use **Spin** for base play. The bonus menu lets you try Tavern or Drop with demo credits and follow the free spins and Total Win presentation. Drop chest reveals depend on the keys collected in the round.

The hosted build is a separate development preview backed by a mock API. The GitLab branch below is the reproducible M1 source submission. Use the [Asset Viewer](https://slotdemo.up.railway.app/?game=viewer) to inspect individual animations, artwork and audio.

## Run and review

Use Node.js 22.18 or newer from this repo:

```sh
cd apps/player-web/than
node tools/verify-delivery.mjs
npm ci
npm test
npm run dev
```

Open [5×5](http://127.0.0.1:4361/mock.html) or [3×3](http://127.0.0.1:4361/mock.html?game=3x3). Both run on the same new controller and reel renderer with placeholder symbols. Replay plays the same recorded input. Reload restores the local presentation cursor. The 5×5 uses the original synthetic v2 TST case and the 3×3 uses a recorded KRW loss. These are development cases.

```sh
npm run build:mock
npm run preview:mock
npm run build
```

Stop the development server before starting the preview on the same port. The mock build goes to `dist/mock`. The independent production build goes to `dist/production`. It exports `fw-pixi.js` and has an integration entry awaiting the approved adapter. Build manifests include the source commit, lockfile hash and artifact hashes.

Use Playwright Chromium, or set `CHROMIUM_PATH` to an installed browser before `npm run test:browser`. Browser evidence is written under `test-results/evidence`.

To preview animations, artwork and audio without a local pack, open the [Tavern Drop Asset Viewer](https://slotdemo.up.railway.app/?game=viewer). See the [viewer instructions](../../games/slot-001/client/than/IMPLEMENTATION.md#preview-assets-online).

For asset-pack review, use the [game module instructions](../../games/slot-001/client/than/IMPLEMENTATION.md). See the [M1 evidence](M1_EVIDENCE.md), the [proposed v2 mapping](../../contracts/player-draft-v2/than/MAPPING.md) and the [KRW draft](../../contracts/player-draft-v2/than/krw-review/API.md).
