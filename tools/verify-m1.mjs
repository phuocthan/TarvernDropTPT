import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, resolve, relative } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'EXPORT_MANIFEST.json'), 'utf8').replace(/^\uFEFF/, ''));
const textExtensions = new Set(['.ts', '.js', '.mjs', '.json', '.md', '.txt', '.css', '.html']);
for (const file of manifest.files) {
 const path = resolve(root, file.path);
 if (relative(root, path).startsWith('..')) throw Error('Unsafe manifest path');
 let bytes = readFileSync(path);
 if (textExtensions.has(extname(path)) || ['.gitignore','SOURCE_REVISION'].includes(file.path))
  bytes = Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
 const hash = createHash('sha256').update(bytes).digest('hex');
 if (hash !== file.sha256) throw Error(`Checksum mismatch: ${file.path}`);
}
console.log(`Verified ${manifest.files.length} M1 files (${manifest.sourceRevision}).`);
