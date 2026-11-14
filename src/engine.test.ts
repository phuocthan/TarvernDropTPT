import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { evaluate, collectRows, type SymbolId } from './engine.ts';
test('matching line wins and repeated positions do not add chest progress',()=>{const board:SymbolId[][]=Array.from({length:5},()=>['A','bonus','bonus','bonus','bonus']);const r=evaluate(board,1);assert.ok(r.wins.some(w=>w.line===0));const chests=Array.from({length:5},()=>new Set<number>());collectRows(chests,r.wins);collectRows(chests,r.wins);assert.equal(chests[0].size,1);});
