# Tavern Drop — Milestone 2 asset and sound checklist

This checklist lists every runtime file delivered in `public/tavern-assets/`, every sound cue in the sound sprite and every Spine animation clip. For each item it records whether Milestone 2 uses it, where it is used and whether it is the same as the original Tavern Drop v13 game.

## 1. Summary

| Group | Files | Used by the game | Same as the original |
| --- | --- | --- | --- |
| Runtime assets (`assets/`) | 54 | 52 | 54 |
| HUD icons (`hud/`) | 17 | 15 | 17 |
| Fallback sounds (`cues/`) | 5 | 5 | 0 |
| Cover and favicon | 2 | 0 | 0 |
| **Total** | **78** | **72** | **71** |

- All 54 files in `assets/` match the provider's Tavern Drop v13 CDN byte-for-byte by SHA-256 (CDN check on 2026-11-19; source `https://paperclip.live.engine.io/tavern-drop/v13/assets/`). The SHA-256 of each file is in section 6.
- The 17 HUD icons were extracted unchanged from the v13 UI bundle.
- The sound sprite holds 66 cues. Milestone 2 plays all 66 of them with the same triggers as the reference game (section 3).
- The 8 Spine skeletons hold 141 clips. The game plays 140; the remaining clip (`3_push`) is unused by the reference as well (section 4).
- Not used by the game: two platform logos, the `stop` and `share` icons, the cover and the favicon. The five `cues/*.mp3` files are only a fallback if the sound sprite fails to load.

### Quality tiers

The atlas path is `{quality}/td_master.atlas`. Like the reference, iOS uses `sd`, Android uses `sd` unless `navigator.deviceMemory` is above 8, and desktop uses `hd`. Add `?quality=hd` or `?quality=sd` to the game URL to force a tier during review. The canvas renders at `min(2, devicePixelRatio)`.

## 2. Files

Paths are relative to `public/tavern-assets/`. *SHA-256 match* means the file is byte-identical to the provider's v13 CDN file.

| File | Size | Type | Used in M2 | Where it is used | Same as the original |
| --- | --- | --- | --- | --- | --- |
| `assets/bonus_static.webp` | 374 KB | Static symbol | Yes | Rules page and DOM fallback for the Bonus symbol. | Yes (SHA-256 match) |
| `assets/continue.webp` | 15 KB | Press to continue art | Yes | Opening, bonus intro and Total Win Continue prompts (`theme.css`). | Yes (SHA-256 match) |
| `assets/h1_static.webp` | 165 KB | Static symbol | Yes | Paytable and DOM fallback (H1). | Yes (SHA-256 match) |
| `assets/h2_static.webp` | 44 KB | Static symbol | Yes | Paytable and DOM fallback (H2). | Yes (SHA-256 match) |
| `assets/h3_static.webp` | 50 KB | Static symbol | Yes | Paytable and DOM fallback (H3). | Yes (SHA-256 match) |
| `assets/h4_static.webp` | 54 KB | Static symbol | Yes | Paytable and DOM fallback (H4). | Yes (SHA-256 match) |
| `assets/hd/td_master.atlas` | 25 KB | Spine atlas (HD) | Same rule as reference `JT()` | Desktop and high-memory Android. Selected by the `{quality}` placeholder (`resources.assets.atlas`). | Yes (SHA-256 match) |
| `assets/hd/td_master.webp` | 1.8 MB | Atlas page 1 (HD) | Yes | Loaded by the HD atlas; also used by the HTML fallback art (`art.ts`). | Yes (SHA-256 match) |
| `assets/hd/td_master_2.webp` | 1.1 MB | Atlas page 2 (HD) | Yes | Loaded by the HD atlas. | Yes (SHA-256 match) |
| `assets/hd/td_master_3.webp` | 1.6 MB | Atlas page 3 (HD) | Yes | Loaded by the HD atlas. | Yes (SHA-256 match) |
| `assets/hd/td_master_4.webp` | 2.3 MB | Atlas page 4 (HD) | Yes | Loaded by the HD atlas. | Yes (SHA-256 match) |
| `assets/hd/td_master_5.webp` | 1.6 MB | Atlas page 5 (HD) | Yes | Loaded by the HD atlas. | Yes (SHA-256 match) |
| `assets/l1_static.webp` | 49 KB | Static symbol | Yes | Paytable and DOM fallback (L1). | Yes (SHA-256 match) |
| `assets/l2_static.webp` | 56 KB | Static symbol | Yes | Paytable and DOM fallback (L2). | Yes (SHA-256 match) |
| `assets/l3_static.webp` | 47 KB | Static symbol | Yes | Paytable and DOM fallback (L3). | Yes (SHA-256 match) |
| `assets/l4_static.webp` | 49 KB | Static symbol | Yes | Paytable and DOM fallback (L4). | Yes (SHA-256 match) |
| `assets/l5_static.webp` | 65 KB | Static symbol | Yes | Paytable and DOM fallback (L5). | Yes (SHA-256 match) |
| `assets/outfit-500-CMfhJlfe.woff2` | 16 KB | Font (Outfit 500) | Yes | UI text, weight 500 (`theme.css` @font-face). | Yes (SHA-256 match) |
| `assets/outfit-600-DuSOvJ_5.woff2` | 17 KB | Font (Outfit 600) | Yes | UI text, weight 600 (`theme.css` @font-face). | Yes (SHA-256 match) |
| `assets/outfit-700-D9T176aR.woff2` | 17 KB | Font (Outfit 700) | Yes | UI text, weight 700; preloaded as the `ui` resource bundle. | Yes (SHA-256 match) |
| `assets/outfit-800-ySok2YOt.woff2` | 17 KB | Font (Outfit 800) | Yes | UI text, weight 800 (`theme.css` @font-face). | Yes (SHA-256 match) |
| `assets/outfit-v11-latin_latin-ext-300-COlrd1hX.woff2` | 17 KB | Font (Outfit 300) | Yes | UI text, weight 300 (`theme.css` @font-face). | Yes (SHA-256 match) |
| `assets/outfit-v11-latin_latin-ext-regular-BDXaL9-u.woff2` | 17 KB | Font (Outfit 400) | Yes | UI text, weight 400 (`theme.css` @font-face). | Yes (SHA-256 match) |
| `assets/paperclip-C0ObTQLL.webp` | 29 KB | Platform logo | No | Not used. The reference shows it only in the platform's share/replay links. | Yes (SHA-256 match) |
| `assets/paperclip-rMFDawAD.gif` | 521 KB | Brand intro GIF | Yes | Loading intro for 2.7 s (`presentation.loadingScreen.brandIntro`). | Yes (SHA-256 match) |
| `assets/paperclip_full_logo.webp` | 63 KB | Studio logo | Yes | Static loader after the intro. | Yes (SHA-256 match) |
| `assets/poweredby-D9-5QAZx.webp` | 30 KB | Platform logo | No | Not used. Reference platform footer for share links. | Yes (SHA-256 match) |
| `assets/sd/td_master.atlas` | 23 KB | Spine atlas (SD) | Same rule as reference `JT()` | iOS and Android with ≤ 8 GB memory. `?quality=hd|sd` overrides. | Yes (SHA-256 match) |
| `assets/sd/td_master.webp` | 3.0 MB | Atlas page (SD) | Yes | Loaded by the SD atlas. | Yes (SHA-256 match) |
| `assets/td_ante.webp` | 109 KB | Feature card art | Yes | Extra Chance card in the Buy panel. | Yes (SHA-256 match) |
| `assets/td_backgrounds.skel` | 47 KB | Spine skeleton | Yes | Tavern background, camera zoom, shake, mobile layout (`scene.background`). | Yes (SHA-256 match) |
| `assets/td_bonus.webp` | 59 KB | Feature card art | Yes | Tavern Bonus card in the Buy panel; bonus intro fallback. | Yes (SHA-256 match) |
| `assets/td_card_character.webp` | 120 KB | Character art | Yes | Mascot fallback when the Spine scene is unavailable. | Yes (SHA-256 match) |
| `assets/td_character.skel` | 111 KB | Spine skeleton | Yes | Mascot idle/win and giggle/mug events (`mascot.ts`). | Yes (SHA-256 match) |
| `assets/td_gold.webp` | 333 KB | Bitmap font page | Yes | Texture for `td_gold`. | Yes (SHA-256 match) |
| `assets/td_gold.xml` | 2 KB | Bitmap font | Yes | Win counters, Total Win, chest amounts. | Yes (SHA-256 match) |
| `assets/td_green.webp` | 343 KB | Bitmap font page | Yes | Texture for `td_green`. | Yes (SHA-256 match) |
| `assets/td_green.xml` | 2 KB | Bitmap font | Yes | Line win amounts below 20× bet (`payline.ts`). | Yes (SHA-256 match) |
| `assets/td_loader.webp` | 105 KB | Game logo | Yes | Static loader; logo fallback when the Spine scene is unavailable. | Yes (SHA-256 match) |
| `assets/td_loader_bg.webp` | 96 KB | Loader background | Yes | Static loader background. | Yes (SHA-256 match) |
| `assets/td_red.webp` | 337 KB | Bitmap font page | Yes | Texture for `td_red`. | Yes (SHA-256 match) |
| `assets/td_red.xml` | 2 KB | Bitmap font | Yes | Line win amounts from 20× bet (`payline.ts`). | Yes (SHA-256 match) |
| `assets/td_reelhouse.skel` | 191 KB | Spine skeleton | Yes | Reel frame, splash/game enter, paylines, keys, chests, final win (`effects.ts`, `payline.ts`). | Yes (SHA-256 match) |
| `assets/td_screens.skel` | 394 KB | Spine skeleton | Yes | Big/Super/Mega/Epic/Max Win, Retrigger, bonus intro and Total Win screens. | Yes (SHA-256 match) |
| `assets/td_sounds.json` | 5 KB | Sound sprite map | Yes | Cue offsets and durations (`resources.assets["audio.manifest"]`). | Yes (SHA-256 match) |
| `assets/td_sounds.mp3` | 9.6 MB | Sound sprite (MP3) | Yes | Fallback source for browsers without OGG (Safari). | Yes (SHA-256 match) |
| `assets/td_sounds.ogg` | 7.5 MB | Sound sprite (OGG) | Yes | All 66 cues (see section 3). Preferred source. | Yes (SHA-256 match) |
| `assets/td_super.webp` | 84 KB | Feature card art | Yes | Drop Bonus card in the Buy panel; bonus intro fallback. | Yes (SHA-256 match) |
| `assets/td_superante.webp` | 45 KB | Feature card art | Yes | Super Chance card in the Buy panel. | Yes (SHA-256 match) |
| `assets/td_symbols_bonus.skel` | 75 KB | Spine skeleton | Yes | Bonus (Scatter) symbol, land and win. | Yes (SHA-256 match) |
| `assets/td_symbols_high.skel` | 108 KB | Spine skeleton | Yes | H1–H4 symbols: spin, static, land (H1), win. | Yes (SHA-256 match) |
| `assets/td_symbols_low.skel` | 79 KB | Spine skeleton | Yes | L1–L5 symbols: spin, static, win. | Yes (SHA-256 match) |
| `assets/td_symbols_wild.skel` | 63 KB | Spine skeleton | Yes | Wild symbol. | Yes (SHA-256 match) |
| `assets/wild_static.webp` | 352 KB | Static symbol | Yes | Rules page and DOM fallback for Wild. | Yes (SHA-256 match) |
| `cover/taverndrop.webp` | 30 KB | Cover image | No | Not loaded by the game. Lobby/listing tile for the operator. | Provided for listings |
| `favicon.png` | 2 KB | Favicon | No | Not loaded by the game page. | Project file |
| `hud/autoplay-ready.svg` | 2 KB | HUD icon | Yes | Autoplay-ready badge on Spin. | Yes (from the v13 UI bundle) |
| `hud/autoplay.svg` | 2 KB | HUD icon | Yes | Autoplay button. | Yes (from the v13 UI bundle) |
| `hud/bet-down.svg` | 1 KB | HUD icon | Yes | Bet − (HUD and Buy panel). | Yes (from the v13 UI bundle) |
| `hud/bet-up.svg` | 1 KB | HUD icon | Yes | Bet + (HUD and Buy panel). | Yes (from the v13 UI bundle) |
| `hud/close.svg` | 1 KB | HUD icon | Yes | Close button of menu, rules and dialogs. | Yes (from the v13 UI bundle) |
| `hud/effects-muted.svg` | 2 KB | HUD icon | Yes | Sound effects volume (off). | Yes (from the v13 UI bundle) |
| `hud/effects.svg` | 1 KB | HUD icon | Yes | Sound effects volume (on). | Yes (from the v13 UI bundle) |
| `hud/feature-buy.svg` | 1 KB | HUD icon | Yes | Bonus Buy button. | Yes (from the v13 UI bundle) |
| `hud/info.svg` | 1 KB | HUD icon | Yes | Game Rules entry in the menu. | Yes (from the v13 UI bundle) |
| `hud/menu.svg` | 1 KB | HUD icon | Yes | Menu button. | Yes (from the v13 UI bundle) |
| `hud/music-muted.svg` | 1 KB | HUD icon | Yes | Music volume (off). | Yes (from the v13 UI bundle) |
| `hud/music.svg` | 1 KB | HUD icon | Yes | Music volume (on). | Yes (from the v13 UI bundle) |
| `hud/share.svg` | 0 KB | HUD icon | No | Not used: sharing belongs to the operator platform. | Yes (from the v13 UI bundle) |
| `hud/skip.svg` | 0 KB | HUD icon | Yes | Skip Bonus button (free-spin HUD). | Yes (from the v13 UI bundle) |
| `hud/spin.svg` | 1 KB | HUD icon | Yes | Spin / Skip button. | Yes (from the v13 UI bundle) |
| `hud/stop.svg` | 0 KB | HUD icon | No | Not used: a running autoplay shows its remaining count on Spin, as in the reference. | Yes (from the v13 UI bundle) |
| `hud/turbo.svg` | 1 KB | HUD icon | Yes | Turbo button; bolts on the Buy cards. | Yes (from the v13 UI bundle) |
| `cues/chest.mp3` | 55 KB | Fallback sound | Fallback only | Only if the sprite cannot load: chest. | No (excerpt of the sprite) |
| `cues/entry.mp3` | 65 KB | Fallback sound | Fallback only | Only if the sprite cannot load: bonus entry. | No (excerpt of the sprite) |
| `cues/start.mp3` | 6 KB | Fallback sound | Fallback only | Only if the sound sprite cannot load: spin start. | No (excerpt of the sprite) |
| `cues/stop.mp3` | 6 KB | Fallback sound | Fallback only | Only if the sprite cannot load: reel stop. | No (excerpt of the sprite) |
| `cues/win.mp3` | 10 KB | Fallback sound | Fallback only | Only if the sprite cannot load: line win. | No (excerpt of the sprite) |

## 3. Sound cues

All cues come from `assets/td_sounds.ogg` (MP3 fallback) using the offsets in `td_sounds.json`. The sound logic is in `src/games/tavern/soundscape.ts`, a port of the reference sound director. Sound and music start at volume 0.5 when the player presses **Press to continue**, as in the reference. *Base* cues belong to the Milestone 2 base game. *Bonus* cues play when a natural Scatter trigger enters the bonus; the bonus games are reviewed in Milestone 3.

| Cue | Length | Reference trigger | Tavern Drop M2 trigger | Scope | Same as the original |
| --- | --- | --- | --- | --- | --- |
| `pc_anticipation` | 13.6 s | anticipationStart (loop, fade in 500 ms) / End (fade out 400 ms) | Board anticipation callback (`sound.anticipation`) | Base | Yes |
| `pc_shared_counting_end` | 2.2 s | bigwinOutro | Win screen end; chest count end | Base | Yes |
| `pc_shared_counting_pitched` | 12.4 s | bigwinIntro (loop) | Win screen count-up; chest count-up | Base | Yes |
| `pc_shared_reel_start` | 0.3 s | spinStart | Spin pressed (`run`) | Base | Yes |
| `pc_shared_reel_stop_0` | 0.4 s | reelStop (0.5 in Turbo); random one at 0.3 per anticipation reveal | Reel 1 stop (`sound.reelStop`) / anticipation reveal | Base | Yes |
| `pc_shared_reel_stop_1` | 0.3 s | reelStop (0.5 in Turbo); random one at 0.3 per anticipation reveal | Reel 2 stop (`sound.reelStop`) / anticipation reveal | Base | Yes |
| `pc_shared_reel_stop_2` | 0.4 s | reelStop (0.5 in Turbo); random one at 0.3 per anticipation reveal | Reel 3 stop (`sound.reelStop`) / anticipation reveal | Base | Yes |
| `pc_shared_reel_stop_3` | 0.4 s | reelStop (0.5 in Turbo); random one at 0.3 per anticipation reveal | Reel 4 stop (`sound.reelStop`) / anticipation reveal | Base | Yes |
| `pc_shared_reel_stop_4` | 0.3 s | reelStop (0.5 in Turbo); random one at 0.3 per anticipation reveal | Reel 5 stop (`sound.reelStop`) / anticipation reveal | Base | Yes |
| `pc_shared_win_line_0` | 0.5 s | symbolWin: one of the four at random, pitch 0.95 + 0.02 per line | Each pay line (`sound.lineWin`) | Base | Yes |
| `pc_shared_win_line_1` | 0.5 s | symbolWin: one of the four at random, pitch 0.95 + 0.02 per line | Each pay line (`sound.lineWin`) | Base | Yes |
| `pc_shared_win_line_2` | 0.5 s | symbolWin: one of the four at random, pitch 0.95 + 0.02 per line | Each pay line (`sound.lineWin`) | Base | Yes |
| `pc_shared_win_line_3` | 0.5 s | symbolWin: one of the four at random, pitch 0.95 + 0.02 per line | Each pay line (`sound.lineWin`) | Base | Yes |
| `shared_betlevel` | 0.2 s | increaseBet / decreaseBet, pitched 0.8–2.0 by bet level | Bet −/+ (`sound.betLevel`), same pitch rule | Base | Yes |
| `shared_buy_click` | 0.9 s | playButtonClick (special) | Bonus Buy button (`sound.buttonClick(true)`) | Base | Yes |
| `shared_click` | 0.1 s | betStart, playButtonClick | Spin pressed in base game (`sound.betStart`); autoplay top-up and buttons | Base | Yes |
| `shared_totalwin_big` | 1.0 s | finalWin > 50× | Round end (`sound.finalWin`) | Base | Yes |
| `shared_totalwin_coins` | 0.7 s | finalWin > 1× | Round end (`sound.finalWin`) | Base | Yes |
| `shared_totalwin` | 0.7 s | finalWin > 1× | Round end (`sound.finalWin`) | Base | Yes |
| `tb_fs_land_0` | 1.2 s | symbolLand Bonus #1 (0.42 in Turbo/Skip) | Scatter land (`sound.scatterLand`) | Base | Yes |
| `tb_fs_land_1` | 1.2 s | symbolLand Bonus #2 | Scatter land | Base | Yes |
| `tb_fs_land_2` | 1.6 s | symbolLand Bonus #3 | Scatter land | Base | Yes |
| `tb_fs_land_3` | 1.6 s | symbolLand Bonus #4+ | Scatter land | Base | Yes |
| `tb_fs_win` | 2.6 s | symbolWin of Bonus symbols (trigger/retrigger) | Scatter celebration (`sound.scatterWin`) | Base | Yes |
| `tb_totalwin_intro` | 4.0 s | totalWinIntro | Total Win screen (`sound.totalWinIntro`) | Bonus | Yes |
| `tb_totalwin_outro` | 2.2 s | totalWinOutro | Total Win Continue | Bonus | Yes |
| `tb_win_big` | 1.9 s | symbolWin, line ≥ 10× bet | Each pay line (`sound.lineWin`) | Base | Yes |
| `tb_win_small` | 1.9 s | symbolWin, line < 10× bet | Each pay line (`sound.lineWin`) | Base | Yes |
| `td_amb_base` | 43.7 s | startGame loop, fade in 4 s | Base ambience layer | Base | Yes |
| `td_amb_bonus` | 43.7 s | bonusOutro toBonus: crossfade | Bonus ambience layer (`sound.mode`) | Bonus | Yes |
| `td_bgm_base_l0-01` | 32.0 s | startGame loop, fade in 4 s | Base music layer 0 | Base | Yes |
| `td_bgm_base_l1` | 32.0 s | symbolWin in base: layer on, off 8 s after the last win | Base music layer 1 (`sound.lineWin`) | Base | Yes |
| `td_bgm_base_l2` | 32.0 s | symbolWin ≥ 10× in base: layer on, off after 8 s | Base music layer 2 | Base | Yes |
| `td_bgm_bonus_l0` | 63.3 s | bonusOutro toBonus | Bonus music layer 0 | Bonus | Yes |
| `td_bgm_bonus_l1` | 63.3 s | symbolWin in bonus | Bonus music layer 1 | Bonus | Yes |
| `td_bgm_bonus_l2` | 63.3 s | chestActivate in bonus | Bonus music layer 2 | Bonus | Yes |
| `td_fanfare` | 6.9 s | totalWinIntro | Total Win screen | Bonus | Yes |
| `td_fs_intro_end` | 1.8 s | bonusScreenDismiss | Bonus intro Continue | Bonus | Yes |
| `td_fs_intro_start` | 3.8 s | bonusScreenEnter | Bonus intro screen | Bonus | Yes |
| `td_fs_start_chests` | 2.0 s | reelhouseEvent chest_spawn | Reelhouse Spine event | Bonus | Yes |
| `td_fs_start_keys` | 2.0 s | reelhouseEvent key_spawn | Reelhouse Spine event (`sound.reelhouseEvent`) | Bonus | Yes |
| `td_game_enter` | 5.1 s | startGame (fade in 1.5 s) | Press to continue (`sound.start`) | Base | Yes |
| `td_girl_gigle` | 1.2 s | characterEvent giggle | Mascot Spine event | Base | Yes |
| `td_girl_takes_mug` | 6.5 s | characterEvent mug | Mascot Spine event | Base | Yes |
| `td_mult_activate_0` | 3.6 s | chestActivate #1 | Chest unlock (`sound.chestActivate`) | Bonus | Yes |
| `td_mult_activate_1` | 2.9 s | chestActivate #2 | Chest unlock (`sound.chestActivate`) | Bonus | Yes |
| `td_mult_activate_2` | 3.6 s | chestActivate #3 | Chest unlock (`sound.chestActivate`) | Bonus | Yes |
| `td_mult_activate_3` | 3.8 s | chestActivate #4 | Chest unlock (`sound.chestActivate`) | Bonus | Yes |
| `td_mult_activate_4` | 3.8 s | chestActivate #5 | Chest unlock (`sound.chestActivate`) | Bonus | Yes |
| `td_mult_boart_intro` | 2.5 s | chestFinalWinIntro | Chest finale (`sound.chestFinalWinIntro`) | Bonus | Yes |
| `td_mult_win_adds_0` | 2.6 s | chestFinalWinAdd #1 | Chest multiplier applied (`sound.multiplierAdd`) | Bonus | Yes |
| `td_mult_win_adds_1` | 2.8 s | chestFinalWinAdd #2 | Chest multiplier applied (`sound.multiplierAdd`) | Bonus | Yes |
| `td_mult_win_adds_2` | 3.0 s | chestFinalWinAdd #3 | Chest multiplier applied (`sound.multiplierAdd`) | Bonus | Yes |
| `td_mult_win_adds_3` | 2.8 s | chestFinalWinAdd #4 | Chest multiplier applied (`sound.multiplierAdd`) | Bonus | Yes |
| `td_mult_win_adds_4` | 2.9 s | chestFinalWinAdd #5 | Chest multiplier applied (`sound.multiplierAdd`) | Bonus | Yes |
| `td_mult_win_chest_open_0` | 3.2 s | chestOpen #1 | Chest opens (`sound.chestOpen`) | Bonus | Yes |
| `td_mult_win_chest_open_1` | 2.9 s | chestOpen #2 | Chest opens (`sound.chestOpen`) | Bonus | Yes |
| `td_mult_win_chest_open_2` | 3.3 s | chestOpen #3 | Chest opens (`sound.chestOpen`) | Bonus | Yes |
| `td_mult_win_chest_open_3` | 3.2 s | chestOpen #4 | Chest opens (`sound.chestOpen`) | Bonus | Yes |
| `td_wincap_bigwin` | 6.9 s | bigwinLevel big | Spine `big` event of the win screen | Base | Yes |
| `td_wincap_end` | 2.6 s | bigwinOutro | Win screen end | Base | Yes |
| `td_wincap_epicwin` | 3.3 s | bigwinLevel epic | Spine `epic` event | Base | Yes |
| `td_wincap_maxwin` | 4.4 s | bigwinLevel max | Spine `max` event / Max Win | Base | Yes |
| `td_wincap_megawin` | 2.7 s | bigwinLevel mega | Spine `mega` event | Base | Yes |
| `td_wincap_start` | 2.5 s | bigwinIntro | Win screen start (`showWinSequence`) | Base | Yes |
| `td_wincap_superwin` | 3.1 s | bigwinLevel super | Spine `super` event | Base | Yes |

### Music mix

Base and bonus each have an ambience loop and three music layers, all started together and mixed by volume:

- **Start**: `td_game_enter`, base ambience and base layer 0 fade in (1.5 s and 4 s).
- **Base wins**: layer 1 comes in on any line win, layer 2 from a 10× line; both fade out 8 s after the last win.
- **Big screens**: bonus intro and Total Win lower every audible layer to 0.05.
- **Mode change**: entering or leaving the bonus crossfades ambience and layer 0 (500 ms) and restarts the incoming layers from the beginning.
- **Bonus**: layer 1 comes in on a win, layer 2 when a chest unlocks.

## 4. Spine animation clips

### `td_backgrounds.skel`

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `0_base_enter` | Yes | Yes — same clip and call site |
| `0_base_idle` | Yes | Yes — same clip and call site |
| `0_bonus_enter` | Yes | Yes — same clip and call site |
| `0_bonus_idle` | Yes | Yes — same clip and call site |
| `1_zoom_in` | Yes | Yes — same clip and call site |
| `1_zoom_out` | Yes | Yes — same clip and call site |
| `3_shake` | Yes | Yes — same clip and call site |
| `4_mobile` | Yes | Yes — same clip and call site |

### `td_character.skel`

Spine events: `giggle`, `mug`.

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `idle` | Yes | Yes — same clip and call site |
| `win` | Yes | Yes — same clip and call site |

### `td_reelhouse.skel`

Spine events: `chest_spawn`, `key_spawn`, `update_final_win_0`, `update_final_win_1`, `update_final_win_2`, `update_final_win_3`, `update_final_win_4`.

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `0_mobile` | Yes | Yes — same clip and call site |
| `1_game_enter` | Yes | Yes — same clip and call site |
| `1_game_enter_mobile` | Yes | Yes — same clip and call site |
| `1_idle` | Yes | Yes — same clip and call site |
| `1_splash_intro` | Yes | Yes — same clip and call site |
| `1_splash_intro_mobile` | Yes | Yes — same clip and call site |
| `2_base_enter` | Yes | Yes — same clip and call site |
| `2_base_exit` | Yes | Yes — same clip and call site |
| `2_bonus_enter` | Yes | Yes — same clip and call site |
| `2_bonus_exit` | Yes | Yes — same clip and call site |
| `3_push` | No | Unused by the reference too |
| `3_shake` | Yes | Yes — same clip and call site |
| `3_skip` | Yes | Yes — same clip and call site |
| `3_spin_start` | Yes | Yes — same clip and call site |
| `4_finalwin` | Yes | Yes — same clip and call site |
| `5_activate_0_0` | Yes | Yes — same clip and call site |
| `6_activate_0_1` | Yes | Yes — same clip and call site |
| `7_activate_0_2` | Yes | Yes — same clip and call site |
| `8_activate_0_3` | Yes | Yes — same clip and call site |
| `9_activate_0_4` | Yes | Yes — same clip and call site |
| `10_activate_1_0` | Yes | Yes — same clip and call site |
| `11_activate_1_1` | Yes | Yes — same clip and call site |
| `12_activate_1_2` | Yes | Yes — same clip and call site |
| `13_activate_1_3` | Yes | Yes — same clip and call site |
| `14_activate_1_4` | Yes | Yes — same clip and call site |
| `15_activate_2_0` | Yes | Yes — same clip and call site |
| `16_activate_2_1` | Yes | Yes — same clip and call site |
| `17_activate_2_2` | Yes | Yes — same clip and call site |
| `18_activate_2_3` | Yes | Yes — same clip and call site |
| `19_activate_2_4` | Yes | Yes — same clip and call site |
| `20_activate_3_0` | Yes | Yes — same clip and call site |
| `21_activate_3_1` | Yes | Yes — same clip and call site |
| `22_activate_3_2` | Yes | Yes — same clip and call site |
| `23_activate_3_3` | Yes | Yes — same clip and call site |
| `24_activate_3_4` | Yes | Yes — same clip and call site |
| `25_activate_4_0` | Yes | Yes — same clip and call site |
| `26_activate_4_1` | Yes | Yes — same clip and call site |
| `27_activate_4_2` | Yes | Yes — same clip and call site |
| `28_activate_4_3` | Yes | Yes — same clip and call site |
| `29_activate_4_4` | Yes | Yes — same clip and call site |
| `30_reel_0_chest_activate` | Yes | Yes — same clip and call site |
| `30_reel_0_chest_idle` | Yes | Yes — same clip and call site |
| `30_reel_0_chest_open` | Yes | Yes — same clip and call site |
| `30_reel_0_chest_open_idle` | Yes | Yes — same clip and call site |
| `31_reel_0_chest_finalwin` | Yes | Yes — same clip and call site |
| `32_reel_1_chest_activate` | Yes | Yes — same clip and call site |
| `32_reel_1_chest_idle` | Yes | Yes — same clip and call site |
| `32_reel_1_chest_open` | Yes | Yes — same clip and call site |
| `32_reel_1_chest_open_idle` | Yes | Yes — same clip and call site |
| `33_reel_1_chest_finalwin` | Yes | Yes — same clip and call site |
| `34_reel_2_chest_activate` | Yes | Yes — same clip and call site |
| `34_reel_2_chest_idle` | Yes | Yes — same clip and call site |
| `34_reel_2_chest_open` | Yes | Yes — same clip and call site |
| `34_reel_2_chest_open_idle` | Yes | Yes — same clip and call site |
| `35_reel_2_chest_finalwin` | Yes | Yes — same clip and call site |
| `36_reel_3_chest_activate` | Yes | Yes — same clip and call site |
| `36_reel_3_chest_idle` | Yes | Yes — same clip and call site |
| `36_reel_3_chest_open` | Yes | Yes — same clip and call site |
| `36_reel_3_chest_open_idle` | Yes | Yes — same clip and call site |
| `37_reel_3_chest_finalwin` | Yes | Yes — same clip and call site |
| `38_reel_4_chest_activate` | Yes | Yes — same clip and call site |
| `38_reel_4_chest_idle` | Yes | Yes — same clip and call site |
| `38_reel_4_chest_open` | Yes | Yes — same clip and call site |
| `38_reel_4_chest_open_idle` | Yes | Yes — same clip and call site |
| `39_reel_4_chest_finalwin` | Yes | Yes — same clip and call site |
| `41_fade_extras` | Yes | Yes — same clip and call site |
| `payline_0` | Yes | Yes — same clip and call site |
| `payline_1` | Yes | Yes — same clip and call site |
| `payline_2` | Yes | Yes — same clip and call site |
| `payline_3` | Yes | Yes — same clip and call site |
| `payline_4` | Yes | Yes — same clip and call site |
| `payline_5` | Yes | Yes — same clip and call site |
| `payline_6` | Yes | Yes — same clip and call site |
| `payline_7` | Yes | Yes — same clip and call site |
| `payline_8` | Yes | Yes — same clip and call site |
| `payline_9` | Yes | Yes — same clip and call site |
| `payline_10` | Yes | Yes — same clip and call site |
| `payline_11` | Yes | Yes — same clip and call site |
| `payline_12` | Yes | Yes — same clip and call site |
| `payline_13` | Yes | Yes — same clip and call site |
| `payline_14` | Yes | Yes — same clip and call site |

### `td_screens.skel`

Spine events: `big`, `epic`, `max`, `mega`, `super`.

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `addfs` | Yes | Yes — same clip and call site |
| `bigwin` | Yes | Yes — same clip and call site |
| `bonus_intro` | Yes | Yes — same clip and call site |
| `bonus_outro` | Yes | Yes — same clip and call site |
| `epicwin` | Yes | Yes — same clip and call site |
| `maxwin` | Yes | Yes — same clip and call site |
| `megawin` | Yes | Yes — same clip and call site |
| `smallwin` | Yes | Yes — same clip and call site |
| `superwin` | Yes | Yes — same clip and call site |
| `super_intro` | Yes | Yes — same clip and call site |
| `super_outro` | Yes | Yes — same clip and call site |
| `total_win_end` | Yes | Yes — same clip and call site |
| `total_win_idle` | Yes | Yes — same clip and call site |
| `total_win_start` | Yes | Yes — same clip and call site |

### `td_symbols_bonus.skel`

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `bonus_land` | Yes | Yes — same clip and call site |
| `bonus_spin` | Yes | Yes — same clip and call site |
| `bonus_static` | Yes | Yes — same clip and call site |
| `bonus_win` | Yes | Yes — same clip and call site |

### `td_symbols_high.skel`

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `h1_land` | Yes | Yes — same clip and call site |
| `h1_spin` | Yes | Yes — same clip and call site |
| `h1_static` | Yes | Yes — same clip and call site |
| `h1_win` | Yes | Yes — same clip and call site |
| `h2_spin` | Yes | Yes — same clip and call site |
| `h2_static` | Yes | Yes — same clip and call site |
| `h2_win` | Yes | Yes — same clip and call site |
| `h3_spin` | Yes | Yes — same clip and call site |
| `h3_static` | Yes | Yes — same clip and call site |
| `h3_win` | Yes | Yes — same clip and call site |
| `h4_spin` | Yes | Yes — same clip and call site |
| `h4_static` | Yes | Yes — same clip and call site |
| `h4_win` | Yes | Yes — same clip and call site |

### `td_symbols_low.skel`

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `l1_spin` | Yes | Yes — same clip and call site |
| `l1_static` | Yes | Yes — same clip and call site |
| `l1_win` | Yes | Yes — same clip and call site |
| `l2_spin` | Yes | Yes — same clip and call site |
| `l2_static` | Yes | Yes — same clip and call site |
| `l2_win` | Yes | Yes — same clip and call site |
| `l3_spin` | Yes | Yes — same clip and call site |
| `l3_static` | Yes | Yes — same clip and call site |
| `l3_win` | Yes | Yes — same clip and call site |
| `l4_spin` | Yes | Yes — same clip and call site |
| `l4_static` | Yes | Yes — same clip and call site |
| `l4_win` | Yes | Yes — same clip and call site |
| `l5_spin` | Yes | Yes — same clip and call site |
| `l5_static` | Yes | Yes — same clip and call site |
| `l5_win` | Yes | Yes — same clip and call site |

### `td_symbols_wild.skel`

| Clip | Used in M2 | Same as the reference |
| --- | --- | --- |
| `wild_land` | Yes | Yes — same clip and call site |
| `wild_spin` | Yes | Yes — same clip and call site |
| `wild_static` | Yes | Yes — same clip and call site |
| `wild_win` | Yes | Yes — same clip and call site |

Clip call sites: symbols in `src/framework/presentation/board.ts` and `skin.ts`; background, reelhouse, keys, chests and screens in `src/games/tavern/effects.ts`; paylines in `payline.ts`; the mascot in `mascot.ts`.

## 5. Items that differ from the reference

| Item | Difference | Reason |
| --- | --- | --- |
| `cues/*.mp3` | Not in the reference | Local fallback so the game still has basic sounds if the sprite cannot load. |
| `paperclip-C0ObTQLL.webp`, `poweredby-D9-5QAZx.webp`, `hud/share.svg` | Not shown | They belong to the provider platform's share/replay pages, not to the game. |
| `hud/stop.svg` | Not shown | Running autoplay shows the remaining count on Spin, as the reference does. |
| Fonts | Same files | Loaded through CSS `@font-face` and the `ui` resource bundle. |

## 6. File checksums (SHA-256)

| File | SHA-256 |
| --- | --- |
| `assets/bonus_static.webp` | `2de6779b59d5e3e366ecb303732932c4403a796631b863e9fd58f601432f2157` |
| `assets/continue.webp` | `0cda9fffffe0fce5301084ddd30a0a6c87a0ef29374409476780f7edcfc6f458` |
| `assets/h1_static.webp` | `2827a91b98bc68a214ec160250466fd8bf6655d4313a3e8ff63cd448f4acce62` |
| `assets/h2_static.webp` | `cf86f1cffb09d323bb92ac9aab6650299bbd48966151de3f9c43c19a930100f0` |
| `assets/h3_static.webp` | `45ba8eabb19d9c7edf1a4f435de7353f43ff75fc72dcce0cc351abce2dbae0fd` |
| `assets/h4_static.webp` | `147f6458be17f73b43fb702e711053a4b74b83671ab38bb6dc2fb9a149615002` |
| `assets/hd/td_master.atlas` | `4814913d453854d20d82642f2a15eca3eede6d5e97ce646f0a23f2e87cf12754` |
| `assets/hd/td_master.webp` | `dee1041bf4a9be8b3daf62ff15ff764de28e0cb76f66e4f9274dad1e94962199` |
| `assets/hd/td_master_2.webp` | `84f60163b6be8a817e9e5a8355188aa09dd03c18922c2b1ec415b4b25b13201d` |
| `assets/hd/td_master_3.webp` | `b119528cd7e08541b2d8854599ade311f92405730fd44ecb72745724a2bff020` |
| `assets/hd/td_master_4.webp` | `1f3db60e168d0019d757d37d25b095b2aa7c1fc31a17d571f33c064876666fd3` |
| `assets/hd/td_master_5.webp` | `ca8f06f5544ee030d359bdcd5d460f34389bec999372a91c90f32baa55290e8a` |
| `assets/l1_static.webp` | `f588197cd9896225fcc5aa6f54e6b3e95afb12dc9b86513114af4104e81a8412` |
| `assets/l2_static.webp` | `ecf9131855e07ac26d54c3085d2b811c495076a67bf16fc21ef38dd04258837a` |
| `assets/l3_static.webp` | `446b272d7eb935916743a254ab97712fd3e3b65e78e7a18e8c3480d2a290355f` |
| `assets/l4_static.webp` | `bbb885946c1bb686b4c1c8b8f9fbd550714c6f72c264e888b4c2917e91b01fcc` |
| `assets/l5_static.webp` | `139d6bd5b4fe90836197cb98212395608fcc37ce583a9836c8d64ac743b237bf` |
| `assets/outfit-500-CMfhJlfe.woff2` | `e5776ecb08ef257d16da5ea48b27cc6e719c274ff7f9985e2c2b5a74d9a83126` |
| `assets/outfit-600-DuSOvJ_5.woff2` | `df027166d7f19d4fc5212fcc62368d53f3c0ad36c3f10f899e29385401e77f17` |
| `assets/outfit-700-D9T176aR.woff2` | `da98d434ebe44b2c8b42f2f26edc4b7e65300a089419ed041942a7299896a06f` |
| `assets/outfit-800-ySok2YOt.woff2` | `0bc360ab632c415781c90bcd3309ac313c828dfb2011e3ec43cb0c3aee5acc66` |
| `assets/outfit-v11-latin_latin-ext-300-COlrd1hX.woff2` | `89701b515a7936dbd47d5927a8fa56e17120c4854ed882c78af4b3cb4d02b87f` |
| `assets/outfit-v11-latin_latin-ext-regular-BDXaL9-u.woff2` | `7de43d76771c6ba4c168e3af0364a0d500db46647eee134d28181dd16c998dec` |
| `assets/paperclip-C0ObTQLL.webp` | `fe72aecd65659bd14c025eedfaee7ec57a4f313338ff1026fbbafc2b55c99705` |
| `assets/paperclip-rMFDawAD.gif` | `f5ea52934ec8e25349f88b3cfb84cee9b03e7264c177a19e3f5633320b1e2e69` |
| `assets/paperclip_full_logo.webp` | `1c151c07bd81b8e640f8f8c0bfd7de205e9ca09d56b0d691aca9cfe30eed5c0b` |
| `assets/poweredby-D9-5QAZx.webp` | `b6092417e2e9883c99e2fa00b866bf8a996075268ca0c034606a0dac9f8c133f` |
| `assets/sd/td_master.atlas` | `65597f9e55b4b573c612529a86c8d859df350e41cc91b0c5ecc4f08448cc2f70` |
| `assets/sd/td_master.webp` | `3d7d764e6bcab77bc82c1de7abb7338feca30c55c8aa159bcf99875994857efd` |
| `assets/td_ante.webp` | `e76ef17da158c2f14f3c5f0d40ea4d5ca6f6861fd3ed7f7b1e1b4f2d811410dc` |
| `assets/td_backgrounds.skel` | `5f8bff30c0a431e17fdabfc955c666b385712f06989736568feb98a633a346ce` |
| `assets/td_bonus.webp` | `c063b60febc63cad1db18eb79ab3202a3ebb5185784ae911ea46c18fbb8f41d4` |
| `assets/td_card_character.webp` | `618e3dee237111455656c5f7387efdff7d73a0fb91249c9b34d4f670ea4326fe` |
| `assets/td_character.skel` | `af0426ebe2b2880b3c8362b14abfde9e315ae533643b03c823ed1f8671cb6945` |
| `assets/td_gold.webp` | `8f81ea9c51455e9e47913c349eba142bd90b48b58702709c1d3cdeb6c0ca7d7e` |
| `assets/td_gold.xml` | `2a3ff12fb4084b90718038a8a0b8dd7638bf028378d468bcf1165f40e507b5e9` |
| `assets/td_green.webp` | `2b81ed5aaa94d5ba7fb7874a06b1fdaac6b0e2da95c07c9fbae813d3a4d0e709` |
| `assets/td_green.xml` | `7c679c4c059e0d65cc02bc9d739936f3219269bb7f531cae9567788e13ad278f` |
| `assets/td_loader.webp` | `33aa0a5757d0ee238002fb083ec9a0c01b71a9061581d9ac5a67ba54f288b98e` |
| `assets/td_loader_bg.webp` | `dd6c1c1fe2ceed45c7c9cde177d3aaf4a0bbaa3677ee95986ff2f1e77616ec2e` |
| `assets/td_red.webp` | `955d663ad20bc4da092d9854849a87d45995a362acdbc37bb5f804a6adffcdb5` |
| `assets/td_red.xml` | `ee334a75a34ded58c6203c49262f31398b6044e3961d850bdce911cbecb3f99e` |
| `assets/td_reelhouse.skel` | `4d77780458b05ec177288b995a17d24a73e4a5f0a46c47c99b9a7408811a1eee` |
| `assets/td_screens.skel` | `89f2a71f5919b1f6dcd4a8962f704afefc62f2c884a0df5f8d25b88f98008de2` |
| `assets/td_sounds.json` | `0e2f9a780fbc3c6928294eafd0c9173c18ea5a5440ac4cc3b55591d5d858293d` |
| `assets/td_sounds.mp3` | `e7afc97efac0eb9787019fae6e7ee43df9cb3fdcb2397a87885c27813a41144b` |
| `assets/td_sounds.ogg` | `450843a128b8cd88fda47bc905ff30057495780653c4d87e60bc7bb8bbbc2deb` |
| `assets/td_super.webp` | `fc007f0c8d4d9baa5f41c3ff008143d5a100cde01600666ad82d602d31ea67e8` |
| `assets/td_superante.webp` | `f218c40b725ce565fb21ed43497b44fef9547b8c2ae6c930724c5ed4c0adb445` |
| `assets/td_symbols_bonus.skel` | `f6f097a70ae387c95f69370506faa9f09b65d4d236ff87d2b08f4637408057dc` |
| `assets/td_symbols_high.skel` | `8e7d5ad074950e4bfdddfa6e7d2388c576ad7cb1bc045a781d7ce893490e5f9b` |
| `assets/td_symbols_low.skel` | `6017fa902f31119858118eeaf59c45729bc6905f15892c02e60b9eefccb9391d` |
| `assets/td_symbols_wild.skel` | `77c4b1c621bf018308b4a3ebe3fc6d82b283d4111db3456781e7d49b3cdcdbd7` |
| `assets/wild_static.webp` | `0afb7ecb465a43f8eb369e1b29a565ff89552cf30ca715ca077e6014a9148750` |
| `cover/taverndrop.webp` | `a2ba79639572310a41a02cd27cf150fdb582f296067884494db3b0ea25626e0e` |
| `favicon.png` | `66b1e9793934a85aa17607c7c9e14a5cd0cfc7ed1c4650cbc2cec168d5986fb9` |
| `hud/autoplay-ready.svg` | `8e17857ec8d98a7ea3a702e3d36237ed519c22af68f2d406408392f4e2c9b6fb` |
| `hud/autoplay.svg` | `bc37a10c1852ba5eb08c50cec01eafa3e6cadb3c4b47a93eb6f252eeda1acc00` |
| `hud/bet-down.svg` | `a73679c3501b5d2d4c281497774dd85b21710c3e80a716e298299392a8f90906` |
| `hud/bet-up.svg` | `fa6292511dd24dc13bb5ca15b46a88e0f423d091dd7e3c2ddef43be98e22f163` |
| `hud/close.svg` | `01836e24351c93bb921ffbd23432b9b890f9c45f037759b9a43c1c670140fa82` |
| `hud/effects-muted.svg` | `d91120bb17dd27cae519bbd531b85a8810c41d313387bfcfdd8dbeaf5bdca1e6` |
| `hud/effects.svg` | `001dd15f6c104853e65ccd77984279a9ef8958391d59e628db8daf2173ec63b7` |
| `hud/feature-buy.svg` | `2fd8ccd6af0a3b5ef8cd51e67ba713b7074d20c866d9dc04cd624dcbf22af177` |
| `hud/info.svg` | `b1bcec24c51d8bd3735f8dfc6cdbc70a200166edf9f8b8769ba3dd7fd38c29d2` |
| `hud/menu.svg` | `69593e8a0f1860d9eb040eb9ccf0db9e3556077a6b3629ab8c0bda1ee5b7c5d5` |
| `hud/music-muted.svg` | `eace199cefa78423faa367a666d2cf1bb4aadf91f34def08f88dd198bd78975e` |
| `hud/music.svg` | `27de8527fde84b861083f9db6717dbe0d6717b25ff51ef558287c668510f630d` |
| `hud/share.svg` | `cd88171664aca9ed9ec9785a02c8280d21323116bef89a672437d675b157179d` |
| `hud/skip.svg` | `e22a74eacf43f0554b4aa6fbe6523631171a377ec9a4825b51ba04c3ad9e76d5` |
| `hud/spin.svg` | `06f5f537138fb1660fc2263f7cfcde75c3df4bb70cb62f20923fd5402594ad87` |
| `hud/stop.svg` | `f36ce31b7d00ad4f94430bf7a3bcfd10d7a7382cd9f62dc3a21ab1f0da876660` |
| `hud/turbo.svg` | `77a34f26f0a942939023869611aa39fd5586b2de11c6b38b52b8fc90e228f03f` |
| `cues/chest.mp3` | `3672242f29fc4fbf6275d3982cc7b482c67a6dba757631093aedfc3f750c3d36` |
| `cues/entry.mp3` | `88816c3e5921fa180dd3ef48badb51f813974791e43be3143274da34b311ede8` |
| `cues/start.mp3` | `6301fa68c0c9aeedb110f7d72966b2e235bbcd94dc49eafd18828655a00fc28e` |
| `cues/stop.mp3` | `d380413bdd893808b585364edb177edc19585b72f0916bd9aa965fd734a956dc` |
| `cues/win.mp3` | `de586b3b84f21870bbdf884c0ecd204946d07ac2f4e656572db1faf18556ac7c` |

To recheck the `assets/` files against the provider's CDN, see the audit steps in the asset inventory (`node scripts/audit-tavern-assets.mjs <cdn-assets-url>`).
