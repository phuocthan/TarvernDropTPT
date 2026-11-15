# Tavern Drop: reference audit and implementation map

> This audit records the initial mock build. See the [Tavern Drop reference walkthrough](tavern-drop-reference.md) for the subsequent Help review, play observations and comparison against the current client.

## Evidence and limits

Reference URL: https://paperclipgaming.com/ko/games/tavern-drop

The original website, demo, Help and assets have **not been observed** in this environment. HTTPS CONNECT returns a proxy 403 before the origin is reached. Runtime environment status still shows no custom allowed hosts; the saved draft domain grants have not been applied. There is no callable shared-browser tool. No claim below is a finding from playing the original game. No original asset has been downloaded.

The requirements below come from the user's supplied first-game scope. They establish the target behavior, not the original game's precise rules. The implementation is a reusable technical foundation with a provisional Tavern skin. Visual fidelity and reference-rule compliance remain unverified. Do not use this document to lock a quotation or final math.

## Required screen/state inventory

| State family     | Required state                                             | Trigger and transition                                 | Template status                                        | Reference evidence |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------ |
| Boot             | Loading → logo/mascot → ready                              | Asset readiness and session response                   | Loading/session implemented; mascot/Spine pending      | Not captured       |
| Base             | Idle and bet selection                                     | Select supported bet; update cost display              | Implemented                                            | Not captured       |
| Base             | Spin pending                                               | Commit one request; lock bet and purchase inputs       | Implemented, idempotent request ID                     | Not captured       |
| Reels            | Movement, staggered stop, quick stop                       | Present server board; skip affects timing              | Implemented; timing provisional                        | Not captured       |
| Results          | Losing / one line / multiple lines                         | Highlight positions and paths; count displayed win     | Implemented with testable fixtures                     | Not captured       |
| Feature choice   | Tavern buy / Drop buy                                      | Pick feature → confirm exact demo debit → server entry | Implemented                                            | Not captured       |
| Chance           | Standard / Extra / Super                                   | Select option; display provisional price factor        | Implemented with demo server distribution              | Not captured       |
| Bonus entry      | Natural Tavern / natural Drop                              | Entry returned by server; stop autoplay; entry modal   | Implemented with provisional triggers                  | Not captured       |
| Bonus            | Distinct mode / free-spin remaining / played / accumulated | Feature snapshot supplied by server                    | Implemented; both currently share collection mechanic  | Not captured       |
| Retrigger        | Add spins and feedback                                     | Server grants bounded additional spins                 | Implemented; presentation is a status message          | Not captured       |
| Collection       | Tokens fly from winning positions to matching reel         | Unique row positions supplied by server                | Implemented with duplicate protection                  | Not captured       |
| Chest            | Partial / full / unlocked / reveal                         | Five unique rows unlock; reveal at completion          | Implemented with placeholder drawing                   | Not captured       |
| Bonus completion | Product of chest multipliers / accumulated / final award   | Server settles once; client shows confirmed amounts    | Implemented with modal and reveal                      | Not captured       |
| Celebration      | Big / Mega / Epic / Max                                    | Tier and cap thresholds approved by math               | Big/Mega/Epic status labels only; cap completion modal | Not captured       |
| Automation       | Autoplay selection / stop / turbo / skip                   | Timing independent of settled outcomes                 | Implemented; stop on feature, completion and errors    | Not captured       |
| Audio            | Sound/mute and sound unlock                                | User gesture unlocks browser audio                     | Procedural placeholder cues only                       | Not captured       |
| Menu             | Settings / rules / paytable                                | Modal navigation without placing a spin                | Basic menu and provisional rules implemented           | Not captured       |
| Connectivity     | Pending / retry / reload recovery                          | Retry exact request; version protects stale commands   | Implemented within the same live mock session          | Not captured       |
| Purchase         | Confirmation / insufficient balance                        | Server validates balance and action                    | Implemented                                            | Not captured       |
| Layout           | Landscape / portrait / safe controls                       | Fit canvas and readable controls                       | Desktop and 390px mobile browser checks                | Not captured       |

## Decisions that must come from reference Help or math

| Rule boundary           | Required confirmation                                                       | Current explicit development assumption                                       |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Paylines                | Exact 15 paths; payment direction; simultaneous wins                        | 15 illustrative paths, left-to-right, best substitution once per line         |
| Symbol set              | Actual 11 symbols, pays, Wild exclusions and all-Wild behavior              | 5 royals, 4 premiums, Wild, Bonus; best paying substitution                   |
| Bonus entry             | Trigger count and distinction between Tavern and Drop                       | 3 Bonus symbols → Tavern; 4+ → Drop                                           |
| Feature mechanics       | Whether Drop has additional drops, transformations or chest conditions      | Both modes share unique-row collection; no unsupported drop mechanic invented |
| Free spins              | Initial counts, retrigger condition, award and maximum                      | Tavern 8 / Drop 10, +3 on 3 Bonus, 40 spins overall maximum                   |
| Collection timing       | First spin eligibility; all wins vs selected line; pre/post transformations | Union of all line-winning positions during feature spins                      |
| Chest availability      | Whether same rules apply in both features; unavailable chest award          | All reels collect, locked chest uses identity multiplier 1                    |
| Multiplier distribution | Values, probability, when determined and reveal order                       | Uniform demo choice of 2, 3, 5 at completion                                  |
| Feature accounting      | Base trigger spin, multiplier application, rounding, buy accounting         | Base paid separately; feature multiplied at completion; integer minor units   |
| Maximum win             | Exact cap across paid round, termination timing, buy bet basis              | 5000× base bet including base award; stop when raw feature total reaches cap  |
| Bonus prices            | Mode prices, eligibility with chance options, balance rules                 | Tavern 50× / Drop 100× base bet, explicitly confirmed                         |
| Chance options          | Costs, activation boundaries and actual math changes                        | Costs 1× / 2× / 5×; per-cell Bonus probability .03 / .05 / .07 in demo only   |
| Win tiers               | Thresholds and whether based on bet, paid cost or round total               | Status thresholds 10× / 25× / 50× base bet; final cap separate                |
| Interrupted round       | Server history, replay and reconnect semantics                              | Idempotency in process memory; restart resets demo sessions                   |
| Artwork                 | Asset list, Spine versions, animations, fonts and rights                    | Original code-drawn placeholders; no supplied or copied art                   |

All values are centralized in `src/games/tavern/definition.ts` and labeled provisional. Probability estimation from repeated demo plays is not a substitute for an approved math specification.

## Capture procedure when reference access is available

1. Record the launch URL, device dimensions, locale and game/build identifier. Capture loading, all Help/paytable pages and every rule statement before selecting implementation values.
2. Map symbol IDs, the precise 15 line paths, wins with Wild prefixes and all-Wild lines. Capture no-win, one-line and multi-line examples.
3. Capture the complete purchase flow for both buys, including price changes with bet/chance settings, cancellation and insufficient balance. Record both chance activation paths and how they affect the displayed spin cost.
4. Play repeated base rounds to observe natural entry; use demo buys to inspect each feature. Record full start-to-end sequences with free-spin counts, retriggers, accumulated amount and mode transitions.
5. Track every winning cell and per-reel row set in each free spin. Compare repeated positions, full chests, collection animation timing and the exact moment multipliers are determined/revealed.
6. Reconcile base win + accumulated feature wins × product against the final credited amount. Verify cap behavior from authoritative rules or a deterministic provider fixture; ordinary random plays cannot reliably establish the cap.
7. Inventory animation clips, Spine version/skins, audio, texture atlases, layers and responsive layout. Use supplied/licensed assets for delivery. Keep downloaded reference material separate from redistributable assets.
8. Add each observation with screenshot/video filename, timestamp, source Help page, confidence and corresponding fixture. Keep unresolved differences explicit.

## Acceptance gate

“Matches Tavern Drop” is not an accepted status until reference captures and Help are available, the rule matrix is resolved, both bonus modes have independent fixtures, and artwork/animation review has been completed. Current automated tests demonstrate template behavior and demo accounting only.
