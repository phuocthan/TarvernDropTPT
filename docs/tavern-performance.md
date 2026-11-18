# Tavern Drop render performance

## Brand intro startup

The brand loader exposes `waitForIntro()` separately from `ready()`. Tavern downloads startup resources and opens the API session concurrently during the intro, then waits for the configured GIF duration and two animation frames before creating the game DOM or WebGL renderers. The prepared session snapshot is passed to the controller so mounting the board does not request game-info again.

Only the visible scene's first frame must render before the loader fades. The scene ticker starts after the landing has painted, so textures first used by its animation do not extend the fade. Hidden reels and the desktop mascot upload their textures when the user presses Continue, before the reveal animation begins. The extra mascot renderer is created after the landing paints. Shop image prefetch and the optional UI font also start after the landing; neither can hold the loader open.

Native Spine symbols use the shared atlas. The separate static symbol bundle loads only for the fallback path, including reduced motion; it is no longer a startup bundle. Paytable images are requested when their HTML is shown.

Loading progress is monotonic and interpolated over 300 ms, with immediate updates for reduced motion. Startup resources occupy 0–70%, resources plus the session reach 75%, and scene setup and its first frame occupy 80–95%. Only `ready()` publishes 100% to indicate landing readiness. GIF decode failures fall back to the static brand logo and do not prevent startup.

A Chrome headless local check on 2026-11-18 recorded GIF decode at 59 ms, the end of its 1600 ms motion at 1659 ms, and the first WebGL context request at 1701 ms. No tasks of at least 50 ms started within that GIF motion window. The earlier production audit had a 628 ms task starting at 1147 ms while the GIF was still moving. These are diagnostic samples on this machine, not a claim about every displayed GIF frame or target device.

Three Chrome headless desktop runs per version on 2026-11-18 measured loader removal after the visible scene's first frame: the median decreased from 3299.8 ms to 2457.9 ms (about 26%). The new range was 2373.7–2490.6 ms. The 1600 ms GIF duration is preserved. This measures arrival at the landing, not completion of the subsequent Continue transition; hidden GPU uploads now happen during entry. Host load and GPU/cache conditions affect these local measurements.

`tests/browser/loading.spec.ts` checks resource loading while the GIF request is held, the intro-to-WebGL ordering, monotonic progress and landing readiness at 100%, GIF failure, reduced motion, and landing without static-symbol requests while shop/font requests are held. Local validation also covers a single game-info request, mobile v1 paid spin, the 3×3 runtime, TypeScript/production build, and all 39 unit tests.

The portrait layout now draws the Spine mascot in the scene between the background and the reelhouse. It creates the separate mascot renderer only when needed for the landscape overlay and pauses it when returning to portrait. The reel renderer sizes its backing buffer to the displayed board width and device pixel ratio (capped at 2). Symbols advance on the board ticker, and edge alignment runs once in that same tick before rendering.

## Local spot check

Chrome headless used SwiftShader software WebGL. Each sample measured browser animation callbacks for about 2.2 seconds after warming the page. The spin sample uses the demo server's normal board generation, so its exact symbols can differ across runs.

| Viewport | Idle rAF before → after | Spin rAF before → after | Spin frame-time p95 before → after |
| --- | --- | --- | --- |
| 1280 × 720, DPR 1 | 7.9 → 19.8 fps | 8.1 → 21.5 fps | 250 → 66.7 ms |
| 390 × 844, DPR 2 | 3.1 → 21.2 fps | 4.5 → 28.0 fps | 533.3 → 50.0 ms |

The portrait capture recorded zero WebGL draws from a separate mascot canvas after the change. The final capture includes the desktop sharpness adjustment, which sizes the mascot canvas from the combined idle and win bounds and its displayed width. Repeat the performance tests with hardware acceleration on target devices.

## Next checks

1. Collect Chrome Performance/GPU traces on an actual mobile device during Scatter anticipation and the last free spin. Compare p95 frame time and dropped frames at the same viewport and DPR.
2. Compare the checked-in SD atlas with HD on mobile. Verify symbol silhouettes, anchors and payout effects before selecting SD as a mobile asset profile.
3. If GPU draw overhead still dominates, measure static Spine poses as cached sprites. Keep the native Spine tracks for movement, active symbols and win effects.
