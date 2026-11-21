# Tavern Drop M2 re-review — reference input and win timing

Sources:

- **Bundle:** the original Tavern Drop v13 game bundle (`index-Btp6donA.js`). The game served by the public demo at `paperclip.live.engine.io/tavern-drop/v13/` loads the same version.
- **Live:** the public demo in desktop mode on 21 November 2026, measured by counting the demo's round requests (`wallet/play`, `wallet/end-round`) during the input.

Bundle values are exact code constants; the live check confirms the behavior.

## Input

| Input | Reference behavior | Source | M2 build |
| --- | --- | --- | --- |
| Spin / Space press while idle | Starts a wager | Bundle: Spin handler | Same |
| Spin / Space press during a round | Skip (never a wager) | Bundle: the Spin handler sends `skip` while a round is active; a second global Space handler also sends `skip` | Same |
| Tap or click on the game canvas | Skip only; when idle it does nothing | Bundle: canvas `click` sends `skip`; the skip flag is cleared at the next bet | Same (play-area `pointerdown`, never a wager) |
| Space key repeat | Ignored | Bundle: `!event.repeat` | Same |
| Space held 400 ms | Turbo on while held | Bundle: 400 ms timer sets Turbo | Same; release restores the player's own Turbo setting |
| Space held continuously | A new wager starts each time Spin becomes available again, until release | Bundle: an effect re-runs the Spin action while the key is held and Spin is enabled | Same, one wager at a time, after the round was presented and the server allowed the next round |
| Live: Space held 9 s | 6 wagers at 0, 1.2, 4.6, 6.0, 7.2 and 8.5 s (one with a win needing `end-round`); none after release | Live demo | 8 rounds in 9 s on the mock (faster replies); none after release |

## Reel phase

| Step | Normal | Turbo | After a skip | Source |
| --- | --- | --- | --- | --- |
| Outgoing symbols fall | 340 ms | 90 ms | Continues (shortened when skipped during it) | Bundle `prespin`, M2 timeline config |
| Wait before the first reel drops | 350 ms | 50 ms | Cut, then 90 ms | Bundle `reveal`: `_f(skip ? 20 : turbo ? 50 : 350)`, then `skip && wait(90)` |
| Drop of the new symbols | 290 ms per symbol; reels 100 ms apart, rows 67 ms apart | 120 ms; reels and rows 33 ms apart | Turbo values (`le.turbo \|\| ge.skip`) | Bundle `revealReels`; see the frame note below |
| Hold after the last reel | 380 ms | 150 ms | 150 ms | Bundle `reveal`: `wait(skip \|\| turbo ? 150 : 380)` |

Frame note: the bundle's waits (`Xe`) count animation frames. A wait starts counting on the first frame after it is requested and ends on the first frame at or past its value, so at 60 Hz the nominal 15 ms lasts about 33 ms, 40 ms about 67 ms and 70 ms about 100 ms. The M2 timeline uses these effective values for the reel and row offsets (the earlier candidate used the nominal 15 / 40 / 70 ms, which put the five Turbo reel stops within about 60 ms). The reel-stop cue plays with the second symbol of each reel, as in the bundle (`n === 3`). Reel-stop cues are also kept at least 30 ms apart (`reelStopMinGapMs`), so two stops never start together.

A skip while symbols are already falling: the reference reveals the remaining symbols with the Turbo offsets and fast durations. M2 finishes the remaining motion within 280 ms (`skipRemainderMs`), so the landing stays visible and the remaining stops are still heard in order.

## Win phase

| Step | Normal | Turbo | Skip during this step | Source |
| --- | --- | --- | --- | --- |
| Wait before the lines | 500 ms | 300 ms | 300 ms if the reels were skipped; not cut by input | Bundle `boardWin`: `wait(turbo \|\| skip ? 300 : 500)` |
| Reel skip carried into the lines | No | — | The skip flag is reset before the lines | Bundle: `ge.skip = false` before `animateBoardWins` |
| Next symbol of a line | 40 ms | 5 ms | 5 ms | Bundle `BL = 40`, `NL = 5` |
| Gap after each line | 150 ms | none | none | Bundle `DL = 150` |
| Hold after the last line | 500 ms | 500 ms | 500 ms | Bundle `FL = 500` |
| Line amount text | rises 0.6 s, fades in 0.2 s, then falls 0.6 s and fades out after 0.4 s | halved (0.3 / 0.1 / 0.3 / 0.2 s) | halved | Bundle `playLineWinText` |
| Win screen | from 10× bet (Big 20×, Super 50×, Mega 75×, Epic 100×, Max 10,000×) | same | jumps to the next tier | Bundle `boardWin`, `Vu` |
| HUD Win count | after the lines and win screen, 500 ms cubic-out; the round does not wait for it | same in Normal; shown at once in Turbo, after a skip or while Space is held; an early press completes the total before a new wager, and a base spin keeps the previous total until its own result lands (intentional change: the original can be cut off by a quick next spin) | ends at the recorded amount | Bundle `jr.set` (500 ms, `1 - (1 - t)³`) |

Every line is shown, including after a skip; a skip only shortens the per-symbol and gap timing. The earlier M2 candidate counted the HUD Win during the lines and used 700 ms / 850 ms values that are not in the reference. They now follow the table above.

## Not measured live

Frame-accurate tap-to-landing, line visibility and the interval until Spin is available were not measured on the live demo: the demo's internal events are not observable from outside, and a screen recording with sound could not be made in this environment. The values above come from the bundle source. Side-by-side clips with audio remain open (see the review note).
