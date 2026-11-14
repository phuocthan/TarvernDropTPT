// Demonstration math only. Replace this service with an authoritative game server.
export type Mode = 'base' | 'tavern' | 'drop';
export type SymbolId = 'A'|'K'|'Q'|'J'|'10'|'9'|'ale'|'coin'|'crown'|'wild'|'bonus';
export const symbols: SymbolId[] = ['A','K','Q','J','10','9','ale','coin','crown','wild','bonus'];
export const lines: number[][] = [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[4,4,4,4,4],[0,1,2,1,0],[4,3,2,3,4],[1,2,3,2,1],[3,2,1,2,3],[0,1,2,3,4],[4,3,2,1,0],[1,1,2,3,3],[3,3,2,1,1],[2,1,0,1,2],[2,3,4,3,2]];
export interface Win { line: number; positions: [number,number][]; amount: number }
export interface Result { board: SymbolId[][]; wins: Win[]; total: number; bonus: boolean }
export interface GameService { spin(bet: number, mode: Mode): Promise<Result> }
export function evaluate(board: SymbolId[][], bet: number): Result {
 const wins: Win[] = [];
 lines.forEach((rows, line) => { const first = rows.map((row, col) => board[col][row]).find(s => s !== 'wild'); if (!first || first === 'bonus') return; const positions: [number,number][] = []; for(let col=0; col<5; col++){const s=board[col][rows[col]]; if(s!==first && s!=='wild') break; positions.push([col, rows[col]]);} if(positions.length>=3) wins.push({line,positions,amount: Math.round(bet * positions.length * 10)/100}); });
 return {board,wins,total: wins.reduce((n,w)=>n+w.amount,0),bonus:board.flat().filter(s=>s==='bonus').length>=3};
}
export class MockService implements GameService { async spin(bet:number, _mode:Mode):Promise<Result> { await new Promise(r=>setTimeout(r,250)); return evaluate(Array.from({length:5},()=>Array.from({length:5},()=>symbols[Math.floor(Math.random()*symbols.length)])),bet); } }
export function collectRows(chests: Set<number>[], wins: Win[]): void { for(const win of wins) for(const [col,row] of win.positions) chests[col].add(row); }
