import { defineConfig } from '@playwright/test';
import { artifactsFor } from './artifacts.config.js';
import { clientSites } from './src/config.js';
import type { Options } from './src/fixtures.js';

const sites = clientSites();
const outputFolder = 'playwright-report';

export default defineConfig<Options>({
  testDir: './tests',
  // Scratch space: the artifacts reporter moves the files to the report, so playwright-report is a run's only output.
  outputDir: '.artifacts/test-results',
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
  timeout: 100_000,
  // Ends a hung CI run while its reports can still be written.
  globalTimeout: process.env.CI ? 10 * 60_000 : 0,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  // A missing baseline is a failure in CI, not a reason to write a new one.
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  // Every test has its own browser profile and policy, so tests in the same file can also run at the same time.
  fullyParallel: true,
  workers: process.env.CI ? 2 : '50%',
  reporter: [
    ['list'],
    ['./src/artifacts-reporter.ts', { outputFolder }],
    ['html', { open: 'never', outputFolder }],
    ...(process.env.GITHUB_ACTIONS ? [['./src/github-reporter.ts'] as [string]] : [])
  ],
  projects: [
    {
      name: 'client',
      testDir: './tests/client',
      // ChatGPT challenges headless browsers, and bursts from one address. Mock pages have neither limit.
      workers: sites === 'real' ? 1 : undefined,
      use: { backend: 'mock', sites, headless: sites === 'mock', ...artifactsFor('mock') }
    },
    // One at a time: the tests share a tenant, and ChatGPT challenges bursts of messages from one address.
    { name: 'e2e', testDir: './tests/e2e', workers: 1, use: { backend: 'live', headless: false, ...artifactsFor('live') } }
  ]
});
