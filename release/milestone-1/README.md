# Tavern Drop Framework Preview · Milestone 1

This package contains the TypeScript/PixiJS framework, a 5 × 5 Tavern Drop mock and a 3 × 3 reuse example. Both demos use temporary symbols rendered by PixiJS and isolated mock API sessions. The 5 × 5 demo runs Drop motion. The 3 × 3 demo runs Normal motion.

## Run locally

Use Node.js 22.18 or later.

```sh
npm ci
npm run build
npm start
```

1. Open `http://localhost:4000/` and press **Spin**. The mock server updates the board, balance and win status.
2. Follow **3 × 3 Reuse Demo** or visit `http://localhost:4000/?game=reuse`. Press **Spin** and verify the smaller board and separate balance.
3. Run `npm test` for the shared configuration, reel timing and mock settlement checks.

For development, `npm run dev` serves the UI at the Vite URL and runs the API on port 4000. Mock balances reset when the Node server restarts.

- [Deliverables and acceptance checklist](docs/milestone-1.md)
- [Asset specifications and reference validation](docs/milestone-1-asset-spec.md)
- [Mock API examples for integration review](docs/milestone-1-api.md)
- [Development commit used for this snapshot](SOURCE_REVISION)
