# Current verification

Verified in this cloud instance with Node 24.22.1 and system Chromium:

- Frozen install: `npm ci --cache /tmp/tavern-npm` succeeded.
- `npm run build`: TypeScript checks and Vite production bundle succeeded.
- `npm test`: 11 domain/server checks passed, including Wild substitution, no/single/multiple-line boards, unique row collection, both feature modes, bounded retriggers, idempotency and cap accounting.
- `npm run test:browser`: 5 Chromium scenarios passed: real API boot/spin/rules, fixture-driven Drop purchase/collection/completion, portrait sizing, lost-response recovery, and landscape controls within viewport. The recovery case was also rerun after extending it to reload the page with a saved pending command.
- Production server: static page, API session, spin and same-ID retry were exercised over HTTP successfully.

Screenshots: [portrait](screenshots/mobile.png), [landscape](screenshots/landscape.png). They document the placeholder template skin, not visual parity with the original game.

Not verified: original game/Help, provider math, original artwork or Spine playback, real backend integration, durable recovery after server restart, Railway deployment status, and public URL. Browser fixture checks demonstrate our implementation behavior; they are not evidence of reference-game rules.
