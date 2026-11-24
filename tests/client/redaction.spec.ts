import { expect, test } from '../../src/fixtures.js';
import type { Redaction } from '../../src/mock/backend.js';
import { messageText } from '../../src/pages/chatgpt.page.js';

const message = 'password for email bob1@gmail.com is 12345';
const redactions: Redaction[] = [{ entity: 'bob1@gmail.com', entityType: 'EMAIL_ADDRESS', replacement: '[REDACTED_EMAIL_ADDRESS_1]' }];

test.beforeEach(async ({ chatgpt }) => {
  await chatgpt.open();
  test.skip(await chatgpt.isChallenged(), 'ChatGPT challenged the automated browser. Run with CLIENT_SITES=mock to use mock pages');
});

test.describe('with a Protect rule', () => {
  test.use({ mockPolicy: { rules: { 'chatgpt.com': 'Protect' }, redactions } });

  test('sensitive data is removed from the message before it reaches ChatGPT', async ({ chatgpt, redactionPopup }, testInfo) => {
    const sent = messageText(await chatgpt.send(message));
    await testInfo.attach('message-to-chatgpt', { body: sent, contentType: 'text/plain' });

    expect(sent).toBe('password for email [REDACTED_EMAIL_ADDRESS_1] is 12345');
    await expect(redactionPopup.title).toBeVisible();
  });
});

test.describe('without a rule', () => {
  test.use({ mockPolicy: { rules: {}, redactions } });

  test('the same message is sent unchanged', async ({ chatgpt, redactionPopup }) => {
    expect(messageText(await chatgpt.send(message))).toBe(message);
    await expect(redactionPopup.title).toBeHidden();
  });
});
