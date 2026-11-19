# slot-001 presentation and asset review

The game module contains the 5×5 configuration, Spin/Land/Idle/Win bindings, symbol bounds and an optional compatibility probe. The shared `fw-pixi` controller and renderer live in `apps/player-web/than/`. All authoritative amounts and recorded outcomes come from server-provided data or explicit development fixtures.

`ASSET_INVENTORY.json` records 71 candidate runtime assets, source, hashes, known rights evidence and editable-original availability. The inventory describes runtime exports. Editable authoring originals and reference asset redistribution approval remain open. The default GitLab checkout runs both examples with placeholder symbols.

## Preview assets online

Open the [Tavern Drop Asset Viewer](https://slotdemo.up.railway.app/?game=viewer) in a browser. It runs separately from the GitLab checkout and requires no local setup.

| Viewer section | How to review |
| --- | --- |
| Spine Player | Choose a skeleton and animation. Start with **reelhouse** and **1_idle**, or select **4_finalwin** to inspect the final-win clip. |
| Images | Select a thumbnail to open the full-size image. |
| Sound Sprite | Select a cue and click **Play**. The viewer shows the duration and offset of each cue. |

For feedback, include the skeleton and clip name, image name, or sound cue ID. Please confirm which runtime pack to use for the integrated 5×5 review and which files can be included in GitLab. The hosted viewer is for asset preview. Integrated 5×5 playback, physical-device checks, and permission to distribute the runtime files are still part of M1 review.

## Review a permitted local asset pack

After the coordinator supplies or approves the pack, place the folder outside the repository. Set `THAN_APPROVED_ASSET_PACK` to the folder containing the inventory’s relative paths, for example `assets/…` and `hud/…`, before running `npm run dev` in `apps/player-web/than`. With a correctly matched pack, the 5×5 demo enables native Spine symbols and the compatibility probe. Files and hashes must match the inventory. Use `npm run test:browser` to run the loaded Spine and audio checks as well as recorded playback.

Only the review profiles use the pack. A new pack with different exports requires an updated inventory and compatibility checks. See the client’s [asset requirements](../../../../docs/ASSETS.md) and the [M1 evidence](../../../../docs/than/M1_EVIDENCE.md).
