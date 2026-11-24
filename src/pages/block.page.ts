import { expect, type Locator, type Page } from '@playwright/test';

/** The full-page "Access Denied" screen shown by the extension itself. */
export class BlockPage {
  readonly content: Locator;

  constructor(private readonly page: Page, private readonly extensionId: string) {
    this.content = page.locator('body');
  }

  async expectBlocked(host: string): Promise<void> {
    // The extension's own URL proves that Prompt Security blocked the site, and not a network or site error.
    await expect(this.page, `${host} is blocked by the Prompt Security extension`).toHaveURL(url =>
      url.protocol === 'chrome-extension:' &&
      url.hostname === this.extensionId &&
      url.searchParams.get('type') === 'blockPage' &&
      url.searchParams.get('domain') === host);
    await expect(this.page.getByText('Access Denied', { exact: true }).first()).toBeVisible();
  }
}
