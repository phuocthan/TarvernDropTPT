# Repository publishing

- The development repository is `phuocthan/TarvernDropTPT`.
- `phuocthan/DropTarvernRelease` is a separate, curated client delivery repository.
- Push to the release repository only when the user explicitly requests that destination. A request to push the main project does not authorize a release push.
- Each release push must contain only the milestone/files/features the user explicitly requested. Do not automatically synchronize later development changes or add unrequested deliverables.
- Preserve existing release history and milestone tags; use a new versioned tag for a new authorized delivery.
- Local profiling captures and downloaded provider application bundles under `output/load-audit/` are temporary diagnostics, outside the project deliverables.

# korRelease exports

- Exclude AI-related documentation from exports to `phuocthan/DropTarvernRelease/korRelease`, including prompts, AI handoff notes, and assistant transcripts.
- Export all documentation in English. Translate included documents and verify the English copy before publishing.

# Framework naming

Use `fw-pixi` as the framework name in current source, documentation and filenames.

# Next-session context

For the next game comparison work, start with `docs/handoff-2026-11-19.md` and `docs/game-comparison-test-plan.md`.

Before continuing the latest client API work, read `docs/handoff-2026-11-19.md` and `docs/client-communication-log.md`. They record the newest client decisions, verified gaps and publishing restrictions.

# Milestone 2 scope

The client approved M1, and M2 preparation is underway. M2 covers the finished Tavern Drop base-game presentation for desktop and mobile. Preserve the reusable `fw-pixi` core and keep Tavern-specific presentation and assets in the game layer.

- Complete the 5×5 base game, including loading, Continue, reel motion and stops, Skip, and all 15 paylines.
- Finish the HUD and controls for balance, bet and win amounts, the bet picker, Spin, Turbo, and Autoplay selection, start and stop.
- Finish the game menu, rules, paytable, and audio settings. Use approved rules and paytable data when supplied.
- Complete Extra Chance and Super Chance selection and the Tavern and Drop Bonus Buy UI, including prices, confirmation and cancellation.
- Complete the base-game win animations, sound cues and amount presentation, including Big, Super, Mega, Epic and Max Win. Verify Scatter landing and anticipation and mascot placement and reactions.
- Show balances, bets, Chance charges, bonus-buy prices and wins in KRW with thousands separators and no decimal places. Check long amounts on mobile and keep currency formatting configurable in `fw-pixi`.
- Cover insufficient balance, connection loss, reconnect and retry in the base-game UI. Use server-confirmed amounts and round state. Keep pending wins separate from confirmed balance.
- Prepare a runnable mock build for M2 review. Use synthetic outcomes and clearly mark values awaiting the client or Team A, including allowed bet steps and approved paytable inputs.

M3 covers the full Tavern and Drop bonus flows, including free spins, retriggers, chests, multipliers and feature resume. M4 covers real-backend integration and acceptance on physical devices. For asset-to-state mappings, see `docs/than/M1_ASSET_STATE_CHECKLIST.md` in the client repository `slot-client`.

# Working flow reaffirmed 20 November 2026

1. Develop and verify changes in the main `TarvernDropTPT` repository.
2. Export/integrate only the requested milestone scope into `DropTarvernRelease`.
3. Submit that reviewed client scope through the client's feature branch and Draft GitLab MR, preserving the approved base and protected main.

**Publication gate:** push to the release repository OR the client's GitLab, and publish/update a client MR, only on an explicit user request for that destination/scope. Running local, pulling, testing or completing a milestone does not authorize either downstream push. Do not auto-sync development changes downstream.
