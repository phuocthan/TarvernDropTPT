# M2 verification record

| Check | Environment | Result |
| --- | --- | --- |
| Export | `node release/export-milestone-2.mjs` from the source revision in `SOURCE_REVISION` | 222 files listed in `EXPORT_MANIFEST.json` |
| Clean install | Windows 11, Node.js 22, `npm ci` in the exported folder | 62 packages installed |
| Unit tests | `npm test` | 63 passed, 0 failed |
| Type check and build | `npm run build` | Passed |
| Production run | `npm start` with `PORT=4352`, `MOCK_DEBUG_BONUS=1` | Game, `/?game=reuse` and `/?game=viewer` load; no console errors |
| Smoke test | Desktop 1280×720, portrait 390×844, landscape 844×390 | Continue, spin, Feature buy prices, Coming Soon in M3 (no charge), Game Rules. See `screens/` |
| Error states | Bonus debug → Error states | See `error-states/` |
| Long KRW amounts | 320, 360 px portrait, 740×360 landscape, 1280×720 | ₩2,000,000,000 balance/win fit beside the bet arrows; ₩60,000,000 fits its Feature buy card |
| Sound triggers | Recorded cue calls during spins | Spin click, reel start, five reel stops, Scatter land, line win (small/big + line cue with rising pitch), round-end coins |
