# Milestone 1 initial asset specifications

| Category | Delivery format | Runtime check |
| --- | --- | --- |
| Static artwork and textures | WebP or PNG with transparency where needed. Deliver the intrinsic dimensions, intended anchor and design resolution. Supply UI and brand variants for portrait and landscape. | Verify image decoding, alpha, layout and readability at both aspect ratios. |
| Spine and atlases | Spine 4.2 export, binary `.skel`, matching `.atlas` and every case-sensitive texture page. Supply the source export version, animation names, skins, origin and intended stage scale. | Load with PixiJS 8 and `@esotericsoftware/spine-pixi-v8` 4.2.120. Play intended tracks from the same export and inspect setup-pose bounds, attachments and loop behavior. |
| Symbol animation | Document `spin`, `land`, `idle` and `win` mappings for each symbol, including Wild and Scatter. Supply a common cell anchor and any intentional overscan. | Inspect the top and bottom row, normal and Turbo landings, Scatter trigger hold and win highlights. |
| Fonts | WOFF2 web fonts, weights and glyph coverage. Supply every FNT/texture pair if using bitmap payout digits. | Verify labels and currency, decimal and multiplier glyphs. |
| Music and SFX | Individual URLs or an audio sprite. For a sprite provide OGG and MP3 fallback plus JSON mapping each name to `[offsetMs, durationMs, optionalLoop]`. | Decode supported formats, check every cue range, test representative music and SFX, and verify mute and looping. |
| Branding | Transparent production logo, light/dark variants if needed, control icons, approved splash/Terms copy and permission for the intended delivery channel. | Approve the loading/intro and both orientations against the client reference. |

## Development reference pack

The development checkout contains eight Spine exports, five WebP atlas pages, six Outfit WOFF2 files, three bitmap payout fonts and 66 named audio slices. The latest slice ends at 627.125 s in the 629 s OGG. The development build presents the reference assets for comparison. The public milestone preview contains Pixi-drawn placeholders.

Representative playback cases are loading and welcome, base reels, bonus intro, chest open/idle/finalwin, all four major win tiers, and Total Win intro/idle/outro. The development browser suite exercises these paths with fixture-controlled outcomes. Inspect the framework preview by starting one spin on each board. It uses a separate mock wallet per route.

Approval of the final client art, branding and distribution rights remains open. Acceptance of asset verification applies to the required files in the asset pack the client approves for M1.
