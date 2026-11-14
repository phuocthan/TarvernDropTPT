# Tavern slot prototype

Run `npm ci`, `npm run dev`, then open the local Vite address. `npm run build` type-checks and builds; `npm test` runs engine checks.

This is an early playable prototype, not a reproduction of the reference game or production gambling software. All symbols, paylines, awards, bonus entry, prices, chest multipliers, balance and probabilities are illustrative. No real money. The in-browser mock is not authoritative and must be replaced with a secure server before real use. The service interface separates results from presentation; production results must contain all outcomes, balances, bonus state and recovery identifiers from the server. Never generate outcomes or settle bets on the client in production.

Missing reference and math: reference screens and artwork; actual paytable/paylines; entry and retrigger conditions for both modes; chance options and costs; chest awards; cap and win thresholds; accounting, recovery, autoplay and sound behavior. The reference site was inaccessible during initial development. Obtain licensed art and Spine assets separately.
