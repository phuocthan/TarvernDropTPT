# Tavern Drop · Milestone 1 review package

**Reusable core, asset verification and first runnable build**  
Review date: 19 November 2026 · Target delivery: 23 November 2026

The staging package is ready for source, playback and asset compatibility review. The two board sizes use the same new TypeScript/PixiJS core. Official submission goes through a Draft MR in the client’s GitLab project once access is available.

| Reference | Location |
| --- | --- |
| Staging snapshot | [GitHub staging at 2f93a99](https://github.com/phuocthan/DropTarvernRelease/tree/2f93a9983c36802f54ecb16beace3fc871ae1816/korRelease/slot-client-main) |
| Reviewer start page | [Start here](https://github.com/phuocthan/DropTarvernRelease/blob/2f93a9983c36802f54ecb16beace3fc871ae1816/korRelease/slot-client-main/docs/than/START_HERE.md) |
| Evidence and acceptance items | [M1 evidence](https://github.com/phuocthan/DropTarvernRelease/blob/2f93a9983c36802f54ecb16beace3fc871ae1816/korRelease/slot-client-main/docs/than/M1_EVIDENCE.md) |
| Official submission | [Client GitLab](https://gitlab.com/game-studio9172445/slot-client), branch `feat/than-m1-client-core`, Draft MR into `main` |
| Approved GitLab starting commit | `880a75e406d3a28c03dfa39b3ead93d1a4b4a13b`. GitLab access and ancestry verification are pending. |

## 1. Reusable client core

**Staged under `apps/player-web/than/`.** The same `fw-pixi` controller and board handle the 5×5 and 3×3 configurations. Shared code covers board layout, recorded result playback, resource loading, audio, currency formatting and lifecycle. The first game’s layout, animation bindings and assets live under `games/slot-001/client/than/`.

The core keeps the recorded outcome and its order stable during skip, replay and reload. It displays exact money strings and distinguishes a confirmed zero from an unavailable value. A owns outcomes, wagers, balance and payment decisions. The browser mock plays explicit synthetic input. The production core has an unconfigured integration entry and an explicit allowlist.

The dependency lockfile pins PixiJS 8.23.0, Spine runtime 4.2.120, TypeScript 5.9.3 and Vite 7.3.8. The project needs Node 22.18 or newer. Both mock and production builds emit an artifact manifest with file hashes and sizes.

## 2. First runnable 5×5 and 3×3 examples

| Example | What to try | What it demonstrates |
| --- | --- | --- |
| **5×5 Drop** | Open `/mock.html`. Play the recorded spin, skip or reload. Use the asset probe below the board. | First-game reel geometry, Spine symbol rendering and recovery of the local presentation cursor. |
| **3×3** | Open `/mock.html?game=3x3`. Play or reload the recorded loss. | The same controller and renderer take a different grid config. The replay keeps the same recorded result. |

Run from the staging snapshot’s `korRelease/slot-client-main` directory:

```sh
cd apps/player-web/than
node tools/verify-delivery.mjs
npm ci
npm test
npm run dev
```

Open [5×5](http://127.0.0.1:4361/mock.html) or [3×3](http://127.0.0.1:4361/mock.html?game=3x3) once the local server starts.

| Command | Output |
| --- | --- |
| `npm run build:mock` | `dist/mock`, including the mock playback page and allowlisted assets. Use `npm run preview:mock` to serve it. |
| `npm run build` | `dist/production`, including `fw-pixi.js` and the integration entry. |

Local reload demonstrates the playback checkpoint. Durable server recovery is covered in the API examples and depends on the final adapter and backend.

## 3. Reference checklist and asset verification

| Screen or feature | In this M1 increment | Remaining review or later scope |
| --- | --- | --- |
| Base board and symbols | 5×5 reel layout and Spine symbol mapping for spin, land, idle and win. 3×3 on the same core. | Review timing and visual fidelity against the reference. |
| Loading and HUD | Loader, art, HUD icons and font resources are listed in the runtime inventory. The probe verifies loading. | Approved branding, final menus and the complete HUD belong to later presentation work. |
| Tavern/Drop bonus, keys and chests | First-game runtime exports are inventoried. API examples cover checkpoint, chest reveal and cumulative win. | Full authored intro/outro, freegame presentation and chest playback are later work. |
| Big through Max Win | Win-screen Spine assets and bitmap fonts are inventoried and sampled. | Review the complete win-tier choreography and responsive amounts on the actual game presentation. |
| Music, SFX and fonts | Outfit and three bitmap fonts loaded. 66 cue ranges fit the OGG source. The audio audit decoded an OGG cue and verified non-silent output. | The MP3 fallback is included in the inventory. Playback across target devices and supported formats remains for review. |

The inventory contains **71 runtime files** with hashes and provenance. The audit sampled **8 Spine skeletons and 141 clips** at the start, midpoint and end, using Spine exports 4.2.43 with runtime 4.2.120. The package records the available runtime exports and the still-needed rights evidence for reference assets. Editable authoring originals were not supplied. Physical mobile review remains open. [Asset inventory and provenance](https://github.com/phuocthan/DropTarvernRelease/blob/2f93a9983c36802f54ecb16beace3fc871ae1816/korRelease/slot-client-main/games/slot-001/client/than/IMPLEMENTATION.md)

## 4. API and payment review with Team A

The staged seed retains its original **22 synthetic v2 examples**. The added mapping identifies differences in authentication, request identity, release order, board coordinates and money. [Staged mapping](https://github.com/phuocthan/DropTarvernRelease/blob/2f93a9983c36802f54ecb16beace3fc871ae1816/korRelease/slot-client-main/contracts/player-draft-v2/than/MAPPING.md)

The [detailed draft](m1-detailed-api-draft.md) and [four separate KRW sequences](m1-api-review-sequences.json) are ready to share in the existing API thread. They contain **55 request/response pairs** covering normal win/loss, a lost reply after debit, interrupted free spins and chests across two tabs, and the 30-day expiry through confirmed payout and summary dismissal. They use whole-won strings and keep running win, payout and confirmed balance separate. These two review attachments are prepared separately from the pinned staging snapshot.

Team A should confirm the adapter mapping before integration, especially Play-Token versus request identity, checkpoint semantics, balance confirmation and unsettled payment. The synthetic fixtures support contract review and do not establish final Kai math.

## 5. Verification and official submission

- The staging package’s verification tool checked **69 seed files and 245 delivery files**. The original v2 examples were preserved.
- A clean install in an isolated checkout passed **6 fw-pixi unit tests**, mock and production builds, and **2 Chromium playback/reload tests** on the 5×5 and 3×3 boards. The recorded portrait viewport is 390×844. Screenshots and manifest files are linked from the M1 evidence page.
- The development repository passed **47 unit tests and a build**. Those checks cover the development mock and remain separate from the staging acceptance evidence.
- Once GitLab access is granted, verify the approved starting commit, create or verify `feat/than-m1-client-core`, bring over the reviewed client files and open a Draft MR into `main`. Team A reviews the API mapping. The client reviews asset scope, rights and playback evidence, including physical-device results, on the identified build.

This is the first runnable M1 increment. The client records M1 acceptance after review.
