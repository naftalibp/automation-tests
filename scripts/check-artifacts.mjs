// Fails if the API key is in any artifact, including inside zip files and the zip embedded in the HTML report.
// GitHub masks secrets in logs, but not in uploaded files.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const key = process.env.PROMPT_SECURITY_API_KEY?.trim();
if (!key) throw new Error('PROMPT_SECURITY_API_KEY is required: it is the value to look for.');
const needles = [...new Set([key, encodeURIComponent(key), Buffer.from(key).toString('base64'),
  // The extension's log shortens the key to this.
  `APP_ID:${key.slice(0, 8)}`])];

const paths = process.argv.slice(2).filter(existsSync);
let files = 0;
const leaks = [];

function check(name, bytes) {
  files++;
  if (needles.some(needle => bytes.includes(needle))) leaks.push(name);
  if (bytes.toString('latin1', 0, 4) === 'PK\x03\x04') {
    for (const [entry, content] of Object.entries(unzipSync(bytes))) check(`${name} > ${entry}`, Buffer.from(content));
  } else if (name.endsWith('.html')) {
    const embedded = /data:application\/zip;base64,([A-Za-z0-9+/=]+)/.exec(bytes.toString('latin1'));
    if (embedded) check(`${name} > embedded.zip`, Buffer.from(embedded[1], 'base64'));
  }
}

function walk(path) {
  if (!statSync(path).isDirectory()) return check(path, readFileSync(path));
  for (const entry of readdirSync(path)) walk(join(path, entry));
}

paths.forEach(walk);
if (leaks.length) {
  console.error(`The API key is in:\n${leaks.map(name => `  ${name}`).join('\n')}`);
  process.exit(1);
}
console.log(`No API key in ${files} files.`);
