import type { Page } from '@playwright/test';
import type { Tenant } from '../config.js';

type StorageListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

type SettingsWindow = Window & {
  chrome: { storage: { onChanged: { addListener(listener: StorageListener): void } } };
  policyReceived?: boolean;
};

export class ExtensionSettingsPage {
  constructor(private readonly page: Page) {}

  async configure(url: string, tenant: Tenant): Promise<void> {
    let connectionRejected = false;
    this.page.on('dialog', async dialog => {
      connectionRejected = true;
      await dialog.dismiss();
    });
    await this.page.goto(url);
    await this.page.locator('#apiDomain').fill(tenant.domain);

    // Observe fresh configuration without copying its contents into the report.
    await this.page.evaluate(() => {
      const settings = window as unknown as SettingsWindow;
      settings.chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.init?.newValue) settings.policyReceived = true;
      });
    });
    // Use a DOM input event to keep the key out of Playwright's fill diagnostics.
    await this.page.locator('#apiKey').evaluate((input, key) => {
      (input as HTMLInputElement).value = key;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, tenant.apiKey);
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();

    try {
      await this.page.waitForFunction(() => (window as unknown as SettingsWindow).policyReceived,
        undefined, { timeout: 25_000 });
    } catch {
      throw new Error(connectionRejected
        ? 'Setup failed: extension reported a connection or credential error.'
        : 'Setup failed: extension did not apply a new server configuration within 25 seconds.');
    }
  }
}
