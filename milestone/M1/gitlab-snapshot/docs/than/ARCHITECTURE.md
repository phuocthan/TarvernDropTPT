# fw-pixi separation and data flow

| Layer | Responsibility |
| --- | --- |
| `apps/player-web/than/src/` | Recorded-result controller and typed public snapshots; exact currency formatting; shared board geometry, animation timing, resources, audio and lifecycle |
| `apps/player-web/than/dev/` | Explicit local recorded input and mock entry. Keeps the playback test hook in the review build |
| `games/slot-001/client/than/` | 5×5 game geometry, symbol mapping, Spine-specific presentation and review inventory |
| `contracts/player-draft-v2/than/` | Proposed wire vocabulary mapping and synthetic review fixtures. Team A owns the final schema and production outcomes |

The controller accepts a released prefix and validates request/round identity, revision and event order. It advances local presentation only after a step completes. The board displays the recorded grid and highlights supplied positions. Skip changes timing. Reload reads local progress against the same recorded intent. Server-side recovery, round admission and wallet settlement stay with Team A.

The build uses separate entries for local playback and the production core. Assets are loaded from an explicit inventory only when a permitted local pack is configured. The production artifact manifest checks for fixture, test-hook and review-asset leakage. The recorded-prefix controller demonstrates the data boundary while the authenticated v2 adapter is under review.
