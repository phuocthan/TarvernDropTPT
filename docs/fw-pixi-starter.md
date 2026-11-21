# fw-pixi starter

Gem Reels is a 4×3 slot example with synthetic rounds. The game draws symbols in Pixi, so setup requires no artwork, Spine files or CDN.

## Run

Use Node.js 22.18 or later.

```sh
npm ci
npm run game:build -- gem
npm run game:start -- gem
```

Open http://localhost:4000/. Use the reel motion menu to switch between Normal and Drop, or open `/?motion=drop` to start in Drop. Set the `PORT` environment variable to use a different port. In the multi-game development repo, open `/?game=gem`.

## Add a game

1. Run `npm run game:new -- <slug> "Game name"`.
2. Edit `src/games/<slug>/game.config.json`. Set the grid size, symbols, paylines, spin motion, timings, currency and mock bet settings. Put local assets under `public/games/<slug>/` and declare them in the resource manifest.
3. Use the built-in `basic` skin or give your custom skin a unique name. For a custom skin, add an `entry.ts` that exports `mount(root, game, loader)` and register its entry path with the definition in `src/games/catalog.ts`. See `src/games/gem/` for the custom renderer.
4. Build and start with your slug. A basic game can build standalone before it is registered in the multi-game shell.

The shared session owns spin requests, recovery and presentation completion. The example uses the included mock transport. Pass a different implementation of `GameTransport` to the basic presentation or directly to `createSlotSession` to connect a different API. The demo uses synthetic bets and wallets. Its reload scenario recovers a recorded base round after a lost response and restores its board and final win.

## Verify

With the mock server running and `PLAYWRIGHT_BASE_URL` set to its URL, run `npx playwright test gem.spec.ts`. Set `CHROMIUM_PATH` if Chromium is installed outside the default path in `playwright.config.ts`. The test covers both reel motions, portrait layout and the same Play-Token, round and wallet on recovery.
