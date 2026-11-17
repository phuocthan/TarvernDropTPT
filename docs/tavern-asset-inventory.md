# Tavern Drop v13 reference assets

The reference runtime asset files live in `public/tavern-assets/assets/`. The reference HUD artwork lives in `public/tavern-assets/hud/`. The development viewer and the game use files from the same asset tree.

| Inventory | Checked-in files |
| --- | --- |
| Spine | Eight binary skeletons for backgrounds, character, reelhouse, screens, low/high symbols, Wild and Scatter |
| Atlas | HD Spine atlas and five WebP pages. SD Spine atlas and its one WebP page. The current game and animation player use HD. |
| Typography | Six Outfit WOFF2 faces and the three bitmap payout fonts with XML descriptors and matching textures |
| Audio | Original OGG, MP3 and JSON sound sprite with 66 cues. The separate `cues/` directory holds local fallback files. |
| Artwork | Loading art, brand marks, feature cards, static symbol previews and Continue art |
| HUD | 17 SVGs recovered from the original UI bundle, including menu/open-close, both bet arrows, spin/stop/skip, autoplay and its ready state, Turbo, feature-buy, Info, Share and audio states |

All 54 files under `assets/` matched the provider's Tavern Drop v13 CDN byte-for-byte by SHA-256. The SVGs were matched against the live HUD and then extracted from its bundle. The development repo also contains a cover image and favicon. The provider's application bundle and shared links' logos for other studios are outside the Tavern runtime asset inventory.

Open `/?game=viewer` locally or on Railway to play animation clips, preview each of the 66 sound cues by offset and duration, or browse the gallery. The client milestone export has its own file list.
