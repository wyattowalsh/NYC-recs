import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const packages = [];
const seen = new Set();

for (const packagePath of Object.keys(lock.packages ?? {}).sort()) {
  if (!packagePath.startsWith('node_modules/')) continue;
  const directory = path.join(root, packagePath);
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')); }
  catch { continue; }
  const key = `${manifest.name ?? packagePath}@${manifest.version ?? 'unknown'}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const entries = await readdir(directory).catch(() => []);
  const licenseName = entries.find((entry) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(entry));
  const text = licenseName ? await readFile(path.join(directory, licenseName), 'utf8').catch(() => '') : '';
  packages.push({ key, license: manifest.license ?? 'not declared', text: text.trim() });
}

const groups = new Map();
for (const item of packages) {
  if (!item.text) continue;
  const id = createHash('sha256').update(item.text).digest('hex').slice(0, 12);
  const group = groups.get(id) ?? { text: item.text, packages: [] };
  group.packages.push(item.key);
  groups.set(id, group);
}

const lines = [
  'NYC Recs — Third-Party Notices',
  'Generated deterministically from package-lock.json and installed package metadata.',
  '',
  'Packages',
  '========',
  ...packages.map(({ key, license, text }) => `- ${key} — ${license}${text ? '' : ' (no license file found in package)'}`),
  '',
  'Deduplicated License Texts',
  '==========================',
];
for (const [id, group] of [...groups.entries()].sort()) {
  lines.push('', `--- ${id} ---`, `Applies to: ${group.packages.sort().join(', ')}`, '', group.text, '');
}
await writeFile(path.join(root, 'public', 'third-party-notices.txt'), `${lines.join('\n')}\n`);
