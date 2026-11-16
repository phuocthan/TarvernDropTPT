# Milestone 1 initial asset specifications

| Category | Delivery format | Runtime check |
| --- | --- | --- |
| Static artwork and textures | WebP or PNG with transparency where needed. Deliver the intrinsic dimensions, intended anchor and design resolution. Supply UI and brand variants for portrait and landscape. | Verify image decoding, alpha, layout and readability at both aspect ratios. |
| Spine and atlases | Spine 4.2 export, binary `.skel`, matching `.atlas` and every case-sensitive texture page. Supply the source export version, animation names, skins, origin and intended stage scale. | Load with PixiJS 8 and `@esotericsoftware/spine-pixi-v8` 4.2.120. Play intended tracks from the same export and inspect setup-pose bounds, attachments and loop behavior. |
| Symbol animation | Document `spin`, `land`, `idle` and `win` mappings for each symbol, including Wild and Scatter. Supply a common cell anchor and any intentional overscan. | Inspect the top and bottom row, normal and Turbo landings, Scatter trigger hold and win highlights. |
| Fonts | WOFF2 web fonts, weights and glyph coverage. Supply every bitmap font descriptor and texture pair if using bitmap payout digits. | Verify labels and currency, decimal and multiplier glyphs. |
| Music and SFX | Individual URLs or an audio sprite. For a sprite provide OGG and MP3 fallback plus JSON mapping each name to `[offsetMs, durationMs, optionalLoop]`. | Decode supported formats, check every cue range, test representative music and SFX, and verify mute and looping. |
| Branding | Transparent production logo, light/dark variants if needed, control icons, approved splash/Terms copy and permission for the intended delivery channel. | Approve the loading/intro and both orientations against the client reference. |

## Development reference pack

The development checkout contains eight Spine exports, five WebP atlas pages, six Outfit WOFF2 files, three bitmap payout fonts and 66 named audio slices. The latest slice ends at 627.125 s in the 629 s OGG. The development build presents the reference assets for comparison. The public milestone preview contains Pixi-drawn placeholders.

| Evidence | Observed result |
| --- | --- |
| Reference audio integrity | The local OGG and JSON SHA-256 hashes matched the files served by the reference provider. |
| Audio playback probe | Chromium decoded the OGG and MP3 sprite (629 s each) and rendered the reel-start segment to a non-silent PCM buffer. An individual MP3 cue decoded and rendered too. All 66 cue ends fall within both sprite files. |
| Web fonts | Chromium loaded the six Outfit faces at weights 300 through 800. The payout display uses the three packaged bitmap fonts. |
| Spine | Eight skeletons and 141 clip names were inventoried. The development browser suite exercises representative intro, land/win, bonus, chest and Total Win tracks with controlled outcomes. |
| Preview | A production build served both mock boards. A spin on each route returned a board in the configured dimensions and reconciled its separate balance. |

Approval of the final client art, branding and distribution rights remains open. Acceptance of asset verification applies to the required files in the asset pack the client approves for M1.
