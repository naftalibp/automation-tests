import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Names the artifacts <suite>/<test name>/<artifact>, for example client/with-a-protect-rule-gemini-is-not-blocked/video.webm.
 *
 * The HTML reporter copies each attachment to data/<hash>, unless it cannot read the file: then it links to the path
 * as it is. So this reporter gives every attachment its final path, and moves the files there when the report is done.
 * It must be between the list reporter, which prints the final paths, and the HTML reporter.
 */
export default class ArtifactsReporter implements Reporter {
  private readonly folder: string;
  private readonly moves: { attachment: TestResult['attachments'][number]; from: string; to: string }[] = [];
  private readonly usedPaths = new Set<string>();

  constructor(options: { configDir: string; outputFolder: string }) {
    this.folder = resolve(options.configDir, options.outputFolder);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const [, suite, , ...titles] = test.titlePath();
    const attempt = (test.repeatEachIndex ? `-repeat-${test.repeatEachIndex}` : '') + (result.retry ? `-retry-${result.retry}` : '');
    const directory = this.unused(join(slug(suite), slug(titles.join(' ')) + attempt));

    for (const attachment of result.attachments) {
      if (!attachment.path || !existsSync(attachment.path)) continue;
      const extension = extname(attachment.path);
      const name = slug(attachment.name.endsWith(extension) ? attachment.name.slice(0, -extension.length) : attachment.name);
      const to = join(this.folder, this.unused(join(directory, name), extension));
      this.moves.push({ attachment, from: attachment.path, to });
      attachment.path = to;
    }
  }

  onEnd(): void {
    // The HTML reporter deletes the folder, but cannot if it is a Docker volume, and old reports would pile up in it.
    if (existsSync(this.folder)) {
      for (const entry of readdirSync(this.folder)) rmSync(join(this.folder, entry), { recursive: true, force: true });
    }
    for (const { attachment, to } of this.moves) {
      attachment.path = relative(this.folder, to).replaceAll('\\', '/');
      // For an attachment called "trace" the HTML reporter adds the trace viewer, which is about 20 files.
      if (attachment.name === 'trace') attachment.name = 'trace.zip';
    }
  }

  async onExit(): Promise<void> {
    for (const { from, to } of this.moves) {
      mkdirSync(dirname(to), { recursive: true });
      // Not a rename: in Docker the two folders are different volumes.
      copyFileSync(from, to);
      rmSync(from);
      try { rmdirSync(dirname(from)); } catch { /* Not empty yet. */ }
    }
  }

  printsToStdio(): boolean {
    return false;
  }

  /** Adds a number if two tests of a suite, or two artifacts of a test, have the same name. */
  private unused(path: string, extension = ''): string {
    let candidate = path + extension;
    for (let n = 2; this.usedPaths.has(candidate); n++) candidate = `${path}-${n}${extension}`;
    this.usedPaths.add(candidate);
    return candidate;
  }
}

/** Safe in a URL and on every file system. */
function slug(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 80).replace(/^-+|-+$/g, '') || 'unnamed';
}
