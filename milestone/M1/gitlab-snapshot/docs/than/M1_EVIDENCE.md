# M1 evidence - initial client increment

| Requirement | Evidence | Open review |
| --- | --- | --- |
| Reusable TypeScript/PixiJS core | One `fw-pixi` controller and board for the 5×5 and 3×3 recorded examples. Exact lockfile, dependency notices and isolated build profiles. | Review source and boundaries in this Draft MR. |
| Runnable mock | Playback and reload on both grids in Chromium using placeholder symbols. Original seed remains intact. | Physical mobile and reference timing/visual review. |
| Asset integration | The game module has an explicit 71-file candidate inventory, Spine symbol bindings and a playback/audio probe for a permitted local pack. | Confirm required files and redistribute only the assets authorized for this repository. Confirm full playback on approved assets and supported devices. |
| API boundary | The original 22 v2 cases remain unchanged. The KRW draft adds four synthetic traces. The core preserves recorded ordering and does not decide financial outcomes. | Team A approves the route, identity and checkpoint mapping. |
| Production core artifact | The production build exports the reusable core and has a separate integration entry. The build scanner checks for local fixtures and test hooks. | Authenticated adapter and approved assets. |

Validation on this increment: 69 seed files matched the original manifest. All 42 seed tests, 6 new unit tests and both Chromium playback/reload tests passed. A clean dependency install, both build profiles and the seed allowlist check passed. See [start instructions](START_HERE.md) and the [contract review](../../contracts/player-draft-v2/than/krw-review/API.md).

The default browser tests run the 5×5 and 3×3 boards using placeholders. They verify the local presentation cursor, while production recovery and payment remain with Team A. The reviewer records M1 acceptance after reviewing the identified build and closing required asset blockers.

The optional asset probe also passed in a separate local run on Node v24.12.0 and Chromium using the inventoried pack. It sampled eight Spine skeletons and 141 clips, loaded the font and checked 66 OGG cue ranges plus non-silent decoded output. This is compatibility evidence for the tested pack. The pack remains outside this repository, and redistribution permission and physical-device playback still require review.

The [hosted Asset Viewer](https://slotdemo.up.railway.app/?game=viewer) gives reviewers direct access to individual Spine clips, images and sound cues. It runs separately from the recorded 5×5 and 3×3 demos. The 5×5 playback recording with the approved pack, target-device checks and runtime file permissions remain open.

For a playable view of the current full-game presentation, open the [hosted Tavern Drop progress build](https://slotdemo.up.railway.app/). It uses demo credits and a mock API. The verification below identifies the reproducible GitLab M1 build. Record feedback from the hosted preview with the game state and device/browser so it can be reproduced.

See [build verification](BUILD_VERIFICATION.json) for the clean source commit, lockfile hash and generated artifact hashes for both default build profiles.
