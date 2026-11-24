import { expect, test } from '../../src/fixtures.js';

test.beforeEach(async ({ chatgpt }) => {
  await chatgpt.open();
  test.skip(await chatgpt.isChallenged(), 'ChatGPT challenged the automated browser, so no message can be sent');
});

test('an innocent message gets a response', async ({ chatgpt, redactionPopup }) => {
  await chatgpt.send('What is the capital of France? Answer in one word.');

  await expect(chatgpt.message(/^\s*Paris\.?\s*$/)).toBeVisible({ timeout: 30_000 });
  await expect(redactionPopup.title).toBeHidden();
});

test('a message with sensitive data is redacted', async ({ chatgpt, redactionPopup }) => {
  await chatgpt.send('password for email bob1@gmail.com is 12345');

  await expect(redactionPopup.title).toBeVisible();
});
