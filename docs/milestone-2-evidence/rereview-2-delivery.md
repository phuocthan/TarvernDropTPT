# Tavern Drop M2 — second re-review revision

Baseline: the build reviewed in MR !2 at `44aab3b`. The confirmed items from that review stay unchanged: the 25 ordered KRW stakes, the Chance prices and the fixed ₩79,000 single-window recovery. Everything below uses the included mock API with synthetic KRW. The live RGS connection remains Milestone 4.

## Client items

| # | Item | Change | Verified by |
| --- | --- | --- | --- |
| 1 | Fresh wager versus retry, two windows | Each paid request carries the client's request ID. A retry repeats the ID, token and payload and gets the same round. A click on an out-of-date token in another window is refused (`STALE_PLAY_TOKEN`) with the current state; the window refreshes its balance, shows **Game Updated** and never presents or bets on the other window's round | Backend and adapter unit tests; browser test "two windows" |
| 2 | Late replies and readiness | Replayed receipts are marked as history and carry the current state separately. Every reply has a `stateVersion`; older replies never overwrite the wallet or unlock Spin. After a round completes, the client confirms the current state before Spin unlocks. While a round is open in another window, Spin stays locked ("Round open in another window") and re-checks every 3 s | Browser test "two windows": A's late ₩10,059,000 reply arrives while B's round is open; A shows ₩10,039,000 and stays locked, then unlocks at ₩10,118,000 |
| 3 | ₩0 completion | A ₩0 round closes as `no_payout` with a settlement ID and the next play token, and keeps the post-debit wallet version | Backend test; browser test "zero-win round" |
| 4 | Skip input | Spin, a second Space tap or a tap on the play area skips the active round. A tap never starts a wager, also when the round ends between press and release | Browser test "play-area tap" |
| 5 | Skip presentation | The drop is no longer replaced by the final board. A skip before the drop waits 90 ms and drops with the Turbo values; a skip while symbols fall finishes the motion within 150 ms, still visible. The reel skip does not skip the lines: every line and amount is shown, and a skip during the lines only shortens them | Measured in the browser: tap during the drop, all 25 symbols land 73 ms later; browser tests "play-area tap" and "Space" |
| 6 | Win timing | Follows the original values: 500 ms (300 ms) before the lines, 40 ms (5 ms) per symbol, 150 ms line gap, 500 ms after the last line. The Win amount counts up over 500 ms after the lines and win screen, without holding the next round. The earlier 700 ms / 850 ms values were removed | Reference timing table |
| 7 | Continuous Space hold | Holding Space keeps playing, one wager at a time; the next starts after the round was shown and the server allowed it. Key repeat is ignored; key-up, window blur or a hidden page stop the series; Turbo returns to the player's setting | Browser test "Space"; live check of the original (6 wagers in a 9 s hold) |
| 8 | Interrupted win | After a reload, the recorded board and win are shown first with Spin locked; the completion is sent afterwards and the confirmed balance follows | Browser test "interrupted win" |
| 9 | Portrait HUD, ₩200,000 Super Chance | Mode and cost stack on two lines, so the bet field keeps its width; balances shrink only to fit beside the bet arrows | Browser test at 320 px then 390 px: full ₩10,000,000 visible, no overlap, no horizontal scroll |
| 10 | Feature Buy cue and notice | One click plays one cue: the special cue when opening Feature Buy, the standard cue when the same button disables a Chance mode (as in the original). The Bonus Buy lock keeps the neutral "Bonus not available" copy; the original has no locked Bonus Buy screen to copy | Code review; sound-pack browser test |
| 11 | Stale test expectations | The locked Spin label is now "Round in progress"; the 3×3 force-stop test counts wagers only (the completion uses the same endpoint) | Updated browser tests |

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 72/72 passed |
| `npm run build` | Passed (type check and production build) |
| Browser tests, production build with the mock API (Chrome, Windows) | `m2-rereview.spec.ts` (10 tests), `proposal.spec.ts` (5), `tavern-policies.spec.ts` (6): all assertions passed across the runs on 21 November 2026. The two-window test failed once while both windows ran in the background and passes since each window is brought to the front; the foreground Scatter test (bonus, M3) is timing-sensitive and passed on rerun |
| Browser tests, development server | `framework-policies.spec.ts` (4): passed |
| Candidate clips (no sound) | Desktop Space tap and hold, Normal and Turbo; mobile 390 px Chance and ₩79,000 recovery. Recorded by the browser tests with `M2_CAPTURE=1` (key state shown in the corner). The recording hook exceeds the test time limit while encoding; the clips are complete |
| Reference timing | [Reference input and win timing](rereview-2-reference-timing.md) |

## Open items

- **Side-by-side clips with sound.** Candidate clips without sound are produced by the browser tests (`M2_CAPTURE=1`). A synchronized recording of the original with game audio could not be made in this environment and is still required for the review.
- **Frame-accurate reference timing.** The values come from the original source code and a live request-count check, not from frame measurements of the live game.
- **Contract.** `requestId`, `replayed`, `current` and `stateVersion` are additions to the synthetic mock and adapter only. They must be agreed with Team A before the live integration.
- **Same browser, two tabs.** The windows share local storage. The pending-request record is keyed per request ID, so a fresh click in one tab cannot reuse another tab's pending wager; a full per-tab separation is left for the live integration.
- Provisional paytable values and Iman's math approval are unchanged.
