import type { Locator, Page } from '@playwright/test';

/** The dialog the extension shows over the chat after it redacts a message. */
export class RedactionPopup {
  readonly title: Locator;

  constructor(page: Page) {
    this.title = page.locator('.ps-modal').getByRole('heading', { name: /redacted/i });
  }
}
