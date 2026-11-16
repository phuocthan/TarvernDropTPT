# M1 mock API · integration review

[Sanitized JSON examples](milestone-1-api-examples.json) come from the existing mock server and synthetic fixtures. The example data does not depend on final Kai math. The numbers and IDs are for development review.

| Topic | Current mock |
| --- | --- |
| Session | `GET /api/session` returns `version`, `balance`, `board`, `feature` and `round`. A same-origin, HttpOnly cookie identifies the in-memory wallet. Base mode has `feature: null`. An active feature reports `feature.mode` as `tavern` or `drop`. The 3 × 3 demo has its own API base. |
| Client request | `POST /api/command` sends `requestId` (client-generated UUID), `expectedVersion` from the last snapshot, `action` (`spin`, `buy-tavern` or `buy-drop`), requested base `bet`, and `chance`. In free spins the request echoes the server-confirmed round bet and uses standard chance. |
| Server-confirmed outcome | `requestId` echoes the command. `bet`, `state`, `wins`, `spinWin`, `paidAward`, and feature fields come from the server. `state.round.id` is server-generated and is present while the paid round is open. A settled base spin or completed feature returns `state.round: null`. |
| Amounts | Integer units at scale 2 (`100` displays as `1.00`). The wire format currently has no currency code or `chargedAmount` field. In an uninterrupted mock flow the charge can be reconciled as previous balance + `paidAward` − new balance. In these fixtures the standard 100-unit spin charges 100, the 100-unit Drop purchase charges 10,000, and the free spin charges zero. The production contract should return the authoritative charge and currency explicitly. |
| Line win | The board is column-major `board[reel][row]`. Both indices are zero-based, left to right and top to bottom. Symbol IDs match the game config (e.g. `A`, `wild`, `bonus` for Scatter). `wins[].line` indexes the zero-based `lines` array in the config. Each win gives its ordered positions, paying symbol and amount in integer minor units. |
| Free spins | `entry` identifies a triggered mode. State gives remaining/played counts, accumulated spin wins and one chest per reel. `collected` lists new winning positions credited to keys. On settlement, `finalFeature` holds the final chest states and `completion` contains pre-multiplier accumulation, one multiplier per reel, `product`, the bonus-only `featureAward`, the paid round's `roundAward`, and `capped`. A locked chest contributes ×1. `paidAward` is the newly credited amount for this command. |
| Retry and refresh | The client saves a command before sending it. After a timeout, lost response or pending-command refresh, it replays the identical command body and ID. The mock returns the saved result for that ID before checking the version, without charging again. If a response was already received, refresh loads the latest snapshot and the mock does not replay its animation. |
| Errors | Known business rejections use an HTTP status and `{ "error": "CODE" }`. The client fetches a fresh snapshot after a structured 4xx. Timeouts and ambiguous transport failures retain the pending command. `SESSION_EXPIRED` can occur after restart or cookie loss because session state and receipts are in memory. |

The current payload carries outcome fields. The client derives presentation order from them:

1. Stop the reels on the returned board, play land and line wins, then show any Scatter trigger.
2. Present feature entry or retrigger, then consume returned free-spin results and light newly collected keys/chests.
3. At settlement, reveal eligible chests, transfer multipliers, run any applicable win-tier presentation and show Total Win. The client may interpolate the counter but uses the confirmed settlement amount.

Skip and Turbo are client presentation controls. They shorten timing or settle the animation on the same recorded board. They do not send a second spin or recalculate awards.

## Reproduce locally

Run `npm ci`, `npm run build` and `npm start`. Open the preview in a browser, or use:

```sh
curl -c demo.cookies http://localhost:4000/api/session
curl -b demo.cookies -H 'Content-Type: application/json' \
  -d '{"requestId":"example-001","expectedVersion":0,"action":"spin","bet":100,"chance":"standard"}' \
  http://localhost:4000/api/command
```

The live mock generates a fresh outcome. The JSON examples use fixed boards so they can be reviewed reproducibly. See `server.js`, `server/mock-game.ts`, `src/framework/domain/contracts.ts` and `src/games/tavern/game.config.json`.

## Pending a joint contract

Team A will propose money fields, durable request/round IDs, duplicate and conflict handling, and recovery semantics. On the presentation side we propose stable ordered events for land, win, feature trigger, key collection, retrigger, chest reveal and settlement, plus a way to retrieve a committed result by stable ID. The mock has no durable round lookup, versioned event envelope, explicit currency or charge field, or replay cursor. We can review field ownership and recovery at the M1 integration sync and agree on a versioned contract before backend integration.
