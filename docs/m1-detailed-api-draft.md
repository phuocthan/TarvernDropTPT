# Tavern Drop · Detailed FE–BE API draft for Team A

Review revision **`than-m1-krw-review-1`**. This document and its [four mock sequences](m1-api-review-sequences.json) use the current local v1 mock vocabulary so Team A can compare request and response fields. The examples are scripted review fixtures. The client GitLab seed’s `player-draft-v2` examples remain a separate proposal. Final Kai math and the production API require joint approval.

## What is ready for review

| Sequence | What the fixture proves about the proposed exchange | Starting wallet and reconciliation |
| --- | --- | --- |
| 01 · Normal win and loss | A normal spin requires one paid request. A positive win and a zero-win round both reach a terminal BE state. On return after interruption, show the stored result without reel or win replay. BE explicitly returns when Spin can be enabled. | ₩1,000,000 → ₩999,500 after a ₩1,000 bet and ₩500 win → ₩998,500 after a ₩1,000 loss. |
| 02 · Lost paid response | The reply is lost after debit. A fresh session for the same user finds the original round with `game-info`. Exact retry under the fresh session gets the original stored result. Changing amount or mode with the consumed token returns 409. | Extra ×3 charges ₩3,000 against a ₩1,000 base. Final return ₩500. Balance ₩997,500. |
| 03 · Interrupted feature and two tabs | Base lines pay ₩200 + ₩300. Scatter positions trigger Drop separately. The first free spin is recovered as a stored result with counters, keys and retrigger. Two tabs confirm that spin and later the same chest without advancing twice. Chest outcomes appear in order and a resumed chest starts from the last confirmed display total. | ₩1,000,000 − ₩1,000 charge + ₩30,500 final return = ₩1,029,500. There is no credit during the feature. |
| 04 · 30-day expiry and dismissal | A read before expiry does not extend the deadline. A server event closes the round without a client ACK. An uncertain wallet result hides the final amount and holds the wager gate. Confirmation allows only the final Total Win. Dismissal and its retry return one receipt/unlock result. | Drop Buy ×300 charges ₩300,000 for a ₩1,000 base. Cap is ₩10,000,000. Confirmed balance is ₩760,400 after a ₩60,400 award. |

The file includes request method, path, headers, JSON body, HTTP status and JSON response, plus labels for player actions and backend-owned expiry/reconciliation events. `response.receivedByFE: false` marks a lost reply in the transcript and is outside the response body. Header values and account IDs are synthetic placeholders. Reproduce and validate the bundle with:

```sh
node tools/m1-api-review-sequences.mjs
```

The generator takes symbol/payline geometry from the [22 existing local v1 examples](milestone-1-v1-examples.json). It checks JSON money, positions, counters, settlement amounts and retry/recovery examples. It does not simulate production wallet concurrency. For the runnable local mock, see [v1 run instructions](backend-localhost-v1.md). The local endpoint still expects numeric money and offers older pricing. Feed these new fixtures to an adapter only after agreeing the revision.

## Proposed wire contract

Clean POST URLs under `/api/v1`. All requests include `gameCode` in the JSON body; all requests except login use `Session-Id` and `Authorization: Bearer <token>`. This mirrors the runnable mock. Team A can instead use trusted launch identity and cookie/session scoping from the v2 seed. Keep route/auth details in the adapter.

| Operation | Frontend sends | Backend response and ownership |
| --- | --- | --- |
| `POST /login` | Local review: `gameCode` and synthetic `userId`. Production: agreed launch proof. | Session for the authorized account/game. A rebinds reconnect to the same account. Fresh session credentials leave paid and step receipts unchanged. |
| `POST /game-info` | `gameCode` | Currency, bet range, current settings, versioned config, `wallet`, `canStartPaidRound`, entitlement when ready, prepared resume state when applicable. During an active round, use its pinned config. |
| `POST /spin`, paid | `isFreespin: 0`, `betMinor` string, `chanceMode`, current server-issued `Play-Token` header | A validates amount/mode, persists the accepted intent, charges once and freezes the outcome. Returns recorded result or bonus entry, original base, charged amount, payout state and gate. A finalizes a no-bonus round without a per-normal-spin completion call. |
| `POST /buy-feature` | `betMinor` string, `featureMode`, current `Play-Token` | Same paid admission rules. First step is bonus intro. Charge uses the buy mode’s price; cap uses original base bet. |
| `POST /spin`, checkpoint | `isFreespin: 1`, last released `stepId`, its `curStep`, optional `kind: "shown_as_result"` for static recovery | Confirm the presented step and release the next one in one acknowledgement. A handles final settlement server-side. Feature steps carry no new bet. |
| `POST /spin`, dismiss expiry summary | `isFreespin: 0`, `curStep: "final-summary"` and `summaryId` | Record dismissal once and update bet permission. Repeated dismissal returns the same receipt. The examples use this v1 shape. A may choose the v2 equivalent in the final contract. |

All example responses use `contractVersion`. Success uses `code: 0`. HTTP 409 with `REQUEST_CONFLICT` is the local-vocabulary proposal for a consumed token and changed semantic payload. For ambiguous transport failure, continue to recover the original intent. A defines retry intervals, the production rejection/error catalog and when proof of terminal rejection permits a fresh wager. A may expose read-only status/lookup through separate v2 routes. The four sequences use `game-info` for reconnect/status reads; they require no standalone normal-completion or progress endpoint.

### Money, payout and display

| Field | Meaning |
| --- | --- |
| `currency: "KRW"`, `currencyExponent: 0` | Canonical unsigned decimal strings for money, with `"0"` for a known zero. UI uses won, thousands separators and zero decimals. State, indices and dimensionless multipliers retain their numeric types. |
| `betMinor` / `originalBaseBetMinor` | Requested / recorded underlying bet. Range ₩200–₩200,000. Range is not a permitted bet ladder. A/math supply allowed steps and rounding before implementation. |
| `chargedMinor` | Actual entry charge. Normal/Extra/Super use ×1/×3/×6. Tavern/Drop Buy use ×125/×300. A supplies the authorized quote. |
| `roundCapMinor` | 10,000 × original base, even for buys or retriggers. A applies the cap and provides each displayed amount. |
| `winLines[].win_amt` / `totalwin_amt` | Amount from each payline and the step’s spin win. Scatter/Bonus is a trigger here. `bonusEntry.triggerPositions` or `retriggerPositions` are separate proposed fields. The client never infers a cash Scatter award from the board. |
| `freegame.totalWinMinor` / `displayWinAfterMinor` | Current cumulative presentation win, including the base win in these examples, and the server-provided total after the current chest. FE interpolates towards that target. |
| `finalRoundAwardMinor` / `settlement.creditedMinor` | Recorded gross award when authorized for display, and the credit amount confirmed by the settlement receipt. `null` means unknown or withheld. `"0"` means a known amount of zero. |
| `wallet.confirmedBalanceMinor` / `wallet.confirmedAt` / `walletVersion` | Confirmed balance, timestamp of confirmation and monotonic version. Read/poll time does not change `confirmedAt`. FE ignores older wallet versions. Field names and timestamp source are for A to confirm. |
| `canStartPaidRound` | Authority for a new wager in this game. FE also waits for the current local presentation to finish. A enforces its own gate on every new paid intent. |

Canonical amounts match `^(0|[1-9][0-9]*)$`, with no decimal separator, signs or grouping in the payload. Normalize incoming amounts at the adapter boundary. Preserve exact amounts as strings or integer arithmetic. If existing fw-pixi domain numbers remain in use during transition, range-check any conversion before formatting or playback.

### Presentation, recovery and disclosure

- `roundId` identifies the accepted paid round and is generated by A. `Play-Token` identifies one attempt to place a paid bet in this proposal. It is server-issued before the request and bound to account/game. Recover accepted intents using the original token/body or A’s approved lookup. Auth credentials can change after login. A fingerprints route, game, mode and bet, and persists the wager receipt before replying. Old tokens never start a new round.
- `releasedThrough` is the last ordinal the server made available. `presentedThrough` is the last ordinal FE has confirmed, bounded by released progress. A local normal-spin completion is a server-defined closure and is not proof FE played animation. `stepId` and `summaryId` are opaque IDs issued by A.
- `intro` → `freespin` → optional `show-chest` and ordered `open-chest` → `free-end`. Send a checkpoint once at the end of each intro, each free spin, the chest summary, each opened chest and final Total Win. One paid request per round. No per-frame calls. `Skip` or `Turbo` affects animation duration; it keeps the same step identity and award.
- For an interrupted released free spin, show its after-result reels, counters, keys, retrigger and total. Then confirm that step and continue. If the next spin has not been released, present it as a normal free spin after release. An unseen intro returns at the intro; agree with A which indicators distinguish intro still pending from one already completed.
- A chest checkpoint is reached only after its animation and updated displayed amount finish. On reconnect, show the last confirmed chest snapshot and continue the first unconfirmed reveal from its start. The current chest is the only newly disclosed multiplier. Open All, if approved, speeds up permitted playback while preserving this release order.
- Atomic confirmation is keyed by actor, round and step. Proposed equivalence for the two-tab fixture: ordinary presentation ACK and `shown_as_result` complete the same step. A emits the same next step exactly once. The local v1 currently fingerprints `kind` and would produce a conflict in the mixed case. If A chooses different semantics, return the authoritative cursor and let FE reconcile. Never advance twice or roll back to an older projection.
- During the feature, FE displays running win separately from the last confirmed wallet. A owns settlement and records one final award for the round. Receive only the released prefix. Never disclose later chest events through a balance or final amount that reveals them. During uncertain expiry payment, final award and credited amount are null, the final summary is withheld, and Spin stays disabled. On confirmed payment show only final Total Win after expiry. Dismissal unlocks the next wager. Keep payout state in the API and player copy neutral.
- A persists a 30-day deadline after genuine activity. Game-info/status reads and duplicate requests do not move it. The server closes and settles from recorded outcome even if the browser never reconnects. A defines which activities count, how admission races against expiry, recovery after lost credit reply and how deterministic retry receipts interact with a newer view.

### Symbol and payline projection

The existing numeric config supplies `cols`, `rows`, `symbolIds`, `paylines` and `configId`. Tavern’s review mapping uses Wild `1` and Scatter `11`. `reels` is row-major of length `cols × rows`. A wire cell position `p` is 1-based; FE reads `reels[p - 1]`. With zero-based row/column, `p = row × cols + column + 1`. Ordinary paylines use fixed 1-based `lineId`; `winSym` contains only positions that paid. A feature trigger has coordinates without any cash win entry. Pin config ID or equivalent immutable mapping in the round for correct decoding after deploy and reconnect.

## Mapping that Team A needs to approve

| Topic | Existing v1 and this review | Client seed v2 and remaining decision |
| --- | --- | --- |
| Launch and route scope | Clean POST paths, gameCode with session headers in v1. | `/player/v2/session` launch exchange and server-scoped identity. Decide auth, selector fields and endpoint family. |
| Paid identity | Server-issued Play-Token + unchanged payload; paid intent retained across sessions. | v2 uses `requestId` and `modeId`/`baseBetMinor` with possible `termsVersion`. Agree whether the token can be used as the intent ID, or whether both are represented. Confirm quote pinning, conflicts and lookup. |
| Recovery and progression | Game-info and `stepId` ACK through `/spin`. Draft includes `canStartPaidRound` and expiry summary. | v2 request/round lookup and proposed revision advance. Map released prefix and actual presentation checkpoint, including stale/mixed ACK, expiry lock and summary dismissal. |
| Board and events | Numeric symbols, flattened row-major, 1-based positions/line IDs. | Seed named symbols, zero-based `[row,column]` and recorded events. Map in adapter with pinned version. Verify Scatter trigger and payline geometry; v2 fixture shapes alone are not approval. |
| Money and disclosure | Whole-won strings, agreed KRW range/factors/cap, proposed confirmation timestamp. | v2 example currency is synthetic TST with exponent 2. Preserve original 22 fixtures. Agree new KRW version and which fields are held until released/confirmed; do not relabel TST values. |
| Wallet and expiry | Local demo settles synchronously and supports automatic expiry/dismiss. Review fixtures add unresolved wallet state. | A supplies authoritative admission, locking, durable settlement/reconciliation, genuine activity and timestamps. Approve exact meanings of `pending`, `uncertain` and terminal zero payout. |

The local mock already covers durable requests, released outcomes, step receipts and automatic expiry in a single process. Remaining changes include string-money decode, configuration range/prices, confirmed timestamp, mixed ACK behavior, asynchronous payment and FE use of the wager gate. FE needs explicit static normal-result presentation and neutral waiting/error states. Keep reusable rendering, timing, storage and data mapping in **fw-pixi**. Tavern skins, art and bonus presentation belong in the game layer. Implement the public mapping after Team A agrees the version.

## Delivery order

1. The designated delivery repo is [slot-client on GitLab](https://gitlab.com/game-studio9172445/slot-client). The [GitHub staging package](https://github.com/phuocthan/DropTarvernRelease/tree/main/korRelease/slot-client-main) contains scoped client additions and an intact seed copy. A copy on GitHub does not establish GitLab commit ancestry or create a merge request.
2. Verify access in a separate GitLab clone. Read the actual GitLab README, AGENTS and DEVELOPMENT at the approved commit, then verify `880a75e406d3a28c03dfa39b3ead93d1a4b4a13b` and create `feat/than-m1-client-core` from it. If that branch already exists on GitLab, verify its base and continue it without overwriting history.
3. Apply only the reviewed scoped additions under `apps/player-web/than/`, `games/slot-001/client/than/` and the relevant review docs/contracts. Preserve the original seed. Use the committed dependency lockfile, explicit asset allowlist, notices and separate mock/production builds. Verify the first runnable 5×5 and 3×3 on the same core, record build and asset evidence, then push feature-branch increments and open a **Draft MR targeting main**. Team A and the client review; main remains protected.
4. Review the API draft and four traces with A in the existing API thread. Pin the approved revision and the example hashes in GitLab before wiring the authenticated adapter. Use test fixtures for implementation and regression checks. The GitLab repository becomes the only maintained client delivery source.
