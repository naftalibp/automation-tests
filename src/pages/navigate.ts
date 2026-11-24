import type { Page } from '@playwright/test';

/**
 * Opens a page that may be replaced or reloaded while it is still loading, which
 * Playwright reports as a failed navigation. The test's assertions decide the result.
 */
export async function navigate(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'commit' });
  } catch (error) {
    if (!/interrupted by another navigation|ERR_ABORTED/.test(String(error))) throw error;
  }
}
