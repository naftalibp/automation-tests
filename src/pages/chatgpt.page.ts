import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { navigate } from './navigate.js';

/** Matches the signed-out endpoints: .../f/conversation and .../conversation/updates. */
export function isMessageRequest(request: Request): boolean {
  const { hostname, pathname } = new URL(request.url());
  return request.method() === 'POST' && hostname === 'chatgpt.com' && /\/conversation(\/updates)?$/.test(pathname);
}

/** The user's text in a message request. ChatGPT posts a form or JSON, depending on the endpoint. */
export function messageText(request: Request): string {
  const body = request.postData() ?? '';
  const type = request.headers()['content-type'] ?? '';
  const text = type.includes('application/x-www-form-urlencoded')
    ? new URLSearchParams(body).get('prompt')
    : JSON.parse(body).messages?.at(-1)?.content?.parts?.join('\n');
  if (!text) throw new Error(`No message text in the request to ${new URL(request.url()).pathname}. Has its format changed?`);
  return text;
}

export class ChatGptPage {
  readonly messageBox: Locator;

  constructor(private readonly page: Page) {
    this.messageBox = page.getByRole('textbox', { name: /chatgpt/i }).first();
  }

  async open(): Promise<void> {
    await navigate(this.page, 'https://chatgpt.com/');
    await this.page.waitForLoadState('load');
  }

  /**
   * Returns the request that left the page, after the extension changed it.
   * ChatGPT ignores Enter until its scripts are ready, so retry until the message is really sent.
   */
  async send(message: string): Promise<Request> {
    let request: Request | undefined;
    await expect(async () => {
      await this.messageBox.fill('');
      await this.messageBox.pressSequentially(message, { delay: 20 });
      const sent = this.page.waitForRequest(isMessageRequest, { timeout: 10_000 });
      [request] = await Promise.all([sent, this.messageBox.press('Enter')]);
    }, 'ChatGPT sends the message').toPass({ timeout: 40_000 });
    return request!;
  }

  /** The first chat bubble or reply that matches. */
  message(text: string | RegExp): Locator {
    return this.page.getByRole('main').getByText(text).first();
  }

  /** True if an anti-bot page is shown in place of the chat. */
  async isChallenged(): Promise<boolean> {
    await this.messageBox.waitFor({ timeout: 15_000 }).catch(() => {});
    return /just a moment|verify you are human|unusual traffic/i.test(await this.page.title());
  }
}
