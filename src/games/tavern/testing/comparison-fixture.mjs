import { ProposalBackend, ProposalError } from "../../../../server/proposal-backend.ts";
import { tavern } from "../definition.ts";

export const fixtureId = "tavern-drop-late-scatter-v1";
export const lateScatter = { reel: 4, row: 2, symbol: "bonus" };
const stops = new Map([[0, 0], [1, 1], [lateScatter.reel, lateScatter.row]]);
const ordinary = tavern.symbols.filter(({ kind }) => kind !== "bonus");
const tape = [];
for (let reel = 0; reel < tavern.reels; reel++) {
  let scatterPlaced = false;
  for (let row = 0; row < tavern.rows; row++) {
    if (!scatterPlaced && stops.get(reel) === row) {
      tape.push(0);
      scatterPlaced = true;
    } else {
      if (!scatterPlaced) tape.push(0.999);
      const symbol = (row + reel * 2) % (ordinary.length - 1);
      tape.push((symbol + 0.5) / ordinary.length);
    }
  }
}

export async function installFixture(page, side) {
  const origin = new URL(side.url).origin;
  let cursor = 0;
  let latestSpin;
  const backend = new ProposalBackend([tavern], null, {
    rng: () => {
      const value = tape[cursor % tape.length];
      cursor++;
      return value;
    },
    mockGamePolicy: { allowNaturalFeatureTriggers: false, maxScattersPerReel: 1 },
  });
  await page.route((url) => url.origin === origin && url.pathname.startsWith("/api/v1/"), async (route) => {
    const request = route.request();
    const headers = request.headers();
    try {
      const path = new URL(request.url()).pathname.slice(7);
      const response = backend.handle(request.method(), path,
        request.postDataJSON() ?? {}, {
          sessionId: headers["session-id"] ?? "",
          token: (headers.authorization ?? "").slice(7),
          playToken: headers["play-token"] ?? "",
        });
      if (path === "/spin") {
        latestSpin = { reels: response.reels, winLines: response.winLines, win: response.totalwin_amt };
      }
      await route.fulfill({ json: response });
    } catch (error) {
      await route.fulfill({ status: error instanceof ProposalError ? error.status : 500, json: { error: "COMPARISON_FIXTURE_ERROR" } });
    }
  });
  return () => latestSpin;
}
