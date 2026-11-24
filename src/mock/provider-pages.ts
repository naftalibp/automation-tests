import type { Route } from '@playwright/test';

/** ChatGPT's endpoint for signed-out messages and the form it posts, as the real page sends them. */
const messageUrl = 'https://chatgpt.com/unauth-mweb/conversation/updates';

const chatGpt = `<!doctype html><html lang="en"><title>Mock ChatGPT</title>
<textarea aria-label="Chat with ChatGPT"></textarea>
<script>
  document.querySelector('textarea').addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    fetch('${messageUrl}?operationId=' + crypto.randomUUID(), {
      method: 'POST',
      body: new URLSearchParams({ conversationState: '{"messages":[]}', prompt: event.target.value })
    });
  });
</script></html>`;

// Usable on its own, so only the extension can make it look blocked.
const gemini = '<!doctype html><html lang="en"><title>Mock Gemini</title><textarea aria-label="Enter a prompt for Gemini"></textarea></html>';

const pages = new Map([['https://chatgpt.com', chatGpt], ['https://gemini.google.com', gemini]]);

/** Stands in for the real sites if CLIENT_SITES=mock. */
export async function serveProviderPage(route: Route): Promise<void> {
  const page = pages.get(new URL(route.request().url()).origin);
  if (page && route.request().resourceType() === 'document') {
    await route.fulfill({ contentType: 'text/html', body: page });
  } else {
    await route.abort();
  }
}
