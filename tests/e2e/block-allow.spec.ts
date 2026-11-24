import { expect, test } from '../../src/fixtures.js';

test('ChatGPT is allowed: the page loads and can be used', async ({ page, chatgpt }) => {
  await chatgpt.open();

  await expect(chatgpt.messageBox).toBeEditable();
  expect(new URL(page.url()).origin).toBe('https://chatgpt.com');
});

test('Gemini is blocked by Prompt Security', async ({ gemini, blockPage }) => {
  await gemini.open();

  await blockPage.expectBlocked(gemini.host);
});
