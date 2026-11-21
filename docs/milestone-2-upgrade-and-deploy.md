# Tavern Drop — upgrading from Milestone 1 to Milestone 2 and deploying

This guide explains what changed between Milestone 1 and Milestone 2, how to move an M1 checkout or deployment to M2, how to deploy M2, and how to bring M2 into the client project.

| | Milestone 1 | Milestone 2 |
| --- | --- | --- |
| Release tag | `milestone-1` (later `milestone-1-v1.1`) | `milestone-2` |
| Presentation | Framework preview with placeholder symbols | Complete Tavern Drop base game with the original art, Spine, fonts and sounds |
| Runtime assets | Not included (separate approved pack) | Included in `public/tavern-assets/` (78 files, 34 MB) |
| Bonus games | Not presented | Milestone 3. Bonus Buy shows **Coming Soon in M3** |
| Source revision | `SOURCE_REVISION` in each snapshot | `SOURCE_REVISION` in each snapshot |

## 1. What changed in M2

| Area | Change | Action needed |
| --- | --- | --- |
| Entry and catalog | `src/main.ts` and `src/games/catalog.ts` now open the Tavern skin by default. `?game=reuse` still opens the 3×3 example; `?game=viewer` opens the asset viewer. | None |
| Tavern skin | New `src/games/tavern/` presentation: HUD, menu, rules, buy panel, win screens, popups, scene, mascot, paylines and sound director. | None |
| Framework | `src/framework/` gains the configurable drop timeline, layout modes, asset quality tiers (`{quality}` placeholder), the Howler sound bus with gain/rate/fades, and the Bonus Buy notice option. Existing M1 interfaces keep working. | None for the 3×3 example |
| Assets | Original Tavern Drop v13 runtime files under `public/tavern-assets/`. The build copies them to `dist/`. | Confirm the client's right to ship them (see the asset checklist) |
| Game config | Bets are the KRW ladder ₩200–₩200,000 (default ₩20,000). Demo balance ₩10,000,000. Chance prices 1×/3×/6×, Bonus Buy 125×/300×, max win 10,000×. | Review against the approved math |
| Mock API | Same `/api/v1` body-only contract as M1. Additions only: `settings.mockBonusEnabled` on the session, an optional `mockBonus` buy field and `POST /api/v1/debug/balance`, all available only when the review switch is on. Bets now come from the game config. | Backend team: no breaking change |
| Server | `MOCK_DEBUG_BONUS` turns the review tools on or off. It defaults to on when the server runs on Railway and off elsewhere. | Set it explicitly per environment |
| Node | Node.js 22.18 or newer, unchanged. | None |
| Docs | New: this guide, the features and test guide, the asset and sound checklist (Markdown and PDF), and error-state evidence. | None |

## 2. Upgrade an M1 checkout

From an existing clone of the release repository:

```sh
git fetch --tags origin
git checkout milestone-2          # or: git checkout main && git pull
npm ci
npm test
npm run build
npm start
```

Open `http://localhost:4000/`. Press **Press to continue** and spin.

The M1 placeholder preview is replaced by the Tavern skin. The M1 mock wallet store (`.runtime/backend-v1.json`) still works; delete it, or point `MOCK_API_DATA_FILE` to a new file, if you want every session to start with the M2 demo balance and bet ladder.

To return to M1, check out `milestone-1-v1.1` and run `npm ci` again.

## 3. Deploy M2

M2 is a Node.js application: `server.js` serves the built game from `dist/` and the mock API under `/api/`. A static host alone cannot run it, because the game needs the API.

### 3.1 Railway (configuration included)

`railway.json` sets the build command `npm run build`, the start command `npm start` and a health check on `/`.

1. In Railway, create a service from the GitHub repository `phuocthan/DropTarvernRelease`, branch `main`. To pin the review build, deploy the `milestone-2` tag's commit.
2. Leave **Build** and **Start** empty so `railway.json` applies. Railway sets `PORT`.
3. Set the variables:

   | Variable | Value | Purpose |
   | --- | --- | --- |
   | `MOCK_DEBUG_BONUS` | `1` for review builds, `0` to hide the review tools | Bonus debug and error-state switches |
   | `MOCK_API_DATA_FILE` | e.g. `/data/backend-v1.json` with a Railway volume mounted at `/data` | Keeps demo sessions across restarts. Without a volume, a redeploy starts fresh sessions |

4. Deploy and open the generated domain. Run the smoke test in section 5.

### 3.2 Any Node.js host or VM

```sh
git clone https://github.com/phuocthan/DropTarvernRelease.git tavern-drop
cd tavern-drop
git checkout milestone-2
npm ci
npm run build
PORT=8080 MOCK_DEBUG_BONUS=0 npm start
```

- On Windows PowerShell: `$env:PORT = '8080'; $env:MOCK_DEBUG_BONUS = '0'; npm start`.
- The server listens on `0.0.0.0:$PORT` (default 4000). Put HTTPS in front with your reverse proxy; the game needs no special headers.
- Run one server process per `MOCK_API_DATA_FILE`.
- To serve the game under a sub-path, the build already uses relative URLs (`base: "./"`); proxy both the page and `/api/` to the same server.

### 3.3 Single-game build (optional)

`npm run game:build -- tavern` builds only Tavern into `.runtime/deploy/tavern/dist`. `npm run game:start -- tavern` serves it at `/` with its own API. Use these as the build and start commands on a host that should carry only this game.

## 4. Configuration reference

| Setting | Where | Notes |
| --- | --- | --- |
| `PORT` | Environment | HTTP port, default 4000 |
| `MOCK_DEBUG_BONUS` | Environment | `1` shows **Feature buy → Bonus debug**; `0` hides it |
| `MOCK_API_DATA_FILE` | Environment | Path of the mock wallet/session store |
| `GAME_TARGET` | Environment | Set by `game:build`/`game:start` for single-game deployments |
| `?game=` | URL | `tavern` (default), `reuse` (3×3 example), `viewer` (asset viewer) |
| `?quality=` | URL | `hd` or `sd` to override the automatic texture tier |
| Bets, prices, timings, texts | `src/games/tavern/game.config.json` | Validated at build time against `src/framework/game-config.schema.json` |
| Rules text, RTP | `src/games/tavern/info.json` | `rtp` is `null` until the approved figure is supplied; the RTP line is then shown |
| Bonus Buy notice | `presentation.controls.bonusBuyNotice` in the game config | Remove it in M3 to enable the bonus buy |

## 5. Smoke test after each deployment

1. `/` shows the intro, the loader percentage and the landing screen. No console errors.
2. **Press to continue** starts music. Spin ten times; the balance changes by the bet and wins.
3. Bet −/+ reach ₩200 and ₩200,000. Turbo and Autoplay (10 rounds) work.
4. **Menu → Game Rules** opens; the volume sliders work.
5. **Feature buy** shows four cards with KRW prices. Tavern Bonus → Confirm shows **Coming Soon in M3**.
6. Reload during a spin; **Resume Active Game?** finishes the round.
7. With `MOCK_DEBUG_BONUS=1`, run the error states in section 9 of the features and test guide.
8. Repeat steps 1–3 on a phone in portrait and landscape.

## 6. Bring M2 into the client project (GitLab `slot-client`)

M1 was placed in the client repository as `apps/player-web/than/` (reusable client), `games/slot-001/client/than/` (game module and review asset pack) and `contracts/player-draft-v2/than/` (API mapping). M2 is one self-contained package. Apply it on a new branch from the coordinator's integration branch:

1. **Client package.** Replace the contents of `apps/player-web/than/` with the M2 snapshot: everything in the release repository except `.git`. Keep any client-owned files you added there, such as `.env.example` or the `licenses/` notices, and refresh the notices from `npm ci` if your process requires them.
2. **Game module and assets.** The Tavern presentation now lives in `src/games/tavern/` and its runtime assets in `public/tavern-assets/` inside the package, so the build copies exactly that allowlisted tree. The M1 review files in `games/slot-001/client/than/` (review skin, M1 inventory and the `assets/runtime/` pack) are superseded. Keep them only for history, or replace the inventory with `docs/milestone-2-asset-checklist.md`. The `assets/` files are identical to the M1 runtime pack and are listed with SHA-256 in the checklist.
3. **Contracts.** `contracts/player-draft-v2/than/` is unchanged by M2. The M2 mock API is backwards compatible with M1 (section 1).
4. **Run** from `apps/player-web/than/`: `npm ci`, `npm test`, `npm run build`, `npm start`.
5. **Backend integration.** The game talks to the server only through the transport in `src/framework/transport/proposal.ts` (contract `proposal-v1`). To connect the real backend, implement the agreed adapter behind the same `GameTransport` interface (`src/framework/domain/contracts.ts`) and keep the mock out of the production entry. The current request and response fields are in `docs/milestone-1-api.md`; the resource pipeline is in `docs/fw-pixi-architecture.md`.
6. Commit, push the branch and open a Draft MR for review.

## 7. Release record

| Item | Value |
| --- | --- |
| Repository | `phuocthan/DropTarvernRelease`, branch `main` |
| Tag | `milestone-2` (earlier tags unchanged) |
| Source revision | `SOURCE_REVISION` |
| File checksums | `EXPORT_MANIFEST.json` (SHA-256 of every exported file) |
