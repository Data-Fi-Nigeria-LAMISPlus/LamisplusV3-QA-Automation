#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function pct(part, whole) {
  if (whole <= 0) return "0.00";
  return ((part / whole) * 100).toFixed(2);
}

function collectJsonFiles(reportDir) {
  if (!fs.existsSync(reportDir)) {
    return [];
  }

  return fs
    .readdirSync(reportDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(reportDir, entry.name));
}

function readStats(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const stats = data && typeof data === "object" ? data.stats : null;

    if (!stats || typeof stats !== "object") {
      return null;
    }

    return {
      tests: toNumber(stats.tests),
      passes: toNumber(stats.passes),
      failures: toNumber(stats.failures),
    };
  } catch {
    return null;
  }
}

function buildSummary({ suiteName, tests, passes, failures, passPct, failPct, hasFailures, testStepOutcome }) {
  const testStepFailed = testStepOutcome === "failure";
  
  let statusLine;
  let badge;
  let reviewNote;
  
  if (testStepFailed) {
    statusLine = "\n\n⚠️ **TEST FAILED**: One or more tests failed.";
    badge = "⚠️ !Some tests failed and need review.";
    reviewNote = "\n\n📋 **Review Details By Clicking Report To Download**: Download the full test report from the Artifacts section to see detailed failure information.";
  } else if (hasFailures && tests > 0) {
    statusLine = "\n\n⚠️ **TEST FAILED**: One or more tests failed.";
    badge = "⚠️ !Some tests failed and need review.";
    reviewNote = "\n\n📋 **Review Details By Clicking Report To Download**: Download the full test report from the Artifacts section to see detailed failure information.";
  } else {
    statusLine = "\n\n✓ **SUCCESS**: All tests passed.";
    badge = "✓ All tests passed successfully!";
    reviewNote = "";
  }

  const title = `### ${suiteName} Test Summary`;

  const table = [
    "",
    "| Metric | Count | Percentage |",
    "|---|---:|---:|",
    `| Total Tests | ${tests} | 100.00% |`,
    `| Passed | ${passes} | ${passPct}% |`,
    `| Failed | ${failures} | ${failPct}% |`,
    "",
    `- Cypress step outcome: ${testStepOutcome}`,
  ].join("\n");

  return `${statusLine}${badge}${table}${reviewNote}\n`;
}

function appendStepSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${markdown}\n`);
}

function main() {
  const reportDirArg = process.argv[2];
  const suiteName = process.argv[3] || "Cypress";
  const testStepOutcome = process.argv[4] || "unknown";

  if (!reportDirArg) {
    console.error("Usage: node scripts/ci-test-summary.js <reportDir> [suiteName] [testStepOutcome]");
    process.exit(1);
  }

  const reportDir = path.resolve(reportDirArg);
  const files = collectJsonFiles(reportDir);
  const testStepFailed = testStepOutcome === "failure";

  let tests = 0;
  let passes = 0;
  let failures = 0;

  for (const file of files) {
    const stats = readStats(file);
    if (!stats) continue;

    tests += stats.tests;
    passes += stats.passes;
    failures += stats.failures;
  }

  // If tests did not fail but no valid report JSON was produced, treat this as
  // a real pipeline error (reporting/setup issue), not a warning condition.
  if (!testStepFailed && files.length === 0) {
    console.error(`No JSON report files found in ${reportDir}.`);
    process.exit(2);
  }

  if (!testStepFailed && tests === 0 && passes === 0 && failures === 0) {
    console.error(`No valid test stats could be parsed from JSON files in ${reportDir}.`);
    process.exit(3);
  }

  if (tests === 0 && passes + failures > 0) {
    tests = passes + failures;
  }

  const passPct = pct(passes, tests);
  const failPct = pct(failures, tests);
  const hasFailures = failures > 0 || testStepFailed;

  const summary = buildSummary({
    suiteName,
    tests,
    passes,
    failures,
    passPct,
    failPct,
    hasFailures,
    testStepOutcome,
  });

  appendStepSummary(summary);
  process.stdout.write(summary);
}

main();
