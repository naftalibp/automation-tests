import { rm } from 'node:fs/promises';
import type { Page, PlaywrightWorkerOptions, TestInfo } from '@playwright/test';

/**
 * Applies the `video` option to one page and returns a function that ends the recording.
 *
 * Playwright applies `trace` and `screenshot` to every context, but `video` only to contexts it creates itself,
 * and an extension needs a persistent one. Recording a page also keeps the extension settings out of the video.
 */
export async function startVideo(page: Page, video: PlaywrightWorkerOptions['video'], testInfo: TestInfo): Promise<() => Promise<void>> {
  const { mode, size } = typeof video === 'string' ? { mode: video, size: undefined } : video;
  if (mode === 'off') return async () => {};
  if (mode !== 'on' && mode !== 'retain-on-failure') throw new Error(`Video mode ${mode} is not supported.`);

  const path = testInfo.outputPath('video.webm');
  await page.screencast.start({ path, size });
  return async () => {
    // A test ends as soon as its last check passes, often before the recorder has received that screen.
    await page.waitForTimeout(500).catch(() => {});
    await page.screencast.stop();
    if (mode === 'on' || testInfo.status !== testInfo.expectedStatus) {
      testInfo.attachments.push({ name: 'video', path, contentType: 'video/webm' });
    } else {
      await rm(path, { force: true });
    }
  };
}
