# Tavern Drop M2 revision candidate

> **Superseded by the [second re-review revision](rereview-2-delivery.md)** and its [reference timing](rereview-2-reference-timing.md). This page records the earlier candidate.

Review baseline: MR !2 at `807f914`. The revised client uses synthetic KRW and the local mock API. This note accompanies the evidence bundle. The candidate still needs a commit on the MR branch before it can be reviewed as a GitLab revision.

## Changes

| Item | Candidate change |
| --- | --- |
| Stakes | The approved list of 25 whole-won stakes is used by the Bet Menu, both sets of step buttons and the mock API. Normal, Extra, Super, Tavern Buy and Drop Buy use ×1, ×3, ×6, ×125 and ×300. The round cap uses ×10,000 of the original base stake. |
| Chance | The HUD shows the base stake and cost per spin together. At ₩20,000, Extra costs ₩60,000 and Super costs ₩120,000. |
| Base round completion | Spin records one debit and an immutable result. The browser shows the round, sends the base-step completion and waits for the confirmed receipt before unlocking Spin. Reload restores the recorded amount without replaying the reels or wins. Win and zero-win rounds use the same completion boundary. Completion can be retried without a second debit or award. |
| Win pacing | The base win count now has separate 850 ms Normal and 400 ms Turbo durations. The last line holds for 700 ms in Normal and 500 ms in Turbo. Per-symbol delays, reel timing and count timing are configured separately. |
| Skip and Space | An accepted ordinary outcome can be skipped while the reels are moving or while the win counts. Tiered wins can advance to the next authored cue. A payout confirmation in flight keeps Spin locked. Holding Space for 400 ms temporarily selects Turbo. Release or loss of focus restores the previous setting. Keyboard auto-repeat does not issue another wager. |
| Bonus notice and audio | The closed Bonus Buy path uses neutral player copy and keeps both bonuses uncharged. The Feature Buy opener uses the special click family. Ordinary controls and shop actions use the standard click family, and bet stepping retains its pitch cue. |
| Paytable | The Info screen identifies the displayed payouts as provisional. The mock and Info use the same game configuration. Five Ale symbols currently pay 2.5× and five Wilds 7.5× in the synthetic configuration. Reference observations of 4× and 20× are recorded for the math review. Iman's approved data is still required before replacing these values. |

In the client repository, the authoritative Tavern config is `games/slot-001/client/than/m2/source/game.config.json`. The review app stages that file into `src/games/tavern/` after validating `RUNTIME_MANIFEST.json`. Update the source config and its checksum when the approved math arrives.

## Run and reproduce

From the review app directory, use Node.js 22.18 or later:

```sh
npm ci
npm test
npm run build
npm start
```

Open `http://localhost:4000/`. Test the 390 px portrait HUD and the desktop Space input in Normal and Turbo. The [review plan](re-review-plan.md) includes the complete ordered stake list.

With the mock server running, set `PLAYWRIGHT_BASE_URL` to its URL and set `CHROMIUM_PATH` to the Chromium or Chrome executable where needed. Run:

```sh
npx playwright test tests/browser/m2-rereview.spec.ts tests/browser/proposal.spec.ts --workers=1
```

Use `M2_CAPTURE=1` for the browser clips and make FFmpeg available on PATH (or set `M2_FFMPEG`). The new browser spec supplies its own fixed synthetic round outcomes using the same mock API implementation.

For an individual check, append `--grep "portrait shows Chance"`, `--grep "zero-win round"` or `--grep "Space skips"`. Set `M2_SCREENS=1` for annotated stills. `M2_REDUCED_MOTION=1` runs the same interaction assertions with the reduced-motion renderer. The v13 bundle confirms a 400 ms hold threshold and separate skip paths for reel motion and win presentation. Compare the reference and candidate clips at the same Turbo setting when judging visual timing and release feel.

## Wallet acceptance sequence

| Fixture | After the recorded debit | After confirmation |
| --- | --- | --- |
| ₩79,000 win at a ₩20,000 base | ₩9,980,000 and Spin locked | ₩10,059,000, Win ₩79,000 and Spin available |
| ₩0 win at a ₩20,000 base | ₩9,980,000 and Spin locked | ₩9,980,000, terminal no-payout receipt and Spin available |
| Lost spin response | The original Play-Token and payload identify the same debit and round | Reload restores the same win and board; both identifiers remain unchanged |
| Lost completion response or repeated completion | The completion refers to the released base step | The same settlement ID and wallet version are returned |

Review the [verification record](verification.md) for the scope of the original smoke checks. Treat the local candidate build identity and browser evidence supplied with this note as a separate verification pass. The live RGS connection remains in M4.

## Verification and remaining review

- The isolated candidate was assembled from `807f914`, installed with `npm ci`, staged against the client-layout asset manifest, and built on Windows with Node.js 24.20.0. Its 68 Node tests passed. See `build-hashes.json` in the evidence bundle for the exact build files and SHA-256 values.
- Chrome 157 passed the reduced-motion browser assertions for Chance at 390 px, the ₩79,000 mid-spin recovery, a zero-win completion held at the response boundary, Space in Normal and Turbo, and a 112.5× tiered base win. The case-specific runs are separate from the earlier baseline smoke checks.
- The evidence includes the mobile Chance/recovery recording, desktop candidate Space recordings with visible key state, and the reference Normal-mode reel tap and hold/release. A separate reference replay for the second tap during the win count remains outstanding. The clips are interaction evidence. Their capture cadence is unsuitable for frame-accurate visual sign-off.
- The original OGG contains non-silent samples at the three selected click and bet cue offsets. The latest isolated main-repository build passed the Chrome test for a single sound-pack load and actual audio playback advancing after a bet-step input.
- The client MR still points at the earlier revision until the staged source overlay is applied and pushed. Final reference timing sign-off and Iman's paytable approval remain open.
