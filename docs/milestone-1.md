# Milestone 1 — Reusable Core, Asset Verification & First Runnable Build

| Item | Detail |
| --- | --- |
| Price | $900 |
| Planned kickoff | 17 November 2026, after scope agreement. The client confirmed funding. |
| Target delivery | 23 November 2026 |
| Acceptance | The client reviews the deliverables against the checklist below. The target date does not trigger automatic payment. |

## Deliverables and acceptance

| Deliverable | What to review |
| --- | --- |
| Reference checklist | Confirm each screen, state, control, animation and asset in the inventory below. Approve which effects are authored in Spine and which are driven by code. |
| Asset verification | Review [asset specifications and validation](milestone-1-asset-spec.md). Required files in the approved asset pack must load or play with the target runtime. Review playback evidence and close any required-asset blockers before acceptance. |
| Initial asset specifications | Supply the [initial specification](milestone-1-asset-spec.md) within 1–2 business days of kickoff. A 17 November kickoff puts the target window at 18–19 November, subject to working days. |
| Reusable core | Inspect TypeScript/PixiJS modules for config and schema, loading/assets, Normal and Drop reels, controls, audio, HTTP transport and session/recovery. Both demos use the same session and reel renderer. See the [current mock contract](milestone-1-api.md). |
| 3 × 3 example | Open `/?game=reuse`, start a mock spin and verify the board, paylines and separate wallet. The example demonstrates reuse and has no separate commercial scope. |
| First runnable build | Open `/`, press **Spin** and verify that the 5 × 5 Drop board settles, the result is visible and the mock wallet updates. Temporary art and mock outcomes are within scope. The full game is a later deliverable. |
| Source and build steps | Clone the milestone snapshot and run `npm ci`, `npm run build`, `npm start` and `npm test`. The public delivery candidate is in the GitHub release repository. The original client GitLab review location still needs its project URL and access. |

The production preview was opened in Chromium with a fresh mock wallet on each route. A test spin settled on both boards and updated each balance. See the [5 × 5 Drop capture](milestone-1-evidence/5x5-drop.jpg) and the [3 × 3 Normal capture](milestone-1-evidence/3x3-normal.jpg).

## Reference inventory for client review

| Screen or state | Controls and outcome | Asset or implementation |
| --- | --- | --- |
| Loading and welcome | Progress, ready state, Press to Continue | Approved brand mark, background, feature cards, dimmer, loader states |
| Base game | Balance, bet, min–max indicator, spin/skip, feature buy, Turbo, layout on desktop and portrait | Backdrop, mascot, reelhouse, symbol atlases, UI icons, font and base music |
| Help, bet, autoplay and purchase confirmation | Open/close menus, change bet, select rounds, confirm/cancel a purchase | Rules/paytable copy and icons. Responsive controls, focus and value feedback use code. |
| Drop and Normal reels | Base and Turbo timing, per-reel stops, Scatter anticipation, wins | Symbol Spine states `spin`, `land`, `idle` and `win`. Code schedules reel stops and positions the win dimmer and paylines. |
| Tavern Bonus and Drop Bonus | Three/Four Scatters, entry, free spins, retrigger, return to base | Bonus background and reelhouse transitions, entry/outro art, keys, chests, win effects and bonus music |
| Bonus completion with unlocked chests | Zoom, sequential reveal, multiplier transfer, running award and win tiers | Authored reelhouse/chest and win tier clips. Code positions the camera, transfers multiplier labels and counts the displayed award. |
| Bonus completion with zero unlocked chests | Board exits, Total Win and Continue | Bonus exit and Total Win Spine clips, win font and intro/outro cues |
| Recovery and fallback | Failed asset or API load, retry of a saved command, session expiry | Error text, temporary visuals and mock API status. Production persistence is a separate decision. |

At kickoff, confirm the brand owner, logo variants, minimum clear space, splash copy, legal text, colors and typography. Supply branding before replacing the temporary public-preview skin. Confirm the approved asset package and any distribution terms before publishing that package to the client repository.

## Review and sign-off

Record the reviewed commit, client reviewer and review date. Track corrections against the table above and record the approved asset pack.
