import type { Board } from "../../../src/framework/domain/contracts.ts";

/** Fixed synthetic boards, in column-major order. The current Tavern mathtable pays
 * ₩79,000 and ₩0 respectively at the configured ₩20,000 base stake. */
export const win79k: Board = [
  ["J", "wild", "barrel", "barrel", "crown"],
  ["Q", "barrel", "K", "crown", "10"],
  ["wild", "wild", "crown", "crown", "crown"],
  ["Q", "crown", "A", "coin", "wild"],
  ["ale", "K", "crown", "Q", "wild"],
];

export const zeroWin: Board = [
  ["crown", "Q", "Q", "Q", "barrel"],
  ["K", "K", "wild", "10", "J"],
  ["coin", "ale", "barrel", "J", "K"],
  ["wild", "ale", "coin", "K", "crown"],
  ["crown", "coin", "barrel", "K", "crown"],
];
