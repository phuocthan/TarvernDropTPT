import { createHash } from "node:crypto";
import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from "@playwright/test/reporter";

function assertionFailures(steps: TestStep[]): string[] {
  return steps.flatMap((step) => {
    const nested = assertionFailures(step.steps);
    if (nested.length || !step.error || step.category !== "expect" || !step.location) return nested;
    const { file, line, column } = step.location;
    return [`${file}:${line}:${column} ${step.title}`];
  });
}

function summarize(error: TestError): string {
  return stripVTControlCharacters(error.message ?? String(error.value ?? "Unknown test error"))
    .replace(/https?:\/\/\S+/g, "[URL redacted]")
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8).join(" | ");
}

export default class BehaviorReporter implements Reporter {
  private tests: TestCase[] = [];
  private suiteErrors: string[] = [];

  constructor(private options: { directory: string; profile: string }) {}

  onBegin(_config: unknown, suite: Suite) {
    this.tests = suite.allTests();
  }

  onError(error: TestError) {
    this.suiteErrors.push(summarize(error));
  }

  async onEnd(result: FullResult) {
    const { directory, profile } = this.options;
    const summary = { passed: 0, failed: 0, review: 0, notObserved: 0 };
    const scenarios = [];
    for (const test of this.tests) {
      const id = createHash("sha256").update(`${test.parent.project()?.name ?? ""}\n${test.titlePath().slice(2).join("\n")}`)
        .digest("hex").slice(0, 16);
      const attempts = test.results.filter(({ status }) => !["skipped", "interrupted"].includes(status));
      const failedAttempts = attempts.filter(({ status }) => status !== "passed");
      const [first, second] = failedAttempts;
      const confirmed = !this.suiteErrors.length && attempts.length === 2 && first?.status === "failed" &&
        second?.status === "failed" && assertionFailures(first.steps).some((signature) => assertionFailures(second.steps).includes(signature));
      const status = !attempts.length ? "notObserved" : confirmed ? "failed" : failedAttempts.length ? "review" : "passed";
      summary[status]++;
      const evidence: string[] = [];
      for (const { retry, attachments } of failedAttempts) {
        for (const attachment of attachments) {
          if (attachment.contentType !== "image/png" || !attachment.path) continue;
          const name = `${id}-attempt-${retry + 1}-${evidence.length + 1}.png`;
          await copyFile(attachment.path, join(directory, name));
          evidence.push(name);
        }
      }
      scenarios.push({ steps: [{
        id, label: test.title, status, evidence,
        expected: test.annotations.find(({ type }) => type === "qa-expected")?.description ?? "The scenario assertions pass.",
        reproduce: `Run npm run qa:behavior -- --grep "${test.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" with the local game mock.`,
        failures: failedAttempts.flatMap((attempt: TestResult) => attempt.errors.map((error) => `Attempt ${attempt.retry + 1}: ${summarize(error)}`)),
        attempts: attempts.map(({ status, retry }) => ({ status, retry })),
      }] });
    }
    const path = join(directory, "run.json");
    await writeFile(path, JSON.stringify({ profile, mode: "behavior", status: result.status, suiteErrors: this.suiteErrors, summary, scenarios }, null, 2) + "\n");
    console.log(`\nBehavior QA report: ${path}`);
    console.log(`Confirmed bugs: ${summary.failed} | needs review: ${summary.review}`);
  }
}
