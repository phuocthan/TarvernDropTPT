import type {
  Board,
  Chest,
  GameDefinition,
  LineWin,
  Position,
} from "./contracts.ts";
export function validateDefinition(game: GameDefinition) {
  if (
    game.lines.some(
      (l) => l.length !== game.reels || l.some((r) => !Number.isInteger(r) || r < 0 || r >= game.rows),
    )
  )
    throw Error("Invalid paylines");
  if (new Set(game.symbols.map((s) => s.id)).size !== game.symbols.length)
    throw Error("Duplicate symbol");
}
export function evaluate(
  game: GameDefinition,
  board: Board,
  bet: number,
): LineWin[] {
  return game.lines.flatMap((line, index) => {
    // Evaluate every possible symbol, then pay the best substitution once per line.
    const candidates = game.symbols
      .filter((s) => s.kind !== "bonus")
      .flatMap((symbol) => {
        const positions: Position[] = [];
        for (let reel = 0; reel < game.reels; reel++) {
          const id = board[reel][line[reel]];
          const isWild = game.symbols.find((s) => s.id === id)?.kind === "wild";
          if (id !== symbol.id && !isWild) break;
          positions.push({ reel, row: line[reel] });
        }
        const factor = symbol.pays[positions.length];
        return factor
          ? [
              {
                line: index,
                symbol: symbol.id,
                positions,
                amount: Math.floor((bet * factor) / 100),
              },
            ]
          : [];
      });
    const best = candidates.sort((a, b) => b.amount - a.amount)[0];
    return best ? [best] : [];
  });
}
export function collect(
  chests: Chest[],
  wins: LineWin[],
  rows: number,
): Position[] {
  const added: Position[] = [];
  for (const win of wins)
    for (const position of win.positions) {
      const chest = chests[position.reel];
      if (!chest.rows.includes(position.row)) {
        chest.rows.push(position.row);
        chest.rows.sort();
        added.push(position);
      }
      chest.unlocked = chest.rows.length === rows;
    }
  return added;
}
export function settleFeature(
  accumulated: number,
  multipliers: number[],
  baseWin: number,
  cap: number,
) {
  const product = multipliers.reduce((p, m) => p * m, 1);
  const uncapped = baseWin + accumulated * product;
  const roundAward = Math.min(cap, uncapped);
  return {
    accumulated,
    multipliers,
    product,
    featureAward: Math.max(0, roundAward - baseWin),
    roundAward,
    capped: uncapped >= cap,
  };
}
