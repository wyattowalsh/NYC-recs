import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = path.join(root, 'package-lock.json');
const outputDir = path.join(root, '.locks');
const partsDir = path.join(outputDir, 'parts');
const checksumPath = path.join(outputDir, 'package-lock.sha256');
const lock = await readFile(lockPath);
JSON.parse(lock.toString('utf8'));
const checksum = createHash('sha256').update(lock).digest('hex');
const archive = brotliCompressSync(lock, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
});
const encoded = archive.toString('base64');
const partSize = 4096;
await mkdir(partsDir, { recursive: true });
for (const name of await readdir(partsDir)) {
  if (name.endsWith('.b64')) await rm(path.join(partsDir, name));
}
const writes = [];
for (let offset = 0, index = 0; offset < encoded.length; offset += partSize, index += 1) {
  writes.push(writeFile(path.join(partsDir, `part-${String(index).padStart(3, '0')}.b64`), `${encoded.slice(offset, offset + partSize)}\n`));
}
await Promise.all([
  ...writes,
  writeFile(checksumPath, `${checksum}  package-lock.json\n`),
]);
console.log(`Frozen package-lock.json (${lock.length} → ${archive.length} bytes, ${writes.length} parts, ${checksum.slice(0, 12)}…)`);
