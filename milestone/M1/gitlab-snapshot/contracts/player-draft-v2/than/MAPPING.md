# Proposed Than adapter mapping — joint review required

Status: **proposal only**, not a live API or accepted contract. Original v2 docs/examples/hashes are unchanged. No backend source is shipped here. The mock entry consumes one original v2 script as explicit development input; the complete script never enters the production build.

| Existing local client/mock vocabulary | Seed public v2 vocabulary | Proposed action / decision for A |
| --- | --- | --- |
| Play-Token plus paid payload | requestId plus modeId/baseBetMinor and possibly termsVersion | Keep original intent stable; do not equate an entitlement and a request ID without agreed admission/recovery mapping |
| `/api/v1` clean POST URLs and gameCode in JSON | Proposed `/player/v2` session/spins, GET request/round lookup and revision advance | Actual route/auth/body conventions conflict; agree a versioned adapter, do not silently rewrite either contract |
| Numeric money in existing old mock | Canonical unsigned decimal strings | New formatter/controller already accept exact strings; production wire conversion and constraints require agreed schema |
| Numeric symbols, 1-based row-major cell IDs | Named symbols and zero-based `[row,column]` | Explicit display-only mapping; do not derive line wins or trigger cash payouts |
| curStep/stepId ACK | Revision + released event prefix and proposed advance | Receiving a snapshot does not complete presentation; server must approve safe boundaries and stale/two-tab ACK semantics |
| Separate base/feature/chest data | BOARD/BONUS_START/FREE_SPIN/RETRIGGER/CHEST_COLLECT/CHEST_REVEAL/BONUS_END/ROUND_END | Preserve server identity/order/counters. The first playable increment displays BOARD/wins; complete bonus scenes are not claimed |
| Accumulated feature win / confirmed wallet | visibleWinMinor, totalWinMinor/null, confirmedBalanceMinor/null, payoutState | Null is unknown, not zero. FE final display is gated on confirmed payout; confirmation never authorizes revealing future chest values |
| configId and saved settings | rulesVersion and agreed symbol/payline configuration | Pin mapping/version to the round; clarify separate symbol/payline version if needed |

## Earlier client decisions to reconcile with this seed

The 18 November client message specified KRW exponent 0, whole-won decimal strings, original base range 200–200000, five prices 1/3/6/125/300 and cap 10000× original base. Normal interrupted rounds must show only the final result without replay. Feature release/counters/keys/chests resume in order; duplicate confirmations advance once. After 30 days without genuine activity (polls do not renew), uncertain payout hides final money and blocks Spin; confirmed payout permits only final summary, whose idempotent dismissal unlocks the game. Scatter is a trigger without a cash award, with trigger positions separately reported.

The seed's TST/exponent2/base100 scripts deliberately remain synthetic and mark several commercial choices unresolved. Do not relabel those values as KRW or overwrite them. A/product must reconcile the prior decisions with the final public quote/currency contract and adapter revision. Allowed bet steps, rounding, eligible chest subtotal, exact activity/advance semantics and balance-confirmation timestamp remain explicit review topics.

## Four detailed sequences still required for A

1. Normal win/loss, normal finish plus interrupted return, settlement once and explicit new-Spin permission.
2. Lost reply after debit, fresh login finds the original request/round, same-intent retry and changed amount/mode conflict.
3. Interrupted free spin/chest, after-result counter/keys/cumulative restoration and repeated/two-tab confirmation.
4. 30-day closure, polling unchanged deadline, uncertain then confirmed payout, final-summary dismissal and duplicate retry.

These scenarios are not simulated by the read-only seed preview or the local presentation cursor. Existing backend tests/22 old-format examples remain in the user's development repository; private/mock backend implementation is intentionally excluded from this client delivery. Publish reviewed public sequences here only after mapping decisions, with their own version/hash metadata. No contract is automatically accepted by this import.
