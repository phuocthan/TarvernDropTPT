# Tavern Drop reference: HAR analysis

Captured on 17 November 2026. This describes one demo Drop Bonus purchase from a user-supplied HAR, not a complete API specification. Session identifiers and tokens are deliberately excluded. Amounts and event values below are reproduced for this captured demo round only.

## Captured calls

| Call | Observation |
| --- | --- |
| `POST /wallet/play` | One request with `mode: "SUPER"`, `currency: "USD"` and `amount: 1000000`. It returns the complete paid round: base board, feature entry, all 10 free-spin boards, wins and final chest multipliers in an ordered `round.state` event array. |
| `POST /wallet/end-round` | Called about 43.8 seconds after play; response returns the post-settlement balance. |
| `POST /wallet/balance` | Eighteen subsequent polls return the same post-settlement balance. |

No individual free-spin request is present in this capture. The client receives the complete feature result before presenting its animation. No login, initial balance, interrupted-round resume or retry is captured, so this file alone cannot establish how those flows work.

## Events and chest calculation

The play response includes `round.active: true`, a round-level `payout` of `701900000`, `payoutMultiplier: 701.9`, and 26 indexed events. In order:

1. `reveal` gives the initial 25-symbol board; `boardWin` reports 1.9 across six line wins; `totalWin` reports 1.9.
2. `bonusEnter` reports `bonusType: "super"`, `freeSpinCount: 10`, and four trigger positions.
3. Ten `bonusReveal` events each contain a 25-symbol board and `freeSpinsRemaining`, decreasing from 9 to 0. Winning boards are followed by `boardWin` events. Their reported wins are 2.2, 0.4, 0.6 and 2.4, totaling 5.6. `totalWin` events during the feature progress through 4.1, 4.5, 5.1 and 7.5; in this example that running total includes the initial 1.9.
4. `finalBoardWin` reports `baseWin: 5.6`, `multipliers: [5, 5, 5, 1, 1]` and `finalWin: 700`. Thus `5.6 × 5 × 5 × 5 = 700`; multipliers of 1 are identity values. `bonusExit.totalWin` is 700 and `finalWin.finalWin` is 701.9, i.e. initial 1.9 plus feature 700.

Each board-win item reports `paylineId`, `symbol`, `oak` (its exact name is from the response) and `finalWinAmount`. The captured `state` has no explicit per-spin chest-progress, key-position or chest-activation event: chest progress is not directly visible as a response field here. The client could derive progress from boards, line definitions and wins, but that is an inference; the capture alone does not establish the exact calculation, persisted representation or resume behavior. The final multiplier array supplies a per-reel result, but a multiplier of 1 should not by itself be treated as authoritative proof of locked status without the agreed rules.

## Balance and timing

The play response's balance is `9699100000`; the end-round response returns `10401000000`. Their difference is `701900000`, exactly equal to `round.payout`. In this captured round the whole payout, including the initial board win, is credited between play and end-round. The play response already contains the complete outcome and a balance, but the capture has no intervening balance calls during the free-spin animation and does not prove the exact server-side instant when the ledger changes.

The initial balance before `/wallet/play` is absent. The request's `amount` is `1000000`, while the response's payout divided by that amount is 701.9, matching `payoutMultiplier`. The event figures are compatible with 1.9 + 700 = 701.9 times that base amount. The HAR alone does not establish the display/currency scale or the charged purchase cost; do not interpret `amount: 1000000` as the actual bonus purchase debit. A separate prior visual observation recorded a $300 Drop buy at $1 base bet, but this capture has no pre-play balance to independently verify that charge.

## Integration implications

- Keep a stable round identifier, authoritative debit, base bet, payout and resulting balance distinct. Do not credit the base win a second time when the complete round payout has already been settled.
- A full-round ordered event response is an observed option, while one request per free spin is a different proposed architecture; choose one with the customer instead of assuming they are equivalent. For full-round delivery, include replay/resume semantics and a durable settlement receipt.
- Include explicit per-reel key positions or ordered key/chest events in our proposed contract when convenient. This is a design recommendation for robust resume and animation, not a field observed in the reference HAR.
- The reference's `finalBoardWin` makes the unmultiplied feature total, per-reel multipliers and final feature total explicit. Our contract should retain those fields and the actual credited amount.
- A normal spin, an intermediate interruption/resume, no-chest result, retrigger, cap, duplicate request and errors were not captured; collect additional fixtures before claiming those behaviors match the original.
