import { writeFile } from 'node:fs/promises';
import type { BrowserContext, TestInfo } from '@playwright/test';
import lock from '../../extension.lock.json' with { type: 'json' };

export type ExtensionLogMode = 'off' | 'retain-on-failure' | 'on';

type Message = { type?: string; logs?: string[] };

type ExtensionWindow = Window & {
  chrome: { runtime: {
    onMessage: { addListener(listener: (message: Message) => void): void };
    sendMessage(message: object): Promise<unknown>;
  } };
};

/**
 * Attaches the extension's own debug log to the test. Must run before the context closes: the log is in the
 * browser profile, which is deleted with it. Never fails the test, so it cannot hide the real result.
 */
export async function attachExtensionLog(context: BrowserContext, apiKey: string, testInfo: TestInfo): Promise<void> {
  try {
    const lines = await withDeadline(10_000, readLog(context));
    const path = testInfo.outputPath('extension-log.txt');
    await writeFile(path, redact(lines.join('\n'), apiKey) + '\n');
    testInfo.attachments.push({ name: 'extension-log', path, contentType: 'text/plain' });
  } catch (error) {
    console.warn(`The extension log was not collected: ${redact(String(error), apiKey)}`);
  }
}

/**
 * Sends the message of the popup's "Download Logs" button. The background script then writes out its buffered lines,
 * decrypts the log and posts it to the active tab. Reading chrome.storage instead would miss the buffered lines.
 *
 * The button itself saves the log through the content script of the page under test, which the block page does not have.
 */
async function readLog(context: BrowserContext): Promise<string[]> {
  const page = await context.newPage();
  try {
    // Any page of the extension can receive the log. This one runs no scripts and does not show the API key.
    await page.goto(`chrome-extension://${lock.storeId}/manifest.json`, { timeout: 5_000 });
    await page.bringToFront();
    return await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
      const { runtime } = (window as unknown as ExtensionWindow).chrome;
      runtime.onMessage.addListener(message => {
        if (message.type === 'downloadLogs') resolve(message.logs ?? []);
      });
      runtime.sendMessage({ type: 'saveLogs', ctx: { flowTraceId: crypto.randomUUID() } }).catch(() => {});
      setTimeout(() => reject(new Error('the extension did not answer')), 5_000);
    }));
  } finally {
    // Closed before the context, so it is not in a screenshot.
    await page.close();
  }
}

/** Every line has the first 8 characters of the API key as its APP_ID. "null" is kept: no key was set yet. */
function redact(text: string, apiKey: string): string {
  const withoutPrefix = text.replace(/\[APP_ID:(?!null\])[^\]]*\]/g, '[APP_ID:REDACTED]');
  const key = [apiKey, encodeURIComponent(apiKey), Buffer.from(apiKey).toString('base64')];
  return key.reduce((result, form) => result.replaceAll(form, 'REDACTED'), withoutPrefix);
}

async function withDeadline<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no log after ${ms / 1000} seconds`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
