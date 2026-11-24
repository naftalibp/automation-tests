# Keep the tag equal to the @playwright/test version in package.json.
FROM mcr.microsoft.com/playwright:v1.65.1-noble
WORKDIR /tests

COPY package.json package-lock.json ./
RUN npm ci

COPY extension.lock.json ./
COPY scripts ./scripts
RUN npm run extension:fetch

COPY tsconfig.json playwright.config.ts artifacts.config.ts ./
COPY src ./src
COPY tests ./tests

# A virtual display for headed Chromium, so no window opens on the host.
ENTRYPOINT ["xvfb-run", "-a", "npx", "playwright", "test"]
