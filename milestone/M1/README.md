# Tavern Drop Milestone 1 archive

This folder records the M1 delivery as verified on 19 November 2026. The original project repository keeps this archive. The client reviews the TypeScript/PixiJS delivery in its GitLab project.

## Client delivery

| Item | Reference |
| --- | --- |
| Official review | [GitLab Draft MR !1](https://gitlab.com/game-studio9172445/slot-client/-/merge_requests/1) |
| Source and target | `feat/than-m1-client-core` into `main` |
| Approved starting commit | `880a75e406d3a28c03dfa39b3ead93d1a4b4a13b` |
| First runnable commit | `e1e3b9369a4d47c257a2446d1b464dab8eb4dab7` |
| Archived Draft MR revision | [`482c94a78c88233b0809fce7918bb64820c1e03a`](https://gitlab.com/game-studio9172445/slot-client/-/commit/482c94a78c88233b0809fce7918bb64820c1e03a) |
| Playable preview | [Tavern Drop 5×5](https://slotdemo.up.railway.app/) uses demo credits and a mock API |
| Asset preview | [Spine clips, full-size images and individual sound cues](https://slotdemo.up.railway.app/?game=viewer) |

## Files to use

- [Delivery report PDF](client/Tavern-Drop-M1-Delivery-Report.pdf) and [asset review checklist Word document](client/Tavern-Drop-M1-Asset-Review-Checklist.docx) are the English files prepared for the client.
- [Draft message for the client](client/review-message-en.md) links the current build, viewer and MR.
- The [GitLab snapshot](gitlab-snapshot) contains selected files copied from the archived MR revision with the original directory structure. Start with the [run guide](gitlab-snapshot/docs/than/START_HERE.md), [M1 criteria](gitlab-snapshot/docs/M1_ACCEPTANCE.md), [test evidence](gitlab-snapshot/docs/than/M1_EVIDENCE.md) and [build hashes](gitlab-snapshot/docs/than/BUILD_VERIFICATION.json).
- See the [asset inventory](gitlab-snapshot/games/slot-001/client/than/ASSET_INVENTORY.json) and [viewer and runtime asset guide](gitlab-snapshot/games/slot-001/client/than/IMPLEMENTATION.md) for the 71 candidate files and review instructions.
- The [API draft](gitlab-snapshot/contracts/player-draft-v2/than/krw-review/API.md), [v2 adapter mapping](gitlab-snapshot/contracts/player-draft-v2/than/MAPPING.md) and [four synthetic KRW traces](gitlab-snapshot/contracts/player-draft-v2/than/krw-review/m1-api-review-sequences.json) cover normal win and loss, a lost paid response, interrupted free spins and chests, and 30-day expiry.
- [Historical staging notes](history) record the earlier GitHub staging and the local API working draft. See the [client decisions log](../../docs/client-communication-log.md) and [handoff notes](../../docs/handoff-2026-11-19.md) for the broader project context.

## Last verified status

- GitLab showed MR !1 open and marked Draft at `482c94a`. The only merge check listed was the Draft status. The MR showed zero pipelines and zero reviewers. The check did not establish that the client had received a separate review invitation.
- Four links in the MR description resolved against `main`, where the files were absent. They point to the run guide, M1 evidence, build hashes and API draft. Use the archived links above or the pinned GitLab revision to reach those documents.
- Both local build profiles, 6 unit tests and 2 Chromium playback/reload tests passed on the archived revision. All 69 seed files matched. A local merge check showed no conflict against the approved base.
- Smoke checks on Railway exercised one base spin, one Spine clip, one full-size image and one sound cue. Earlier local compatibility evidence covers 8 Spine skeletons, 141 clips, the configured font and 66 OGG cue ranges. The hosted progress build and viewer are separate from the GitLab source submission.
- M1 review remains open for asset permissions, integrated playback with the approved runtime pack and target-device evidence. Team A still needs to agree the live v2 adapter mapping and align the normal-spin settlement example with the agreed presentation timing.
