import test from 'node:test';
import assert from 'node:assert/strict';
import { tavern } from '../src/games/tavern/definition.ts';
test('Tavern placeholder glyphs retain their Unicode code points through export', () => {
 const expected = { ale: '\u{1f37a}', barrel: '\u{1f356}', coin: '\u{1f9ea}', crown: '\u{1f372}' };
 for (const [id, glyph] of Object.entries(expected)) assert.equal(tavern.symbols.find(symbol => symbol.id === id)?.glyph, glyph);
});
