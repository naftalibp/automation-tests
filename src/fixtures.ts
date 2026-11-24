import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base } from '@playwright/test';
import lock from '../extension.lock.json' with { type: 'json' };
import { tenantFor, type Backend, type Sites } from './config.js';
import { launchBrowser, waitForExtension } from './extension/browser.js';
import { unpackExtension } from './extension/install.js';
import { attachExtensionLog, type ExtensionLogMode } from './extension/logs.js';
import { installMock, type MockPolicy } from './mock/backend.js';
import { BlockPage } from './pages/block.page.js';
import { ChatGptPage } from './pages/chatgpt.page.js';
import { ExtensionSettingsPage } from './pages/extension-settings.page.js';
import { GeminiPage } from './pages/gemini.page.js';
import { RedactionPopup } from './pages/redaction-popup.js';
import { startVideo } from './recording.js';

export type Options = {
  /** Set per project in playwright.config.ts. */
  backend: Backend;
  /** Set for the client project in playwright.config.ts. Live tests use the default, the real sites. */
  sites: Sites;
  /** What the mock backend answers. Client tests set it with test.use(). Ignored by live tests. */
  mockPolicy: MockPolicy;
  /** Set per artifact profile in artifacts.config.ts. */
  extensionLog: ExtensionLogMode;
};

type WorkerFixtures = {
  /** The unpacked extension. Read-only, so the tests of one worker share it. */
  extension: { directory: string } & Awaited<ReturnType<typeof unpackExtension>>;
};

type Pages = {
  chatgpt: ChatGptPage;
  gemini: GeminiPage;
  blockPage: BlockPage;
  redactionPopup: RedactionPopup;
};

export const test = base.extend<Options & Pages, WorkerFixtures>({
  backend: ['mock', { option: true }],
  sites: ['real', { option: true }],
  mockPolicy: [{ rules: {} }, { option: true }],
  extensionLog: ['retain-on-failure', { option: true }],

  // Each worker process unpacks its own copy, so no two workers write to the same directory.
  extension: [async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'prompt-security-'));
    try {
      await use({ directory, ...await unpackExtension(directory) });
    } finally {
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  }, { scope: 'worker' }],

  // Every test gets a new browser profile with the extension installed and configured.
  context: async ({ headless, backend, sites, mockPolicy, extensionLog, extension, trace }, use, testInfo) => {
    // artifacts.config.ts already turns this off, but --trace and --ui would override it.
    if (backend === 'live' && (typeof trace === 'string' ? trace : trace.mode) !== 'off') {
      throw new Error('Setup failed: traces of live tests are not allowed, because they would contain the API key.');
    }
    const tenant = tenantFor(backend);
    const context = await launchBrowser(headless, extension.directory);
    let ready = false;
    try {
      if (backend === 'mock') await installMock(context, mockPolicy, sites);

      const worker = await waitForExtension(context, extension.worker);
      const extensionId = new URL(worker.url()).hostname;
      if (extensionId !== lock.storeId) throw new Error('Setup failed: unexpected extension identity.');

      const popup = await context.newPage();
      try {
        await new ExtensionSettingsPage(popup).configure(`chrome-extension://${extensionId}/${extension.popup}`, tenant);
      } finally {
        // Also on failure, so the settings are never in a screenshot.
        await popup.close();
      }
      console.log(`Ready | worker ${testInfo.parallelIndex} | ${backend} backend ${tenant.domain} | ${sites} sites | Chromium ${context.browser()?.version()} | Prompt Security ${extension.version}`);

      ready = true;
      await use(context);
    } finally {
      // An error thrown by this fixture's own setup is not in testInfo.status yet.
      const failed = !ready || testInfo.status !== testInfo.expectedStatus;
      if (extensionLog === 'on' || (extensionLog === 'retain-on-failure' && failed)) {
        await attachExtensionLog(context, tenant.apiKey, testInfo);
      }
      await context.close();
    }
  },

  // The tab the browser starts with, so that screenshots and snapshots do not include an unused blank tab.
  page: async ({ context, video }, use, testInfo) => {
    const page = context.pages()[0] ?? await context.newPage();
    const stopVideo = await startVideo(page, video, testInfo);
    await use(page);
    await stopVideo();
  },

  chatgpt: async ({ page }, use) => use(new ChatGptPage(page)),
  gemini: async ({ page }, use) => use(new GeminiPage(page)),
  blockPage: async ({ page }, use) => use(new BlockPage(page, lock.storeId)),
  redactionPopup: async ({ page }, use) => use(new RedactionPopup(page))
});

export { expect } from '@playwright/test';
