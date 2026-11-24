import type { PlaywrightWorkerOptions } from '@playwright/test';
import type { Backend } from './src/config.js';
import type { ExtensionLogMode } from './src/extension/logs.js';

type ArtifactOptions = Pick<PlaywrightWorkerOptions, 'trace' | 'screenshot' | 'video'> & { extensionLog: ExtensionLogMode };

const size = { width: 1280, height: 720 };

// The trace's film strip is an 800-pixel screencast, and a video of the same page would be shrunk to match it.
// Traces keep their DOM snapshots, network and console without it.
const screenshots = false;

/** What a run records. Selected with the ARTIFACTS environment variable. */
const profiles = {
  off: { trace: 'off', screenshot: 'off', video: 'off', extensionLog: 'off' },
  failure: { trace: { mode: 'retain-on-failure', screenshots }, screenshot: 'only-on-failure', video: { mode: 'retain-on-failure', size }, extensionLog: 'retain-on-failure' },
  all: { trace: { mode: 'on', screenshots }, screenshot: 'on', video: { mode: 'on', size }, extensionLog: 'on' }
} satisfies Record<string, ArtifactOptions>;

export function artifactsFor(backend: Backend): ArtifactOptions {
  const name = process.env.ARTIFACTS?.trim() || 'failure';
  if (!Object.hasOwn(profiles, name)) {
    throw new Error(`ARTIFACTS must be one of: ${Object.keys(profiles).join(', ')}.`);
  }
  const profile: ArtifactOptions = profiles[name as keyof typeof profiles];
  // The extension sends the API key with its requests, and a trace records every request.
  return backend === 'live' ? { ...profile, trace: 'off' } : profile;
}
