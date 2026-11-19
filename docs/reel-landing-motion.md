# Reel landing / bounce

The existing motion only moved reel/symbol positions along a small sine wave. It did not reproduce the reference's squash/stretch, and the drop moved upward after impact without the initial downward compression.

The downloaded Tavern reference reveal implementation was inspected locally in `output/load-audit/original.pretty.js` (diagnostic artifact, not distributed source). Its reveal applies a separate relative scale sequence: 1.10 × 0.88 over 70 ms, 0.94 × 1.06 over 90 ms, and back to baseline over 120 ms. The sequence starts around 80 ms before the reveal ends. These motion observations informed the new shared implementation; the provider implementation is not copied into the framework. Access to the current reference demo was attempted again in the browser, but a completed interactive spin was not captured in this check.

`presentation.landing` in each game JSON now controls `compressMs`, `stretchMs`, `settleMs`, `leadMs`, `squashX/Y` and `stretchX/Y`. Both Tavern and the 3×3 example use the same 280 ms relative deformation. Existing `normal.bouncePx` and `drop.bouncePx` control positional motion; drop settling now allows the full configured deformation to finish. The glyph-only 3×3 example also has 10px mask padding to keep the rebound visible.

`landing-motion.ts` contains renderer-independent interpolation. `BoardView` wraps each symbol in a carrier anchored at bottom center; it never overwrites the symbol factory's authored scale. Bounds for edge fitting account for carrier deformation. Skip, snapshot replacement and a new spin restore every carrier to exactly 1×1. A generation guard stops an old normal-settle callback from moving a newer board.

Verification: tests cover the compression/stretch/rest phases, invalid configuration, and actual Pixi normal/drop motion with Skip. The browser fixture deliberately gives authored symbols a 1.15 scale and verifies it remains 1.15 while the carrier returns to 1×1. The local API/UI smoke checks continue to use recorded server outcomes; bounce does not alter results or payouts.

## Drop entry clearance

`presentation.drop.enterSpawnClearancePx` adds clearance above the default entry position of one cell pitch above the reel. It defaults to zero. Tavern Drop uses 48 px of extra clearance, placing incoming cells at −158 px with its 110 px pitch. The shared board keeps each incoming tile invisible until its nominal cell begins crossing the top of the reel, independent of oversized effects such as Scatter glow. Exit motion uses the existing start positions, and landed Scatter Win can still use the foreground layer.
