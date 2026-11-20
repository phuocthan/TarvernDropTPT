# Tavern Drop — reference v13 parity (20 November 2026)

This document records the work done to match the original Tavern Drop v13 build (the "reference"). It covers the evidence taken from the reference bundle, how `fw-pixi` and Tavern now behave, and what still differs. It is a development and AI handoff note: **exclude it from korRelease exports**.

## Sources and method

- **Reference bundle:** `index-Btp6donA.js` and `index-JDgoUbSF.css` from `paperclip.live.engine.io/tavern-drop/v13/`. Local copies are in `.runtime/`, which Git ignores. Extracted CSS, icons and HUD component sources are in `.runtime/ref-ui/`.
- **Rule:** behaviour and numbers come from the bundle source, not from screen measurement. Live measurement is used only to confirm a result.
- **Reference stack:** Svelte with GSAP. GSAP ease names map to standard curves: `power1` = quad, `power2` = cubic, `power3` = quart, `power4` = quint. CustomEase paths are evaluated by `fw-pixi`'s `presentation/custom-ease.ts`.
- **Live demo session:** open `https://paperclipgaming.com/ko/games/tavern-drop` and use the iframe `src`. Sessions expire, so get a fresh one each time.

## Commits (main, not yet pushed)

| Commit | Summary |
| --- | --- |
| `e197995` | Scene dims, game entry, chest camera and layout mode match the reference |
| `c9d08c0` | Spin stays blocked until a winning result, including free spins, has been presented |
| `a3df731` | Reference drop timeline: per-symbol eases, staggers, turbo and scatter anticipation |
| `0cc690b` | Round pacing, cumulative line wins, short-viewport layout and no page scroll |
| `67839cf` | Desktop/landscape HUD centred like the reference |

## Comparison by area

Status: ✅ matches the reference source · ⚠️ partial or approximate · ❌ not done.

### Layout mode (portrait / landscape / desktop) — ✅

The reference measures `.main-wrap` (the full viewport):

```
w == 0 && h == 0                      → desktop
(h < 449 || (w < 661 && w > h)) && w > h → landscape
w < 661                                → portrait
otherwise                              → desktop
```

`fw-pixi` adds the opt-in module `presentation/layout-mode.ts` (`layoutModeFor`, `observeLayoutMode`). Tavern enables it with `presentation.layout: { mobileWidth: 661, mobileHeight: 449 }`. The module sets `html[data-layout]`, and `theme.css` uses `:where(html[data-layout=…])` selectors so specificity does not change. `tests/layout-mode.test.ts` checks the module against the reference rule on a dense grid of sizes.

### Scene dims and transitions — ✅

- **Reel fade:** the reference darkens through the reelhouse `fade` slot (black rectangle at 0.75 alpha). Tavern uses the same slot object, and DOM layers under it (mascot, table) follow the same brightness. No blur is used.
- **Screen dims:** the dim for Total Win and other dialogs comes from the screens skeleton's `fade` attachment. It is published as `--spine-screen-dim`, and an open dialog keeps a 0 dim until its close event. This removed the black flash after Total Win.
- **Landing → game:** the double dim was removed. Symbols are hidden until `1_game_enter` reveals them.
- **Continue hover:** brightness only, with no upward movement.

### Chest camera — ✅

The reference uses `playChestFinalWins`. Scale is 1.4 (portrait 1.125). The upward lift is 20 px in portrait, 15 px below 600 px wide, 100 px below 900 px wide, and 200 px otherwise. It runs for 0.5 s with `power2.out`. Tavern takes these values from `presentation.chestCamera`, and `releaseChestZoom()` eases back before Total Win.

### Symbol drop (spin) — ✅

The opt-in config is `presentation.drop.timeline`, implemented in `presentation/drop-timeline.ts` and the timeline path in `board.ts`. Distances are in reference units, where 564 units equal one row and are scaled to the board's row pitch.

| Phase | Reference (normal / turbo) | Tavern config |
| --- | --- | --- |
| Exit | `y + 3400` over 340 / 90 ms, `power3.in`. At normal speed the tween is cut after 220 ms and finished in 50 ms. Rows start bottom first, 40 / 10 ms apart. Reels start together (turbo 15 ms apart). | `exit` |
| Wait for result | 350 / 50 ms after the result arrives | `enter.waitMs`, `turboWaitMs` |
| Enter | Start at `-2200 + row×100`, rest at `row×564`, over 290 / 120 ms. Ease is the CustomEase `M0,0 C0.566,0.382 0.689,1.015 …` (overshoots about 1.5 % and settles). Reels drop left to right, 70 / 15 ms apart; rows bottom first, 40 / 15 ms apart. | `enter` |
| Land | Land state fires 250 ms before rest. Squash then runs: 1.1/0.88 for 70 ms → 0.94/1.06 for 90 ms → 1 for 120 ms. | `landLeadMs`, `presentation.landing` |
| Reel stop sound | When row index 3 starts | `reelStopRow` (default rows − 2) |
| Anticipation | Applies when the scatter count including this reel is 2–3, not in turbo, and not on the last reel. Rows drop 100 ms apart, the game waits for the reel, then pauses 800 ms. | `anticipation` |
| Anticipation zoom | Scene scales 1 → 1.05 over 4 s, linear. After a 100 ms delay it returns to 1 over 300 ms with `power4.out`. | `app.ts` `anticipationZoom` |
| Reveal end | One fixed 70 ms reel offset after the last reel's own offset, then 380 / 150 ms | `settleWaitMs`, `turboSettleWaitMs` |

Measured in Tavern: at normal speed the first symbol lands at about 0.5 s and the last at about 0.95 s after the click. In turbo all symbols land between 0.2 and 0.34 s. During anticipation the zoom reads 1.019 at 1.5 s.

### Round pacing and Spin availability — ✅

From the bundle (`fB`, `n2`):

- The Spin button is disabled while `gameState` is `activeBet` and autoplay is off. A round ends only after its whole presentation, including wins, big win and free spins. Mouse spam therefore does nothing until the round ends.
- Tavern matches this with the `winPresentation` flag (`c9d08c0`). After a no-win spin, Spin re-enables about 80 ms after the last symbol lands.
- **Autoplay:** the game uses `autobetTimeoutDuration: 0`, so the next base round starts immediately. Tavern previously waited 500–900 ms.
- **Free spins:** `bonusReveal` waits 500 / 300 ms before each spin. The first spin also waits the 500 ms tail of `bonusEnter`, set as `feature.startDelayMs: 500`.

### Win presentation — ✅ (minor ⚠️)

From the bundle (`boardWin`, `animateBoardWins`, `playLineWinText`):

- `boardWin` starts 500 / 300 ms after the reveal. This is `checkWinDelayMs` and lands about 570 ms after the last symbol lands.
- **Lines accumulate:** symbols of earlier lines stay lit while new lines are added.
- **Line timing:** within a line, each symbol starts its win animation 40 ms after the previous one (turbo 5 ms). A line ends with a 150 ms pause (normal only). The last line holds an extra 500 ms. A 5-symbol line takes about 850 ms.
- **Payline clips:** each payline plays `payline_N` at its own speed on its own Spine track, so lines overlap.
- **Line amount:**
  - Colour: green, or red when the line pays at least 20× the bet.
  - Fades in over 0.2 s.
  - Then falls with `power3.in` to below the board while wobbling ±0.08 rad, and fades out from 0.6 to 0.8 s.
  - Turbo halves every duration.
  - A second amount at the same anchor is moved down 0.25 row.
- ⚠️ The reference rises by `reelPitch × row − 200`, using reel pitch 574. Tavern uses row pitch 564. The difference is invisible at this scale.

### Short viewports and scrolling — ✅

- The reference sets `html { overflow: hidden; height: 100% }`. Tavern now does the same (`html:has(.tavern-shell)`) and no longer has the 350 px minimum height. Before this, windows like 1380×172 showed a scrollbar.
- **Landscape/desktop background:** the reference covers a 5800×3800 box centred on the viewport (`QL` plus `JL`). Tavern now does the same, so very wide or short windows no longer push the table over the board.
- ⚠️ Portrait still uses the earlier bottom-anchored camera (`presentation.camera.portraitBottom`).

### Free-spin HUD — ✅

The reference feature HUD has **no Spin or Autoplay button**, because free spins run on their own. Tavern now follows the bundle templates `iU` (desktop/landscape) and `lU` (portrait):

- **Desktop/landscape:** `[menu, balance, bet, win]`, then the bonus info `Wf`, then a column of Skip bonus above Turbo.
  - `Wf` is a white box with TOTAL WIN (cyan, 1.3em) over the amount (1.8em), and below it a FREE SPINS | value row with a 0.2em × 2.8em divider. Boxes have a 0.25em black border and 0.75em radius, with a minimum width of 13em.
  - In landscape `Wf` is scaled to 0.8, as in the reference `transform: scale(0.8)`.
- **Portrait:** top row `[menu] [TOTAL WIN] [FREE SPINS] [skip / turbo]`, then `[balance] [bet] [win]` on three equal columns.
- **Skip bonus (`i2`):** `#skip-bonus` is shown disabled (opacity 0.7), because the mock backend cannot skip a feature.
- Checked at 1280×720, 844×390 and 390×844.

### Symbols during the bonus transition — ✅

The reference symbols live in the reelhouse `slot_symbols` slot, so they fade with it. The skeleton keys this slot as follows:

- `2_base_exit` fades it 1 → 0 between 0.2 and 0.67 s.
- `2_bonus_enter` brings it back 0 → 1 by 0.42 s.
- `2_bonus_exit` and `2_base_enter` fade it the same way.

Tavern's symbol canvas now follows the slot alpha during `prepareBonusIntro` and `enterBonus`, in addition to the game entry and Total Win paths. Before this change, the frame faded while the symbols stayed bright.

### Buy screen bottom panel — ✅

The reference `.bottom-panel.svelte-1vd6a7q` uses the buy-screen font: `min(16px, w/58, h/22.5)`, or `min(16px, w/20)` when `h > w && w < 768`.

- **Panel:** 0.75em from the bottom, padding 0.45em 0.9em 0.45em 1.2em, background `rgba(9,13,14,.7)`, 0.75em radius, 1.1em gap.
- **Text:** label 0.8em, value 1.15em.
- **Bet button:** 2.6em tall, at least 6em wide.
- **Portrait:** full width in a column, with padding 0.35em 0.5em.

Tavern used fixed sizes of 7, 11 and 18 px. It now uses `--buy-unit`; at 1280×720 the label is 12.8 px and the value 18.4 px.

### Bets and prices — ⚠️ (pending client confirmation)

The client sent only the range KRW 200–200,000. A permitted ladder was not sent. On the user's instruction (20 November 2026), Tavern uses the reference USD step pattern ($0.01–$10.00) scaled by 20,000:

`200, 400, 1000, 2000, 4000, 8000, 12000, 16000, 20000, 24000, 28000, 32000, 36000, 40000, 60000, 80000, 100000, 120000, 140000, 160000, 180000, 200000`

- **Default bet:** ₩20,000, matching the reference default of $1.00.
- **Prices:** Normal 1×, Extra 3×, Super 6×, Tavern Buy 125×, Drop Buy 300×.
- **Round cap:** 10,000× the original base bet.
- **Mock wallet:** starts at ₩10,000,000.
- **Where the values live:** `game.config.json`. The proposal backend no longer hard-codes its own ladder. Rule tests use their own small fixed amounts.
- **Before production:** A and the math specialist still need to confirm the ladder and the rounding rules.

On the portrait buy screen, the card list keeps `padding-bottom: 7.5em`, as the reference `.buy-cards-rows.portrait` does. The last card's BUY button can therefore scroll above the bottom panel.

### HUD position — ✅ (base structure ❌)

- The reference `.game-wrap` uses flex `justify-content: center` around `.desktop-panel-wrap`, which holds the Buy button and the main panel. Tavern now centres the HUD on the viewport.
  - Previously it was anchored to the reel frame's right edge, and shifted to `left: 48%` below 670 px.
  - Measured left/right gaps are equal at 1480×1660, 1920×900, 1280×720, 700×500 and 844×390.
- The HUD font unit already matches the reference `.game-wrap` formula: 12 px, limited by `h × 12 / 500` and `w × 12 / 1040`.

## Research notes for the HUD rebuild (not yet implemented)

These notes come from the bundle and are prepared for tasks 10–12. The generated files `src/games/tavern/hud.reference.css` and `src/games/tavern/hud-icons.ts` are committed but **not imported yet**.

### Component map

| Component | Reference id | Scoped class |
| --- | --- | --- |
| menu | `mu` | `s-menu` |
| balance | `Mh` | `s-balance` |
| win | `gu` | `s-win` |
| bet indicator | `Dv` | `s-bet-indicator` |
| bet up | `Fv` | `s-bet-up` |
| bet down | `Vv` | `s-bet-down` |
| spin | `n2` | `s-spin` |
| autoplay | `s2` | `s-autoplay` |
| turbo | `_u` | `s-turbo` |
| buy | `t2` | `s-buy` |
| bonus info (TOTAL WIN + FREE SPINS) | `Wf` | `s-bonus-info` |
| skip bonus | `i2` | `s-skip-bonus` |
| static bet (feature) | `zf` | `s-bet-static` |

Panels use `s-panel-desktop` and `s-panel-portrait`. The game wrap uses `s-game-wrap`.

### Structure

- **Desktop/landscape base:** `[buy] main-panel[ texts[menu, balance, win] + bet-controls[ bet-indicator[indicator, up/down], bet-button[spin, (autoplay, turbo)] ] ]`. The panel has `min-width: 60em`, height `6.5em`, and gap `1em` to the Buy button.
- **Desktop bonus:** `texts[menu, balance, bet, win] + info-panel[bonus info, (skip bonus, turbo)]`. There is no Spin or Autoplay button in the feature.
- **Portrait base:**
  - Top row: `panel-container-portrait[menu, (autoplay, spin, turbo), buy]`.
  - Below it: `info-bar[balance, bet(down, indicator, up), win]`.
- **Portrait bonus:** `bonus-panel[menu, bonus info, (skip bonus, turbo)]` plus `info-bar.bonus[balance, bet, win]`.

### States

- **Spin:** states are default, preAutoSpin, autoSpinActive and disabled.
  - Disabled when a bet is active without autoplay, when the bet is above the balance, or when the UI is hidden. Disabled style is `pointer-events: none; color: dimgrey`.
  - On hover the icon turns `--game-theme-color` (#41e1fb).
  - A +10 button adds autoplay spins.
  - Holding Space for 400 ms enables turbo. A spin is ignored for 500 ms after the UI becomes visible again.
- **Bet up/down:** swap to a disabled template while a bet is active or at the limit.
- **Autoplay:**
  - Disabled while a bet or autoplay is active.
  - Options are ∞, 10, 25, 50, 100, 250, 500 and 1000 rounds.
- **Buy:**
  - The button is 6.5 em at font size 1.25 em, with an outline of 0.3 em offset by −0.5 em.
  - Hover adds a glow. Disabled sets opacity 0.8.
  - The label reads "DISABLE" when the bet mode is not base.
- Every click emits `playButtonClick`.

### Buy screen and confirm

- The buy screen is portrait when `h > w && w < 768`.
- **Buy screen font:** portrait uses `min(16, w/20)`; otherwise `min(16, w/58, h/22.5)`.
- **Cards:**
  - Clicking a card selects it, changes its button to CONFIRM and opens the confirm popup. Confirming emits `betConfirm`.
  - A card is disabled when the balance is below its cost.
  - Hovering lifts the card with `translateY(-8px)`. Esc closes the screen.
- **Confirm popup font:** `max(9, min(16, w/26, h/26))`. Long amounts (more than 8 characters) shrink.

## Remaining gaps and next steps

1. **HUD rebuild (tasks 10, 12):** the free-spin HUD and the buy-screen bottom panel are done. Still to rebuild: the normal HUD, the buy cards and the confirm popup, from the structure and `hud.reference.css` above. Keep the existing ids (`#spin`, `#bet-picker`, `#bet-up`, `#bet-down`, `#buy`, `#auto`, `#speed`, `#balance`, `#win-value`, `#feature-total`, `#free-spins`, `#menu`, `#auto-add`) and the game logic. On 1380×172 the HUD still looks different from the reference.
2. **Space during a round:** the reference skips the presentation (`ge.skip`) and plays a flash. Turbo values are then used and the result wait drops to 20 + 90 ms. Tavern does not do this yet.
3. **Free-spin timing:**
   - The reference waits 300 + 150 ms (turbo 50 ms) between exit and reveal, and 450 / 200 ms after the reveal. Tavern uses the base values.
   - `bonusExit` waits 1200 / 600 ms and `finalBoardWin` waits 900 ms. These are not yet checked against `feature.endDelayMs` (2000 ms).
4. **Portrait background:** port the centred cover camera to portrait as well (reference `4_mobile` track).
5. **Tall desktop (for example 800×1200):** the board is small and the logo and mascot are cut. Compare with the reference before changing anything.
6. **Push:** the session that made these commits could not push. Run `git push origin main` from your own machine. Pushing to the release repository or the client GitLab still needs an explicit request.

## Prompt to resume

> Pull repo GitHub chính `phuocthan/TarvernDropTPT`, nhánh `main`. Đọc `AGENTS.md` và `docs/reference-v13-parity.md`. Dựa vào bundle gốc v13 (`.runtime/index-Btp6donA.js`, `.runtime/index-JDgoUbSF.css`; nếu thiếu thì tải lại từ demo), làm lại HUD theo mục "Research notes for the HUD rebuild": màn hình normal, freespin, buy bonus và confirm buy (vị trí, size, hover, press, disable). Giữ các id và logic hiện tại, dùng `hud.reference.css` và `hud-icons.ts`. Sau đó xử lý các mục còn lại trong "Remaining gaps". Kiểm tra trên desktop, landscape và portrait rồi commit. Chỉ push sang repo release hoặc GitLab client khi tôi chỉ rõ đích và phạm vi.
