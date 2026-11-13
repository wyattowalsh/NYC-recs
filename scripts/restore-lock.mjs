import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = path.join(root, '.locks', 'parts');
const checksumPath = path.join(root, '.locks', 'package-lock.sha256');
const outputPath = path.join(root, 'package-lock.json');

const [partNames, expectedRaw] = await Promise.all([
  readdir(partsDir),
  readFile(checksumPath, 'utf8'),
]);
const names = partNames.filter((name) => name.endsWith('.b64')).sort();
if (!names.length) throw new Error('No lock snapshot parts found.');
const base64 = (await Promise.all(names.map((name) => readFile(path.join(partsDir, name), 'utf8')))).join('').replace(/\s+/g, '');
const lock = brotliDecompressSync(Buffer.from(base64, 'base64'));
const expected = expectedRaw.trim().split(/\s+/)[0];
const actual = createHash('sha256').update(lock).digest('hex');
if (!expected || actual !== expected) {
  throw new Error(`Lock snapshot checksum mismatch: expected ${expected || '<missing>'}, got ${actual}`);
}
JSON.parse(lock.toString('utf8'));
await writeFile(outputPath, lock);
console.log(`Restored package-lock.json from ${names.length} parts (${actual.slice(0, 12)}…)`);
