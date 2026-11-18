# Client communication record

Saved: 18 November 2026 (Asia/Bangkok). This file records client messages supplied by the user in this chat. Earlier messages do not have verified individual timestamps. No external Slack/email messages were sent by this task.

Read [next-session handoff](handoff-2026-11-19.md) before continuing. The latest client decisions below supersede conflicting historical examples, prices and money formats. All development outcomes remain synthetic; final math and the production wallet contract belong to the client/backend team.

## Milestone 1 agreement supplied by the user

**Reusable Core, Asset Verification & First Runnable Build — $900.** Planned kickoff 17 November 2026 after scope agreement and funding; client later confirmed M1 funded. Target delivery 23 November 2026. Acceptance requires client review and is not automatic payment on the target date.

Deliverables:
- Reference checklist covering screens, states, controls, animations, effects and corresponding assets; identify code-driven effects and when client branding is needed.
- Verify artwork, Spine, texture/atlas, fonts, music and SFX load/play with the intended runtime; supply playback evidence and close required-asset blockers before acceptance.
- Initial asset specifications within 1–2 business days of kickoff.
- TypeScript/PixiJS reusable core: loading/assets, configuration, controls, audio and API/session.
- Small 3×3 configuration on the same core using available assets and synthetic results; not a second commercial game.
- First runnable mock flow; full Tavern completion is not required in M1.
- Runnable source and build instructions for the client's GitLab review. GitLab URL/access remain unprovided in this chat. The user separately authorized a curated GitHub release repository.

## Earlier client message — existing API examples first

> Hi @TPT Mark, welcome! M1 is funded and our backend team (A) is preparing in parallel.
>
> Could you share the existing API/mock-server examples used by your reusable client, so we can agree on the integration contract early? Sanitized JSON files and a short field explanation would be ideal.
>
> Please include what you already have:
>
> - Session/init and spin request/response examples: IDs, mode, base bet, currency/precision, charged amount and win amount, showing which values are requests versus server-confirmed values.
> - A normal win, plus a free-spin/chest/multiplier example or the event structure you expect for them. Please explain symbol IDs, board coordinates, payline IDs, payout units and event order.
> - Resume/status/error examples: interrupted rounds, pending results, reconnect/refresh, and how skip/turbo finishes presentation while preserving the recorded outcome.
> - If available, the mock-server/sample-data files and minimal run instructions.
>
> This is to review your existing format; you do not need to build a separate new demo first. Please send the smallest usable examples first and identify any missing parts and when you expect them.
>
> A will propose the server requirements for money, persistent request/round IDs, duplicate handling and recovery. You can propose the presentation/event needs, and we will agree on one versioned contract together. The server owns outcome/payout decisions; the client plays the recorded result. Final Kai math is still pending, so development examples must be clearly marked synthetic.

## Earlier client decisions — resumable client and single settlement

> **1. Resume is required**
> Please proceed with the resumable approach. Reloading/reconnecting must restore the same round, remaining free spins, accumulated win, and chest/bonus progress, without replaying the entire feature from the scatter trigger.
> We should agree on checkpoints at meaningful game steps. If interrupted during an animation, only that unfinished presentation may replay from an agreed safe boundary; completed free spins must not restart. We do not need server calls for every animation frame.
>
> **2. One final payout, with step-by-step win presentation**
> The client can show each free spin's win and the accumulated win. For our first game, the wallet should receive the final total once per paid round, including the base game, linked free spins/retriggers, and final chest multipliers. We will not credit the wallet separately for every free spin.
> The round-wide maximum remains 10,000 × the original base bet, including bonus buys; it is not 10,000 × the purchase price. The backend supplies authoritative amounts and payment status.
>
> **3. Preserve both the player's winnings and operator correctness**
> The recorded outcome must remain unchanged through reconnect, skip/turbo, duplicate requests, or lost responses. Progress requests must not create another bet or payout.
> Disconnecting or closing the browser must not lose winnings or make payout depend solely on the player returning or sending an animation-complete message. A will define the server settlement/round-close and interrupted-round handling in the API contract. “One final payout” is a settlement-count decision; the exact wallet-credit trigger and balance-display timing must be agreed separately.
> Please keep accumulated feature win and confirmed wallet balance distinct, so the screen does not present a pending amount as credited money.
>
> **4. API next step**
> A already has local synthetic groundwork for durable round/progress recovery and single settlement, but your actual client mapping is not finalized. A owns outcome, wallet and server recovery; you own presentation and client checkpoint behavior.
> Please send the existing mock request/response examples you mentioned: normal spin, bonus progression, resume midway, chest/final result, and completion/payment-status handling. Annotate missing fields instead of rebuilding a separate demo. Please also show how your client distinguishes a step released by the server from an animation actually completed on screen, and your expected request frequency.
> We can agree on one versioned contract with the minimum necessary round trips and verify it together. Please keep the examples in our existing API thread and confirm this direction fits the agreed resumable-client scope.

## Earlier client message — KRW

> Hi Than, thanks for the update. One important requirement for the first game is KRW (Korean won). Please include this in the UI and the BE/API draft you are preparing.
>
> For the UI, show balances, base bets, Chance charges, bonus-buy prices and all win amounts in won, with thousands separators and no decimal places, for example ₩1,000. Please check longer KRW amounts on mobile as well. Keep currency and formatting configurable in the reusable client.
>
> Our current backend development examples use currency = “KRW” and currencyExponent = 0, so betMinor = 1000 means ₩1,000. Please clearly distinguish money amounts from payout multipliers in the draft. The backend supplies the authoritative amounts and balance. A and the math specialist will agree any rounding rules and permitted bet steps with you before final integration.
>
> For the BE document, please send your proposed request/response fields and concrete examples for session/init, spin, bonus/chest progress and mid-round resume, including currency/amount units and payment status. A will review it with you so we agree one versioned API contract. The agreed mid-round resume and single final wallet settlement need to be reflected in the examples. Thanks!

## Latest client message — detailed API decisions and four sequences

> Hi Than, thanks for the proposal and the resume update. The step-by-step flow works for us. Please use it for the detailed API draft, with these decisions and examples for Team A.
>
> 1. Normal spin with no bonus. If the player disconnects after a bet, recover the original round, settle its recorded win exactly once (including closing a zero-win round), and show the final amount on return. No reel or win-animation replay is needed. If payment already succeeded, just display the result. Please show how normal play and this interrupted path finish, and how the client knows it can enable Spin again.
>
> 2. Lost replies and bonus recovery. Keep the same Play-Token and payload on retry. Show how a fresh login finds the original request/round after a debit, how a reused token with a different amount or mode is rejected, and how two tabs confirming the same step advance only once. For an interrupted free spin, restore the released result, counter, keys and cumulative win. For chests, reveal one at a time and confirm each only after its animation and updated total are visible. Open All, if used, can speed up that sequence. The whole paid round pays once at the end.
>
> 3. After 30 days without genuine player activity, the server closes the round automatically. Background polling leaves that deadline unchanged. While the wallet result is uncertain, keep Spin disabled and the final amount hidden. Once payment is confirmed, show only the final Total Win. Dismissing that summary unlocks the next bet in the same game. Please include the close/dismiss request and its retry, and keep bookkeeping labels out of the player UI.
>
> 4. Use the Scatter/Bonus symbol as a feature trigger in our examples. The reference paytable we reviewed shows no separate cash award for landing the symbols. On page 3, if the two line wins are KRW 200 and 300, the base-spin win is KRW 500. Report the bonus entry and trigger positions separately, and add subsequent bonus wins as earned. If you have an in-game rule showing a separate Scatter prize, please share that screen for our M1 math review.
>
> For the wire format, please use whole-won decimal strings and distinguish the original base bet (KRW 200–200,000) from the actual entry charge. The five prices are 1× / 3× / 6× / 125× / 300× for Normal / Extra / Super / Tavern Buy / Drop Buy. The whole-round cap is 10,000× the original base. Please distinguish the current step win, cumulative win, final payout and wallet balance, including when that balance was confirmed. Your row-major, 1-based cell positions work as a client mapping; please identify the symbol/payline configuration version used by the round.
>
> Could you send four mock request/response sequences covering a normal finish (win and loss), a lost response after debit and fresh login, an interrupted free spin/chest with a repeated confirmation, and 30-day expiry through payout and summary dismissal? Our backend team can check those against the stored round and payout. Thanks!

## Latest decisions extracted for implementation

- Money on the wire is decimal **string**, e.g. `"1000"`; whole KRW, exponent 0, no decimal places. Multipliers are dimensionless and must remain distinct from money.
- Original base bet range: ₩200–₩200,000. This does not define a step size; allowed steps and rounding still require agreement with A/math.
- Entry prices: Normal 1×; Extra 3×; Super 6×; Tavern Buy 125×; Drop Buy 300×.
- Whole paid-round cap: 10,000× original base bet, including buys/retriggers/chests.
- Normal interrupted path: settle recorded result once, including zero win; show result only, no reel/win replay; explicit permission to re-enable Spin.
- Retain the same entitlement/payload for retry. Fresh login must recover the recorded round after debit. Changing mode/amount on a consumed token conflicts. Concurrent duplicate step confirmations advance once.
- Feature recovery restores released result, counters, keys and accumulated win. Chest confirmations follow completed animation and updated visible amount. Open All is optional, not a new required button.
- 30-day inactivity closure is server-owned and independent of return/animation ACK. Polling does not extend it. Uncertain payment hides final amount and disables Spin. Confirmed payment shows only final Total Win; dismissal unlocks the same game.
- Scatter triggers bonus without cash payout. Return trigger positions/bonus entry separately from normal line wins; example 200 + 300 = 500 base win.
- Distinguish step win, accumulated win, final payout and confirmed wallet balance, including when the balance was confirmed. Pin round symbol/payline configuration version.
- Deliver a detailed versioned review draft plus four synthetic request/response sequences, not a separate demo. Identify server-released versus actually-presented checkpoints and request frequency. A owns production outcome/wallet/recovery.
