import type { Locator, Page } from '@playwright/test';
import { navigate } from './navigate.js';

export class GeminiPage {
  readonly host = 'gemini.google.com';

  readonly messageBox: Locator;

  constructor(private readonly page: Page) {
    this.messageBox = page.getByRole('textbox', { name: /gemini/i }).first();
  }

  async open(): Promise<void> {
    await navigate(this.page, `https://${this.host}/`);
  }
}
