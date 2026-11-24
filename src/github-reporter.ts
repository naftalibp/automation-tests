import { appendFileSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

/**
 * Makes skipped tests visible on GitHub, where a run that skipped tests is as green as one that passed them.
 * Adds a warning for each, and a count of the results to the run's summary page.
 */
export default class GitHubReporter implements Reporter {
  private suite?: Suite;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  onEnd(result: FullResult): void {
    const tests = this.suite?.allTests() ?? [];
    const skipped = tests.filter(test => test.outcome() === 'skipped');
    const passed = tests.filter(test => test.outcome() === 'expected').length;
    const flaky = tests.filter(test => test.outcome() === 'flaky').length;
    const failed = tests.length - passed - flaky - skipped.length;

    for (const test of skipped) {
      console.log(`::warning title=${escapeProperty(`Not tested: ${name(test)}`)}::${escape(reason(test))}`);
    }

    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file) return;
    appendFileSync(file, [
      `### Tests: ${result.status}`,
      '',
      '| Passed | Flaky | Failed | Skipped |',
      '| --- | --- | --- | --- |',
      `| ${passed} | ${flaky} | ${failed} | ${skipped.length} |`,
      '',
      ...skipped.map(test => `- **Not tested:** ${name(test)}. ${reason(test)}`),
      ''
    ].join('\n'));
  }

  printsToStdio(): boolean {
    return false;
  }
}

function name(test: TestCase): string {
  const [, suite, , ...titles] = test.titlePath();
  return [suite, ...titles].join(' › ');
}

function reason(test: TestCase): string {
  const annotations = [...test.results.flatMap(result => result.annotations), ...test.annotations];
  // A test without a reason is one that did not get to run, for example after the global timeout.
  return annotations.find(annotation => annotation.type === 'skip')?.description ?? 'It did not run.';
}

/** https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands */
function escape(text: string): string {
  return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function escapeProperty(text: string): string {
  return escape(text).replaceAll(':', '%3A').replaceAll(',', '%2C');
}
