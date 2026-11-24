import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export type Backend = 'live' | 'mock';

/** Where the ChatGPT and Gemini pages come from. */
export type Sites = 'real' | 'mock';

export type Tenant = {
  /** Host only: the extension always connects over HTTPS. */
  domain: string;
  apiKey: string;
};

export const mockDomain = 'policy.test';

export const extensionArchivePath = process.env.EXTENSION_CRX || '.artifacts/extension.crx';

/** The sites of the client tests. Mock pages are a fallback for when the real sites are unavailable or challenge the tests. */
export function clientSites(): Sites {
  const sites = process.env.CLIENT_SITES?.trim() || 'real';
  if (sites !== 'real' && sites !== 'mock') throw new Error('CLIENT_SITES must be real or mock.');
  return sites;
}

export function tenantFor(backend: Backend): Tenant {
  return backend === 'mock' ? { domain: mockDomain, apiKey: 'mock-key' } : liveTenant();
}

/** The tenant of TEST_ENV, read from .env.<TEST_ENV> if that file exists and otherwise from the shell or CI. */
function liveTenant(): Tenant {
  const name = process.env.TEST_ENV?.trim() || 'prod';
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Setup failed: TEST_ENV must be a name such as dev, staging or prod.');

  // One source or the other, never a mix, so a key exported for one environment is not sent to another.
  const file = `.env.${name}`;
  const settings: NodeJS.Dict<string> = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : process.env;

  // Only prod has a default. Otherwise an incomplete staging setup would silently test prod.
  const domain = settings.PROMPT_SECURITY_API_DOMAIN?.trim() || (name === 'prod' ? 'eu.prompt.security' : undefined);
  if (!domain) throw new Error(`Setup failed: PROMPT_SECURITY_API_DOMAIN is required for ${name}.`);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
    throw new Error('Setup failed: PROMPT_SECURITY_API_DOMAIN must be a host without https:// or a path.');
  }

  const apiKey = settings.PROMPT_SECURITY_API_KEY?.trim();
  if (!apiKey) throw new Error(`Setup failed: PROMPT_SECURITY_API_KEY is required for ${domain}.`);
  return { domain, apiKey };
}
