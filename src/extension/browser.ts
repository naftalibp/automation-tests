import { chromium, type BrowserContext, type Worker } from '@playwright/test';

/** Starts Chromium with the unpacked extension and a new temporary profile. */
export function launchBrowser(headless: boolean, extensionDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless,
    locale: 'en-US',
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`]
  });
}

export async function waitForExtension(context: BrowserContext, workerPath: string): Promise<Worker> {
  const matches = (worker: Worker) => {
    const url = new URL(worker.url());
    return url.protocol === 'chrome-extension:' && url.pathname === '/' + workerPath;
  };
  const running = context.serviceWorkers().find(matches);
  if (running) return running;
  return context.waitForEvent('serviceworker', { predicate: matches, timeout: 12_000 }).catch(() => {
    throw new Error('Setup failed: Prompt Security service worker did not start.');
  });
}
