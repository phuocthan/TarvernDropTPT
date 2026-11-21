# Tavern Drop — Milestone 2 features and test guide

Milestone 2 delivers the complete Tavern Drop **base game** on the reusable `fw-pixi` TypeScript/PixiJS framework. It uses the original Tavern Drop v13 art, Spine animations, fonts and sounds, and follows the original game's timing. The Tavern and Drop bonus games are Milestone 3. In M2, confirming a Bonus Buy shows a **Coming Soon in M3** message and no bet is placed.

This guide lists what each M2 item contains and how to test it. Results come from the included mock API with demo credits.

## 1. Test setup

| Item | Value |
| --- | --- |
| Game URL | `https://<your-host>/` or `https://<your-host>/?game=tavern` |
| Local URL | `http://localhost:4000/` after `npm run build` and `npm start` |
| Second layout example | `/?game=reuse` opens a 3×3 game on the same framework |
| Asset viewer | `/?game=viewer` plays each Spine clip, image and sound cue |
| Demo wallet | ₩10,000,000 per new session (synthetic KRW) |
| Asset quality | Automatic. Add `?quality=hd` or `?quality=sd` to force a tier |
| Review tools | **Feature buy → Bonus debug** appears only when the server runs with `MOCK_DEBUG_BONUS=1` (on by default on Railway). It holds the error-state switches used in section 9 |

Test on at least one desktop browser (Chrome, Edge, Safari or Firefox), one Android phone and one iPhone, in portrait and landscape. A new browser profile or private window starts a new demo session.

## 2. Loading, Continue and resume

**Delivered**

- The Paperclip Gaming intro animation plays for 2.7 s without stutter, then the static loader shows the studio logo, the game logo and the loading percentage.
- Phones load the SD texture set and desktops the HD set, as in the original. The canvas renders at up to 2× pixel density.
- The landing screen shows the tavern and **Press to continue**. The press starts the game music and ambience.
- If a round was interrupted, the game shows **Resume Active Game?** and finishes that round before a new bet is allowed.

**How to test**

1. Open the game. Expected: the intro, then the loader with a rising percentage, then the landing screen. No blank frame or flash of unstyled text.
2. Press **Press to continue**. Expected: the reels appear, the HUD becomes active and music fades in.
3. Spin, then reload the page while the reels are moving. Expected: after Continue, **Resume Active Game?** appears. Resume presents the same result, and the balance is charged once.
4. On a phone, add `?quality=hd` and compare with `?quality=sd`. Expected: both load. HD is sharper and uses more memory.

## 3. 5×5 base game, reel motion, skip and 15 paylines

**Delivered**

- A 5×5 board with 15 fixed paylines paying left to right, 3 or more of a kind. Wild substitutes for all symbols except Bonus.
- The original drop motion: outgoing symbols fall out over 340 ms, new symbols drop in reel by reel, land with a squash and settle. Turbo uses the original shorter values.
- Anticipation from two Bonus symbols: remaining reels slow, the camera zooms slightly and an anticipation sound plays.
- Win presentation: lines light up one after another and stay lit; each line shows its payline art and amount (green below 20× bet, red from 20×). The win counter counts up.
- **Skip**: pressing Spin (or Space) during a spin or win presentation completes it at once.

**How to test**

1. Spin 20 times at the default bet. Expected: no symbol pops or flashes when the old symbols fall out; each reel lands in order.
2. Find a spin with several winning lines. Expected: lines are shown one by one, earlier lines stay lit, each line amount appears next to its line, and the total counts up in **Win**.
3. Press Spin again while the reels are dropping. Expected: the spin completes instantly with the same result.
4. Land two Bonus symbols. Expected: anticipation on the remaining reels.
5. Open **Menu → Game Rules → Paytable** and compare 3 of the 15 paylines with a winning spin. Expected: the lit symbols follow the drawn line.

## 4. HUD, bet controls, Turbo and Autoplay (desktop and mobile)

**Delivered**

- HUD layouts for desktop, landscape phones and portrait phones, centered like the original and inside the safe area.
- **Bet ladder (KRW)**: ₩200, 400, 1,000, 2,000, 4,000, 8,000, 12,000, 16,000, 20,000, 24,000, 28,000, 32,000, 36,000, 40,000, 60,000, 80,000, 100,000, 120,000, 140,000, 160,000, 180,000 and 200,000. Default ₩20,000. The steps follow the original USD ladder (₩200 ≈ $0.01, ₩200,000 ≈ $10). The bet click sound rises in pitch along the ladder.
- **Turbo** on/off. Holding Space for 0.4 s turns Turbo on until Space is released.
- **Autoplay**: 10, 25, 50, 100, 250, 500, 1,000 or unlimited rounds. The Spin button shows the remaining count; pressing it stops autoplay. **+10** adds rounds while autoplay runs. Autoplay stops on a bonus trigger, a Max Win, insufficient balance or any error.
- **Space** acts like the Spin button: spin, skip or stop. Holding the key does not repeat spins.

**How to test**

1. Press bet − and + through the whole ladder. Expected: every value above appears, − is disabled at ₩200 and + at ₩200,000. Bet controls are disabled while a round runs.
2. Turn Turbo on and spin. Expected: faster drops and win lines.
3. Start Autoplay with 10 rounds. Expected: the counter on Spin goes down by one per round and stops at 0. Start again and press Spin after two rounds. Expected: autoplay stops.
4. Desktop: press Space once. Expected: one spin. Hold Space. Expected: one spin, Turbo turns on after 0.4 s and off when released.
5. Check the HUD on desktop (1280×720 and 1920×1080), a landscape phone and a portrait phone, including a tall phone such as a Samsung S23 Ultra. Expected: nothing is cut off at the bottom and no page scrollbar appears.

## 5. Menu, rules, paytable and audio settings

**Delivered**

- **Menu** with Game Rules and separate **sound effects** and **music** volume sliders, each with a mute icon.
- **Game Rules** with the paytable (live values from the game configuration), the 15 paylines, features, Extra/Super Chance prices, the max win (10,000× bet) and general rules.
- Sound starts at volume 0.5 for effects and music, as in the original.

**How to test**

1. Open **Menu → Game Rules**. Expected: paytable, paylines and feature text are readable on phone and desktop and scroll inside the panel.
2. Move the music slider to 0. Expected: music stops, effects continue. Restore it. Expected: music resumes.
3. Tap the effects icon. Expected: effects mute and the icon changes.

The RTP line stays hidden until the client supplies the approved RTP figure. The rules text and paytable values need the client's final math sign-off.

## 6. Extra Chance, Super Chance and Bonus Buy

**Delivered**

- **Feature buy** opens a panel with four cards: **Extra Chance** (3× bet per spin), **Super Chance** (6× bet per spin, a triggered bonus is always the Drop Bonus), **Tavern Bonus** (125× bet) and **Drop Bonus** (300× bet). Prices are shown in KRW at the current bet and change with the panel's own bet −/+.
- Each card opens a confirmation with its description and price. **Confirm** applies it; closing the confirmation (×) returns to the panel without changes.
- An active Extra or Super Chance changes the HUD bet label to the chance mode and shows the price per spin. Pressing **Feature buy** again switches the chance mode off, as in the original.
- Cards that cost more than the balance are disabled (dimmed, as in the original).
- **Tavern/Drop Bonus Buy** shows a confirmation with the price. In M2, **Confirm** shows **Coming Soon in M3**: "The Tavern and Drop bonus games arrive in Milestone 3. You have not been charged."

**How to test**

1. Open **Feature buy** at ₩20,000. Expected: ₩60,000, ₩120,000, ₩2,500,000 and ₩6,000,000 on the four cards.
2. Choose **Extra Chance → Activate → Confirm** and spin. Expected: the bet label shows the chance mode and the balance goes down by ₩60,000. Press **Feature buy** again. Expected: the chance mode switches off and spins cost ₩20,000 again.
3. Open Tavern Bonus and close the confirmation with ×. Expected: back in the panel, nothing changes. Open it again and press **Confirm**. Expected: the Coming Soon in M3 message; the balance is unchanged.
4. Set the bet to ₩200,000 with a balance below ₩60,000,000. Expected: Drop Bonus is disabled.

## 7. Win animations, sounds, Scatter anticipation and mascot

**Delivered**

- **Win screens** on the original thresholds per spin: from 10× bet the win screen plays, rising through **Big (20×)**, **Super (50×)**, **Mega (75×)** and **Epic (100×)**; **Max Win** at the 10,000× cap. Wins from 5× and below 10× only count up on the HUD. The amount counts continuously across tiers. Pressing Spin or Space jumps to the next tier; on the last tier it completes the amount.
- **Sounds**: all 66 cues of the original sound sprite with the original triggers (see the asset checklist): reel stops, line wins rising in pitch, round-end coins, win-screen tier stings, Scatter lands, anticipation, ambience and three music layers that build with wins.
- **Mascot**: the barmaid cheers from a 50× win (below Max Win) and with Bonus triggers. Her giggle and mug sounds come from the animation itself.

**How to test**

1. Play until a 10× or larger win, or use the cases in **Bonus debug** if enabled. Expected: the win screen with the correct tier name and sound, then the HUD win.
2. Count the reel stop sounds on a normal spin. Expected: five stops, quieter in Turbo.
3. Watch for a 50× win. Expected: the mascot cheers once.
4. Win on several lines. Expected: each line plays a win sound slightly higher than the one before, and background music gains a layer that fades out about 8 s after the last win.

## 8. KRW formatting and long amounts

**Delivered**

- All balances, bets, prices and wins use the Korean won with no decimals and thousands separators, for example ₩10,000,000.
- On narrow phones, a long balance, win or bet shrinks to fit the space next to the bet arrows instead of overlapping them. Tested up to ₩2,000,000,000 (the Max Win at ₩200,000).

**How to test**

1. Check the balance, bet, win, Feature buy prices and win screens. Expected: ₩ with commas and no decimals everywhere.
2. On a 360 px-wide portrait phone, check the starting balance ₩10,000,000. Expected: it does not touch the bet − arrow.
3. Set the bet to ₩200,000 and open Feature buy. Expected: ₩60,000,000 fits inside its card.

## 9. Insufficient balance, connection loss, reconnect and retry

All four popups use the same style as **Resume Active Game?**.

| State | When it appears | Player options | Money rule |
| --- | --- | --- | --- |
| **Insufficient Balance** | The spin, chance price or buy price is above the balance | OK | No request is sent; autoplay stops |
| **Connection Lost** | A spin request failed or its reply was lost | Retry | Retry resends the same round; the bet is charged once |
| **Reconnecting…** | The browser is offline | Retry is disabled until online | Closes when the browser is back online; never places a new bet by itself |
| **Please Try Again** | The server declined the request | OK | The balance is unchanged |

**How to test with Bonus debug** (Feature buy → Bonus debug → Error states)

1. **Set balance to ₩200**, close the menus, spin at ₩20,000. Expected: Insufficient Balance. **Restore balance** afterwards.
2. **Lose the next spin's reply**, then Spin. Expected: Connection Lost. Press Retry. Expected: the round is shown and the balance changes by exactly one bet plus the win.
3. **Fail the next spin request**, then Spin and Retry. Expected: the same as step 2.
4. **Go offline for 8 seconds**. Expected: Reconnecting…, closing by itself after 8 s.

**How to test without Bonus debug**

- Insufficient balance: raise the bet or a chance mode above the remaining balance.
- Offline: turn on airplane mode (phone) or set **Offline** in the browser's developer tools Network panel, then press Spin. Turn the network back on. Expected: Reconnecting…, then the popup closes; no spin is placed.
- Lost reply: start a spin and switch off the network while the reels move. Expected: Connection Lost; Retry after reconnecting presents the round once.

Screenshots of each state are in `docs/milestone-2-evidence/error-states/`.

## 10. Automated checks

```sh
npm ci
npm test              # 63 unit tests: rules, backend, transport, timing, layout, resources
npm run build         # type check and production build
npm run test:browser  # Playwright browser tests (needs Chromium)
```

## 11. Known limits in M2

- The bonus games (free spins, keys, chests, Total Win) are Milestone 3. They can still appear after a natural Bonus trigger in the demo and are not part of the M2 review.
- Results, balances and Max Win come from the included mock API with demo credits. The real backend adapter and approved math are separate integration work.
- The RTP figure and final rules wording await the client's approved values.
- Assets are the original Tavern Drop v13 runtime files. Their use in the client's release depends on the client's rights to them.
