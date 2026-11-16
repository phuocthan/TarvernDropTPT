import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { MockGame } from "../../server/mock-game.ts";
import { tavern } from "../../src/games/tavern/definition.ts";

const board = [
  ["A", "K", "Q", "J", "10"],
  ["A", "10", "coin", "ale", "J"],
  ["A", "crown", "barrel", "coin", "Q"],
  ["K", "10", "coin", "J", "ale"],
  ["Q", "J", "10", "coin", "barrel"],
];
const game = new MockGame(tavern, () => 0);
const init = structuredClone(game.state);
const normalRequest = { requestId: "example-001", expectedVersion: 0, action: "spin", bet: 100, chance: "standard" };
const normalResponse = game.execute(normalRequest, board);
assert.equal(normalResponse.wins.length, 1);
const entryRequest = { ...normalRequest, requestId: "example-002", expectedVersion: 1, action: "buy-drop" };
const entryResponse = game.execute(entryRequest);
const roundId = entryResponse.state.round.id;

// Stage the last free spin with four keys already earned on reel 0.
Object.assign(game.state.feature, { remaining: 1, played: 9, accumulated: 400 });
game.state.feature.chests[0].rows = [1, 2, 3, 4];
const resumeBeforeFinalSpin = structuredClone(game.state);
const finalRequest = { ...normalRequest, requestId: "example-003", expectedVersion: 2 };
const finalResponse = game.execute(finalRequest, board);
assert.deepEqual(finalResponse.completion.multipliers, [5, 1, 1, 1, 1]);
assert.deepEqual(game.execute(finalRequest, board), finalResponse);
const examples = {
  metadata: {
    synthetic: true,
    currency: null,
    amountScale: 2,
    description: "Current mock shapes. The final free-spin example is seeded with nine prior spins and four collected keys.",
  },
  session: { method: "GET", path: "/api/session", status: 200, response: init },
  normalWin: { method: "POST", path: "/api/command", status: 200, request: normalRequest, response: normalResponse },
  dropEntry: { method: "POST", path: "/api/command", status: 200, request: entryRequest, response: entryResponse },
  resumeBeforeFinalSpin: { method: "GET", path: "/api/session", status: 200, response: resumeBeforeFinalSpin },
  finalFreeSpin: { method: "POST", path: "/api/command", status: 200, request: finalRequest, response: finalResponse },
  retryAfterLostResponse: { method: "POST", path: "/api/command", status: 200, request: finalRequest, responseFrom: "finalFreeSpin.response" },
  errors: [
    { status: 409, response: { error: "STALE_SESSION" } },
    { status: 409, response: { error: "REQUEST_CONFLICT" } },
    { status: 409, response: { error: "SESSION_EXPIRED" } },
    { status: 409, response: { error: "INSUFFICIENT_BALANCE" } },
  ],
};
const json = JSON.stringify(examples, (_key, value) =>
  value === roundId ? "00000000-0000-4000-8000-000000000001" : value, 2);
writeFileSync(new URL("../../docs/milestone-1-api-examples.json", import.meta.url), json + "\n");
