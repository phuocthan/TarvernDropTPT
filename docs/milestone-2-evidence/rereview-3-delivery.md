# Tavern Drop M2 — third re-review revision

Baseline: the shared preview reviewed after the [second re-review revision](rereview-2-delivery.md). This revision is the build of development commit `3add3c3`, the commit the shared preview runs. Everything below uses the included mock API with synthetic KRW. The live RGS connection remains Milestone 4.

## Client items

| # | Item | Change | Verified by |
| --- | --- | --- | --- |
| 1 | Bottom WIN stays readable | An early Spin or Space press while the amount still counts completes the total and places no wager; the next press places it. In Turbo, after a skip or while Space is held, the total appears at once. The total of a base spin stays in **Win** while the next reels drop and clears when the new result lands, so an immediate next spin (including held Space) no longer returns it to ₩0 | Browser check on the development server: press at ₩50 of ₩500 → ₩500, no new wager; second press wagers; ₩500 still shown during the next drop. Browser tests "Space" and "play-area tap" |
| 2 | Reel drop and stop rhythm | The original counts its waits in animation frames, so its nominal 15 / 40 / 70 ms last about 33 / 67 / 100 ms at 60 Hz. The timeline now uses these effective values for reel and row offsets in Normal, Turbo / held Space and after a skip. Reel-stop cues are also kept at least 30 ms apart, so two stops never start together. A skip while symbols fall finishes the motion within 280 ms (was 150 ms). A skipped win still shows every winning line and its symbols before the next spin | Measured cue start times: Normal 91–127 ms between stops (about 0.4 s first to last); Turbo 30–39 ms (125–147 ms first to last, was about 42 ms); after a skip 35–37 ms. [Reference timing](rereview-2-reference-timing.md) |
| 3 | Coin cue on the balance credit | Every positive round total plays one coin cue as the balance goes up: the coin cue alone at a reduced level up to 1× bet, with the total-win sting above 1× and the big sting above 50×. A zero win stays silent, and a settled round shown after a reload does not play it. When the next spin starts while the coin cue is still playing, the click and spin-start cues play at a reduced level; no wait was added | Measured: wins of ₩200, ₩600, ₩700, ₩750 and ₩950 at a ₩1,000 bet each started one coin cue; zero wins started none |
| 4 | BET shows the price of one spin | One amount: ₩20,000 in Normal, ₩60,000 in Extra Chance and ₩120,000 in Super Chance at a ₩20,000 base; the separate Cost line is removed. As in the original, the label above the amount reads **Extra Chance** or **Super Chance** instead of **Bet** while the mode is active. Turning Chance off returns to **Bet ₩20,000**. Mode, base bet and charge stay separate in the round data; payouts and the 10,000× cap use the base bet. A first visit selects Normal at ₩1,000; a resumed round keeps its recorded bet and mode | Browser tests "portrait shows Chance base and costs" (₩60,000, ₩120,000, label, back to ₩20,000) and "portrait HUD … ₩200,000 Super Chance" (₩1,200,000 at 320 and 390 px) |
| 5 | Sound default and saved settings | Sound is on for a first visit; it starts at entry when the browser allows audible autoplay, otherwise on the first Continue press. The speaker state and both channel levels are saved in the browser and restored before any sound plays; Continue no longer turns sound back on. Turning sound on again is saved too. Each channel remembers its last audible level, so unmuting returns to it, also after a reload | Unit tests (`audio-preferences`); browser check: Effects and Music at 0, reload, Continue, spin → every cue at volume 0; speaker off, reload, Continue, spin → no cue started; Music 80 → 0, reload, unmute → 80 |

Item 9 of the second revision (Chance mode and cost stacked on two lines) is replaced by item 4 above.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 76/76 passed (development repository and the client review app) |
| `npm run build` | Passed (type check and production build) in both |
| Browser tests, development server (Chrome, Windows) | `m2-rereview.spec.ts`, `proposal.spec.ts`, `tavern-policies.spec.ts` and `framework-policies.spec.ts`: 24/24 passed in one run on 21 November 2026 |
| Shared preview | `https://slotdemo.up.railway.app/?game=tavern` serves the build of `3add3c3` (same entry file names as a local build of that commit) |

## Open items

- **Side-by-side recording with game audio.** Still not recorded: the reference/build comparison for Normal, Turbo and a skipped line win, including the balance credit and the next spin. The timings above are cue start times measured in the browser; the rhythm and the coin mix were not yet compared with the original by ear.
- **Audible autoplay at entry.** The entry path is implemented; in the checks here the browser required the Continue press, so only that path was observed.
- **Settled round after a reload.** The coin cue is not on that path by construction; there is no dedicated browser test for it yet.
- **Line timing.** The per-symbol and line-gap waits of the win lines still use the nominal 40 / 5 / 150 ms. The original counts these in frames as well; they were left unchanged in this revision.
- Contract additions, same-browser tabs and the provisional paytable are unchanged from the second revision.
