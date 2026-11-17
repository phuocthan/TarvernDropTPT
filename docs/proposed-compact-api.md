# Proposed compact game API

> **Decision update:** The earlier assumption that base-spin winnings may be credited separately no longer matches Yongtae's one-settlement decision. For the current resumable-client proposal and open questions, see [resumable round and single settlement](resumable-round-client-proposal.md). This older file and its JSON are historical review examples, not the agreed contract.

**Status: proposal for client review; not implemented by the current mock.** This proposal considers a staging log of another game and the existing Tavern mock. Examples use a hypothetical 5 × 5, 40-line configuration. The current Tavern demo is 5 × 5 with 15 configured lines, string symbol IDs and a total-bet list. The actual game code, symbol mapping, denomination model, paytable, line definitions and math must be agreed before implementation. See [example requests and responses](proposed-compact-api-examples.json).

**Reference update:** A later Tavern Drop HAR captured one `/wallet/play` response containing the entire bonus and an `/wallet/end-round` settlement. See [the HAR analysis](tavern-reference-har-analysis.md). The per-free-spin requests below are our proposed design, not the observed Tavern API. The capture also shows its round payout, including its base win, credited by settlement; the mock's treatment of base-win credit differs. The two models must not be mixed without an explicit wallet agreement.

## What the reference log shows

The supplied log records one 5 × 4 staging game session, with a trigger and eight free spins; it is not a Tavern Drop API specification. Its initial game info supplies 40 lines, denomination and line-bet settings, 20 resume symbols and zero active free spins. The captured spin requests include `unit`, `credit`, `domination`, `totalBet`, `line` and `freeSpin`, but no login or start request payload. The samples all use `credit: 1`; their exact denomination formula and the meaning of `credit` cannot be determined from this capture.

On the trigger, `freeGame` reports `spins: 8`, `currSpin: 0` and `fgTotalGain: 8`. Each following free-spin request keeps `totalBet: 0.8` while the response's `successBet` is zero. In the captured sequence, the balance rises by each response's `totalWin`, while `featureResults.accmWin` accumulates those wins (18.2 after the first free spin; 64.6 after the eighth). The log's `roundId` changes on every recorded spin, so it cannot be assumed to be a persistent feature identifier. `tnum` also changes per spin. These observations do not establish retry behavior, account creation, resume during an active feature, or a chest settlement model.

The observed positions in `wildWins` point to symbol ID `1` in the board, and the trigger's `symbolWins` identifies symbol ID `12` with type `S`. This strongly suggests Wild = 1 and Scatter = 12 in the reference game; confirm with its symbol configuration. This conflicts with the requested mapping for the proposed integration (Scatter = 1, last ID = Wild). Do not copy numeric IDs between the games: use an agreed, game-specific symbol table and mapping.

The reference reports 1-based line IDs up to 40 and multiple representations of related data (`freeGame.spins` and `fgRemainGame`; `domination` and `unit` in the captured request). The proposal uses a single representation and explicitly specifies zero-based configured line IDs. Adapt reference responses at the integration boundary if the customer's final protocol retains the reference numbering.

## Conventions

- Amounts are integers in minor units; with a currency scale of 2, `80` means 0.80. The start response declares the currency and scale. `denomination` uses the same units. The server validates the selected denomination, lines and total bet using the agreed game rules.
- `code: 0` means success. An error has a nonzero server-defined `code` and a `message`; a failed request does not change the wallet or game state. HTTP status codes also reflect the outcome.
- The examples put `sessionId` and `token` in the request body as requested. Use HTTPS; the server authenticates the session and validates the game and account. Tokens and example IDs are placeholders.
- `symbols` has exactly `reels × rows` numeric IDs in reel-major order: index = `reel × rows + row`, with both indices zero-based. ID `1` is Scatter; the last ID is Wild; the remaining high-to-low IDs are defined by the agreed game symbol table. All example IDs are illustrative, not the current demo's IDs.
- `lineWins` is omitted when empty. Each entry contains its zero-based configured `line`, paying `symbol`, winning `positions` in left-to-right order and `win`. Positions identify wild substitutions through the returned `symbols` array. Other directions or ways games require an agreed extension.
- `ticketId` identifies a settled spin; `roundId` links the triggering paid spin and all free spins to the same round. A spin with no feature is a complete round on its own. IDs are opaque strings.

## 1. Login

`POST /api/login`

The client sends `{ "accountId": "..." }`, or `{}` when it has no account ID. A successful response contains `code`, `accountId`, `sessionId` and `token`. For the demo, the backend may select a random existing test account when the ID is omitted; the customer must define account access and authentication for production. An unknown supplied account returns an error rather than silently selecting a different account.

## 2. Start or resume

`POST /api/game/start`

Request: `gameCode`, `sessionId`, `token`. The response contains `balance`, `settings`, the last committed `symbols`, and `freeGame` when a feature is active. Settings include `currency`, `amountScale`, `reels`, `rows`, `defaultDenomination`, `denominations` and `lines`. `freeGame` includes `roundId`, `mode`, `total`, `used`, `remaining`, `totalWin`, `denomination`, `totalBet` and `chestRows`. `chestRows` lists the already collected zero-based row indices per reel, preserving the individual key positions needed to resume. During a feature the bet is locked to the server-confirmed value.

After a refresh the snapshot restores the latest committed state. For an unresolved spin, retry its identical `requestId` and body to retrieve its result; if the client has lost that request, recovering the presentation of an already committed result requires an agreed durable result-lookup or event replay API. The start snapshot alone does not replay an animation.

## 3. Spin

`POST /api/game/spin`

Request: `requestId`, `gameCode`, `sessionId`, `token`, `denomination`, `lines`, `totalBet` and `freeSpin` (boolean). The server verifies `freeSpin` against its own state; it never trusts it to determine whether to charge. For a free spin, the client echoes the locked denomination and total bet, while the response's `bet` is `0` because no new wager was charged.

Success returns `code`, `ticketId`, `roundId`, `balance`, `bet`, `spinWin`, `credited` and `symbols`; `lineWins` and `freeGame` are conditional. `bet` is the amount actually debited by this spin; `spinWin` is the current spin's award before any feature settlement; `credited` is the amount credited to the balance by this transaction, including any feature settlement. The balance is authoritative after the transaction. `lineWins[].win` describes the winning lines of the current spin and may be only part of `spinWin` if other awards exist. Keeping `spinWin` separate from `credited` supports both the reference's per-spin crediting and Tavern's current settlement-at-end model without an ambiguous `totalWin` field.

When a feature triggers, `freeGame` gives its initial state. Each feature spin returns the updated state; `freeGame.totalWin` is the accumulated pre-multiplier feature win including that spin. When the feature ends, `freeGame.result` supplies `baseWin`, `multipliers` in reel order (1 for locked chests), `totalWin` (final feature award after multipliers and any cap), and `capped`. `freeGame.remaining` is 0. `balance` and `credited` reflect the actual transaction. The client reveals eligible chests using `chestRows`, presents the intermediate amounts, and ends at `result.totalWin`; it does not calculate the credited award independently. If there are no eligible chests, the chest reveal is omitted.

The proposed Tavern examples follow the existing mock: accumulated feature wins are credited once at feature settlement, and any paid-spin win was credited on its own ticket. This differs from the observed staging game, which credits each free spin. If the customer's wallet credits per spin, `credited` reports each actual credit and on the final spin reports only the newly credited amount, not the already credited running total; the final settlement rule must be agreed to prevent double credit. Integer multiplication, payout limits and rounding are server-owned. When a cap applies, the client clamps displayed intermediate amounts to the confirmed final award.

## Reliability and scope

The client generates a unique `requestId` per spin and retains the exact request until its outcome is known. Within the same account and game, the server persists the outcome and returns the same result for an identical retry without charging or creating another ticket; reuse of the ID with a different body returns a conflict. Retention period, concurrent spins, session expiry and durable lookup need agreement. Do not retry a failed business validation as a new transaction without refreshing state.

The proposed shape covers standard spins and free-game resume/settlement. Feature buy, chance modes, retriggers, replay of committed animations and error-code catalog need separate agreement before replacing the existing mock. No endpoint, database or client transport has been changed by this proposal.
