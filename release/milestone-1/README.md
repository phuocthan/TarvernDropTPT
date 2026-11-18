# Tavern Drop Framework Preview — Milestone 1

Reusable TypeScript/PixiJS core with a 5×5 Drop preview and a 3×3 Normal example, sharing the session, controller, reels, config and API adapter. Temporary Pixi-drawn symbols are intentional M1 placeholders. This is a runnable framework delivery candidate, not the finished Tavern presentation.

## Build and run

Node >=22.18 and npm:

```sh
node tools/verify-m1.mjs
npm ci
npm test
npm run build
npm start
```

Open `http://localhost:4000/?game=tavern` (5×5 Drop) or `http://localhost:4000/?game=default` (3×3 Normal). `?game=reuse` also opens 3×3. Click Spin. Each game has its own synthetic wallet. The preview fixes its base bet and does not expose a full bonus scene, bet shop or animation viewer.

To run on another port in PowerShell:

```powershell
$env:PORT = '4351'
npm start
```

For development: `npm run dev` (Vite 5173; API 4000). The server runs the current body-only `/api/v1` mock. Its synthetic JSON store persists across restarts at `.runtime/backend-v1.json`; use `MOCK_API_DATA_FILE` to choose a separate store. Run one process per store. Real authentication, wallet, final math and production storage belong to the later agreed integration.

## Browser checks

Install Playwright Chromium (`npx playwright install chromium`) or set `CHROMIUM_PATH` to an existing Chrome executable. `npm run test:browser` builds and starts an isolated production preview on 4352, then checks both routes, spin and reload. Set `PLAYWRIGHT_BASE_URL` to test an already-running M1 host instead.

## Review documents

- [M1 scope and acceptance](docs/milestone-1.md)
- [Shared architecture and flowchart](docs/architecture.md)
- [Asset specifications and verification limits](docs/milestone-1-asset-spec.md)
- [Current API fields and sanitized synthetic examples](docs/milestone-1-api.md)
- [Local backend run instructions](docs/backend-localhost-v1.md)
- [Verification evidence](docs/milestone-1-evidence/verification.md)
- [Development source revision](SOURCE_REVISION)
- [Export file checksums](EXPORT_MANIFEST.json)

The public snapshot contains core source, placeholder configs, synthetic backend, tests, docs and evidence. Original reference artwork/audio/Spine exports, custom Tavern scenes, viewer, local player data, research captures and development history are excluded. Asset inventory/playback evidence describes the development reference pack; client approval of the final asset pack and branding remains open.

This GitHub release snapshot is provided for review. Client acceptance/sign-off and a future GitLab destination are separate from pushing the source. Existing milestone tags remain unchanged.
