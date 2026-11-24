import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const lock = JSON.parse(await readFile(new URL('../extension.lock.json', import.meta.url), 'utf8'));
const dir = new URL('../.artifacts/', import.meta.url);
const target = new URL('extension.crx', dir);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const existing = await readFile(target).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (existing && hash(existing) === lock.sha256) {
  console.log(`Verified cached extension ${lock.version}`);
} else {
  const response = await fetch(lock.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Extension download returned HTTP ${response.status}. Supply the pinned local CRX via EXTENSION_CRX.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== lock.sha256) throw new Error('Extension download failed its SHA-256 check.');
  await mkdir(dir, { recursive: true });
  const temporary = new URL(randomUUID() + '.tmp', dir);
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`Verified extension ${lock.version} at ${fileURLToPath(target)}`);
}
