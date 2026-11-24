import { createHash } from 'node:crypto';
import type { BrowserContext, Route } from '@playwright/test';
import { mockDomain, type Sites } from '../config.js';
import { isMessageRequest } from '../pages/chatgpt.page.js';
import { serveProviderPage } from './provider-pages.js';

export type Redaction = { entity: string; entityType: string; replacement: string };

export type MockPolicy = {
  /** Action per host. Other hosts are unknown to the policy. */
  rules: Record<string, 'Block' | 'Protect'>;
  /** Text the backend reports as sensitive, with its replacement. */
  redactions?: Redaction[];
};

/** Answers the Prompt Security API and ChatGPT's message request locally, and with mock sites every other request too. */
export async function installMock(context: BrowserContext, policy: MockPolicy, sites: Sites): Promise<void> {
  // Playwright tries the last route first, so this one only gets what the two below do not handle.
  if (sites === 'mock') await context.route(/^https?:\/\//, serveProviderPage);

  // Also with real sites: the test is about what the page sends, and no message should reach GPT.
  await context.route(url => url.hostname === 'chatgpt.com', async route => {
    if (!isMessageRequest(route.request())) return route.fallback();
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: [DONE]\n\n' });
  });

  await context.route(url => url.hostname === mockDomain, route =>
    serveApi(route, new URL(route.request().url()).pathname, policy));
}

async function serveApi(route: Route, path: string, policy: MockPolicy): Promise<void> {
  switch (path) {
    case '/api/extension/heartbeat':
      return route.fulfill({ json: {
        ruleBaseV2: true,
        popupsV2: true,
        domainsHashVersion: 2,
        domainHashes: Object.keys(policy.rules).map(host => createHash('sha1').update(host).digest('hex')),
        isExtensionDisabled: false,
        organization: { assetsUrl: `https://${mockDomain}/popup-assets` }
      } });

    case '/popup-assets':
      return route.fulfill({ json: { styles: { violationsModal: '.container { background: white; }' }, assets: {} } });

    case '/api/employee/evaluate-rule': {
      const action = policy.rules[route.request().postDataJSON()?.domain];
      return action ? route.fulfill({ json: { ruleInfo: { action } } }) : route.fulfill({ status: 404, json: {} });
    }

    // Asked for each request of a site, after its rule allowed the page.
    case '/api/extension/explore': {
      const inspect = policy.rules[route.request().postDataJSON()?.domain] === 'Protect';
      return route.fulfill({ json: { action: inspect ? 'Inspect' : 'Ignore' } });
    }

    case '/api/protect':
      return route.fulfill({ json: protectResponse(route.request().postDataJSON()?.prompts ?? [], policy) });

    default:
      return route.abort();
  }
}

/** Same shape as the live tenant's answer, reduced to the fields the extension uses. */
function protectResponse(prompts: string[], { redactions = [] }: MockPolicy) {
  const text = prompts.join('\n');
  const found = redactions.filter(({ entity }) => text.includes(entity));
  if (!found.length) return { status: 'success', result: { action: 'log', prompt: { action: 'log', violations: [], findings: {} } } };

  const findings = { 'Sensitive Data': found.map(({ entity, entityType, replacement }) =>
    ({ entity, entity_type: entityType, sanitized_entity: replacement })) };
  return {
    status: 'success',
    result: {
      action: 'modify',
      prompt: { action: 'modify', violations: ['Sensitive Data'], findings },
      ruleInfo: { coachAwareness: 'All' }
    },
    popup: {
      html: '<!DOCTYPE html><html><head><style id="violationsModal">PLACEHOLDER_violationsModal</style></head>' +
        '<body><div class="container"><h1 class="title">Your Prompt Was Redacted</h1></div></body></html>',
      actions: {}
    }
  };
}
