# M2 evidence: base-game error states

Captured 21 November 2026 on the local mock build with Bonus debug, 1280×720 (one portrait capture at 390×844). Faults are triggered from **Feature buy → Bonus debug → Error states**. Bonus debug is available only on mock builds.

| File | Step | Result |
| --- | --- | --- |
| `0-bonus-debug-error-states-menu.jpg` | Open the Error states menu | Five fault controls |
| `1-insufficient-balance.jpg` | Set balance to ₩200, then Spin at ₩20,000 | **Insufficient Balance**. No request is sent, and autoplay stops |
| `2-connection-lost-reply-lost.jpg` | Lose the next spin's reply. The server records and charges the round | **Connection Lost**, with Retry |
| `2b-after-retry-single-charge.jpg` | Retry | The same round is presented. Balance ₩10,000,000 → ₩9,992,000 (−₩20,000 bet, +₩12,000 win); the bet is charged once |
| `3-connection-lost-request-failed.jpg` | Fail the next spin request. It never reaches the server | **Connection Lost**, with Retry |
| `3b-after-retry-single-charge.jpg` | Retry | Balance ₩9,992,000 → ₩10,002,000 (−₩20,000 bet, +₩30,000 win); the bet is charged once |
| `4-reconnecting-offline.jpg` | Go offline for 8 seconds | **Reconnecting…**, with Retry disabled. The popup closes by itself when the browser is back online |
| `5-connection-lost-mobile-portrait.jpg` | Lose the next spin's reply at 390×844 | Layout on mobile portrait |

Also verified:

- **Spin while offline:** Reconnecting is shown. When the browser is back online, the popup closes and no spin is placed; the balance is unchanged.
- **Popup style:** all popups use the Resume Active Game style.
