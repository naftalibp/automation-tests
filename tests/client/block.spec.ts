import { expect, test } from '../../src/fixtures.js';

const host = 'gemini.google.com';

test.describe('with a Block rule', () => {
  test.use({ mockPolicy: { rules: { [host]: 'Block' } } });

  test('Gemini is replaced by the Prompt Security block page', async ({ gemini, blockPage }) => {
    await gemini.open();

    await blockPage.expectBlocked(gemini.host);
    await expect(blockPage.content).toMatchAriaSnapshot({ name: 'block-page.aria.yml' });
  });
});

test.describe('with a Protect rule', () => {
  test.use({ mockPolicy: { rules: { [host]: 'Protect' } } });

  test('Gemini is not blocked', async ({ context, page, gemini }) => {
    const decided = context.waitForEvent('response', response => response.url().endsWith('/api/employee/evaluate-rule'));
    await gemini.open();
    await decided;

    await expect(gemini.messageBox).toBeEditable();
    // The extension has its answer, so give it the time to act on it.
    await page.waitForTimeout(1_000);
    expect(new URL(page.url()).hostname).toBe(host);
  });
});
