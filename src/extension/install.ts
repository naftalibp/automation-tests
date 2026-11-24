import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import lock from '../../extension.lock.json' with { type: 'json' };
import { extensionArchivePath } from '../config.js';

export async function unpackExtension(directory: string) {
  const archive = await readFile(extensionArchivePath);
  if (createHash('sha256').update(archive).digest('hex') !== lock.sha256) {
    throw new Error('Extension SHA-256 differs from extension.lock.json.');
  }
  if (archive.toString('ascii', 0, 4) !== 'Cr24' || archive.readUInt32LE(4) !== 3) {
    throw new Error('Expected a Chrome CRX3 archive.');
  }
  const zip = archive.subarray(12 + archive.readUInt32LE(8));
  for (const [name, bytes] of Object.entries(unzipSync(zip))) {
    if (name.endsWith('/') || name.startsWith('_metadata/')) continue;
    if (name.split('/').some(part => !part || part === '..' || /[\\:]/.test(part))) {
      throw new Error('Invalid path in the pinned archive.');
    }
    const destination = join(directory, name);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== lock.version) throw new Error('Unexpected extension version.');
  // Sideloaded extensions otherwise get a different ID for each temporary path.
  manifest.key = lock.publicKey;
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { version: lock.version, popup: String(manifest.action.default_popup), worker: String(manifest.background.service_worker) };
}
