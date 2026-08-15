#!/usr/bin/env node
// Builds the Teams message for a finished run.
//
// Posts an Adaptive Card, which is what the Workflows app in Teams expects.
// Microsoft retired the old Office 365 "Incoming Webhook" connectors, so a
// webhook created today comes from Teams > Workflows > "Post to a channel when a
// webhook request is received", and that flow forwards an Adaptive Card payload.
//
// Usage: node scripts/report-teams.js <reportDir> <label>
// Writes <reportDir>/final/teams-card.json for the workflow to POST.

import fs from "node:fs";
import path from "node:path";

const [reportDirArg, label = "UI"] = process.argv.slice(2);
const finalDir = path.join(path.resolve(reportDirArg ?? "cypress/reports/ui"), "final");
const mergedPath = path.join(finalDir, "merged.json");

if (!fs.existsSync(mergedPath)) {
  console.error(`No merged report at ${mergedPath}`);
  process.exit(1);
}

const merged = JSON.parse(fs.readFileSync(mergedPath, "utf8"));
const stats = merged.stats ?? {};

const failures = [];
const walk = (node, file) => {
  for (const test of node.tests ?? []) {
    if (test.fail) failures.push({ file, title: test.fullTitle || test.title });
  }
  for (const hook of [...(node.beforeHooks ?? []), ...(node.afterHooks ?? [])]) {
    if (hook?.err?.message) failures.push({ file, title: hook.title });
  }
  for (const suite of node.suites ?? []) walk(suite, file);
};
for (const result of merged.results ?? []) {
  walk(result, String(result.file ?? "").replace(/^cypress[\\/]e2e[\\/]/, "").replace(/\\/g, "/"));
}

const passed = stats.passes ?? 0;
const failed = stats.failures ?? 0;
const total = stats.tests ?? 0;
const skipped = (stats.pending ?? 0) + (stats.skipped ?? 0);
const rate = total ? ((passed / total) * 100).toFixed(1) : "0.0";
const healthy = failed === 0;

const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

const body = [
  {
    type: "TextBlock",
    size: "Large",
    weight: "Bolder",
    color: healthy ? "Good" : "Attention",
    text: healthy
      ? `${label} tests passed`
      : `${label} tests: ${failed} check${failed === 1 ? "" : "s"} need attention`,
    wrap: true,
  },
  {
    type: "FactSet",
    facts: [
      { title: "Environment", value: process.env.TARGET_ENV || "qa" },
      { title: "Passed", value: `${passed} of ${total}` },
      { title: "Failed", value: String(failed) },
      ...(skipped ? [{ title: "Skipped", value: String(skipped) }] : []),
      { title: "Pass rate", value: `${rate}%` },
    ],
  },
];

if (failures.length) {
  body.push({
    type: "TextBlock",
    weight: "Bolder",
    text: "What failed",
    spacing: "Medium",
    wrap: true,
  });
  // Five is enough to see the shape of the problem in a chat window; the rest are
  // in the report the button links to.
  failures.slice(0, 5).forEach((failure) => {
    body.push({
      type: "TextBlock",
      text: `• ${failure.title}  \n_${failure.file}_`,
      wrap: true,
      spacing: "Small",
      size: "Small",
    });
  });
  if (failures.length > 5) {
    body.push({
      type: "TextBlock",
      text: `…and ${failures.length - 5} more.`,
      wrap: true,
      size: "Small",
      isSubtle: true,
    });
  }
}

body.push({
  type: "TextBlock",
  text: "The full report, with every failure explained in plain terms, is attached to the run as a PDF.",
  wrap: true,
  size: "Small",
  isSubtle: true,
  spacing: "Medium",
});

const card = {
  type: "message",
  attachments: [
    {
      contentType: "application/vnd.microsoft.card.adaptive",
      contentUrl: null,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body,
        ...(runUrl
          ? { actions: [{ type: "Action.OpenUrl", title: "Open the run", url: runUrl }] }
          : {}),
      },
    },
  ],
};

fs.writeFileSync(path.join(finalDir, "teams-card.json"), JSON.stringify(card, null, 2));
console.log(`${healthy ? "PASS" : "FAIL"} · ${passed}/${total} passed`);
