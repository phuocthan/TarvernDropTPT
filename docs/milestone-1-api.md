# M1 synthetic API examples — current local v1

[Concrete request/response JSON](milestone-1-v1-examples.json) is generated from the existing resumable `ProposalBackend`, not a separate demo. All outcomes, money, identities and receipts are synthetic. IDs/tokens are sanitized placeholders. This is a review candidate, not an agreed production contract or final Kai math.

Regenerate with `node --experimental-strip-types tools/m1-api-examples.mjs`.

## Examples provided

The JSON contains session/init, game-info, normal win, duplicate wager, Drop purchase, intro ACK, a free spin, server restart and mid-feature resume, chest summary, mid-chest resume, chest completion, final result, payment status before/after settlement, duplicate final ACK and a structured missing-token error. Intermediate free-spin/chest ACKs are omitted for brevity where explicitly stated.

## Requests versus confirmed values

| Field | Owner and meaning |
| --- | --- |
| `gameCode` | Client selects the game in every JSON body; API URLs have no query parameters. |
| `userId` | Mock test identity only. Production launch authentication belongs to A. |
| `sessionId`, `token` | Server-issued session credentials; sent in headers after login. |
| `Play-Token` | Server-issued entitlement for one paid spin OR bonus buy. Retry identical payload/token. Never invent another token after a lost response. |
| `betMinor` | Client-requested original base bet; server validates it. |
| `chanceMode`, `featureMode` | Client-selected action; server confirms the resulting step/outcome. |
| `chargedMinor` | Server-confirmed charge, including Chance or bonus-buy price. |
| `totalwin_amt`, `winLines[].win_amt` | Authoritative spin money amounts, not multipliers. |
| `freegame.totalWinMinor` | Accumulated presentation amount; not proof of credited wallet balance. |
| `wallet.confirmedBalanceMinor`, `settlement` | Backend-confirmed balance and payment status. FE must not add pending win itself. |
| `roundId`, `stepId`, cursors | Server-owned durable round, released step and acknowledged presentation progress. |
| `curStep` in response | Step BE has released for presentation. Receiving it does not mean its animation is complete. |
| `curStep` + `stepId` in ACK | FE reports the released step has actually been presented. ACK does not place a wager. |
| `reel`, `multiplier` | Chest location and dimensionless multiplier. Apply authoritative totals supplied by BE. |

## Units and coordinates

KRW, `currencyExponent = 0`: `1000` means **₩1,000**, with separators and no decimals. Currency formatting is configurable. Chance and buy price factors are dimensionless; `chargedMinor` is money. The round cap is 10,000 × the original base bet, including a bonus buy; never × the purchase price.

Boards are flattened row-major. Numeric symbol IDs are supplied by `settings.symbolIds`; Scatter is 11 and Wild is 1 in this synthetic game. Cell positions and ordinary payline IDs are 1-based in this API. The shared adapter converts these to `board[reel][row]` and zero-based line/position objects internally. A separate Scatter payout is not fabricated by the mock.

## Presentation, recovery and frequency

Login + game-info at startup; one paid request per wager. For a feature: one ACK after intro, each free spin, chest summary, each chest reveal, and final Total Win. No per-frame network calls. Resume reads game-info and the stored result rather than restarting the feature. Turbo/skip changes presentation timing only; the same recorded step must complete and be acknowledged. `show_stored_result` restores the after-result state without re-spinning completed free spins.

In the current Tavern presentation, pending `intro` replays the recorded Scatter win then bonus intro without a Resume popup. Later feature steps restore the feature scene and wait for Resume. This visual policy creates no extra wager or payout.

The mock stores rounds, outcomes, sessions and receipts on disk. Restart retains them. Duplicate paid requests and final ACKs return recorded results. Normal rounds settle immediately; feature final ACK settles once, with expiry/startup settlement independent of a returning browser. A owns the final production credit trigger, wallet integration, expiry policy, error catalog and bet/rounding rules. Single-process JSON storage is for local development; production durability/concurrency is not claimed.

[Local run instructions and endpoints](backend-localhost-v1.md) · [Proposal for A to review](FE-BE-Proposal.md).
