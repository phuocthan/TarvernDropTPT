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

## Recheck the reference on another machine

Pull `main` in the development repo and run the audit from its root with Node.js 22+. The checked-in `public/tavern-assets/assets/` directory is the baseline. Start with a clean checkout so the old hashes reflect the version on GitHub.

1. Open the reference demo and use the browser's Network panel to identify the current public directory for a runtime asset such as `td_sounds.ogg` or `td_reelhouse.skel`. Use the directory ending in `/assets/`, without any session query string. Loading, playing a demo spin and opening the bonus screens can expose different asset requests.
2. Run the audit with that observed directory. The URL below is the known v13 example. Replace it if the demo loads a different version.

```powershell
node scripts/audit-tavern-assets.mjs "https://paperclip.live.engine.io/tavern-drop/v13/assets/"
```

3. Read `.runtime/tavern-asset-audit/<run-id>/report.json`. It records file sizes and SHA-256 before/after. `changed` means bytes differ at the same path, `missing` means a baseline path was absent from the supplied source, and `error` records a failed request or unexpected response. A missing path can also mean the provider renamed the file. Downloaded files are saved in the same run's `assets/` directory for local inspection.

To check new or renamed files found in Network, append their relative paths to the command after the URL. A successfully fetched path absent from the baseline is reported as `added`. For an asset folder you already collected, pass the local folder instead. The folder should have the same layout with `hd/` and `sd/` directly inside it. Every supported asset file in that folder is included in the comparison.

```powershell
node scripts/audit-tavern-assets.mjs "D:/captures/tavern-new/assets"
```

The URL mode checks the 54 baseline paths plus explicitly supplied paths. It does not crawl the CDN to discover other files. HUD SVGs, cover, favicon and local audio excerpts live outside this baseline. The audit writes to the ignored `.runtime/` directory and leaves the game's assets intact.

The latest public-demo recheck observed `v13/assets/` again and verified all 54 baseline files by SHA-256. No changed, added, missing or failed files were reported. The candidate snapshot and raw report are kept in the local audit directory.
