#!/usr/bin/env node
// Builds the body of the results email from a merged mochawesome report.
//
// Deliberately short. The email is a notification, not the report: the headline,
// what failed and why, and where to get the full thing. The PDF rides along as
// an attachment for anyone who wants the detail.
//
// Usage: node scripts/report-email.js <reportDir> <label>
// Writes <reportDir>/final/email.html and prints a one-line subject to stdout,
// which the workflow captures.

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

const escapeHtml = (value) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const failures = [];
const walk = (node, file) => {
  for (const test of node.tests ?? []) {
    if (test.fail) {
      failures.push({
        file,
        title: test.fullTitle || test.title,
        message: String(test.err?.message ?? "").split("\n")[0].slice(0, 220),
      });
    }
  }
  for (const hook of [...(node.beforeHooks ?? []), ...(node.afterHooks ?? [])]) {
    if (hook?.err?.message) {
      failures.push({ file, title: hook.title, message: String(hook.err.message).split("\n")[0].slice(0, 220) });
    }
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

const failureRows = failures
  .slice(0, 25)
  .map(
    (failure) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #eef1f6;font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#64748b">${escapeHtml(failure.file)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eef1f6;font-size:13px">
          <strong>${escapeHtml(failure.title)}</strong><br>
          <span style="color:#b42318;font-size:12px">${escapeHtml(failure.message)}</span>
        </td>
      </tr>`
  )
  .join("");

const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7fa;font-family:'Segoe UI',system-ui,sans-serif;color:#16202e">
  <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #dbe3ee;border-radius:4px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#77869a">${escapeHtml(label)} test run · ${escapeHtml(process.env.TARGET_ENV || "qa")}</p>
    <h1 style="margin:0 0 14px;font-size:22px">${healthy ? "All checks passed" : `${failed} check${failed === 1 ? "" : "s"} need attention`}</h1>

    <table style="border-collapse:collapse;margin-bottom:18px">
      <tr>
        <td style="padding-right:22px"><div style="font-size:22px;font-weight:700;color:#157347">${passed}</div><div style="font-size:11px;color:#77869a;text-transform:uppercase">Passed</div></td>
        <td style="padding-right:22px"><div style="font-size:22px;font-weight:700;color:${failed ? "#b42318" : "#77869a"}">${failed}</div><div style="font-size:11px;color:#77869a;text-transform:uppercase">Failed</div></td>
        <td style="padding-right:22px"><div style="font-size:22px;font-weight:700;color:#77869a">${skipped}</div><div style="font-size:11px;color:#77869a;text-transform:uppercase">Skipped</div></td>
        <td><div style="font-size:22px;font-weight:700">${rate}%</div><div style="font-size:11px;color:#77869a;text-transform:uppercase">Pass rate</div></td>
      </tr>
    </table>

    ${
      failures.length
        ? `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#77869a;border-bottom:1px solid #dbe3ee;padding-bottom:6px">What failed</h2>
           <table style="width:100%;border-collapse:collapse">${failureRows}</table>
           ${failures.length > 25 ? `<p style="font-size:12px;color:#77869a">…and ${failures.length - 25} more, in the attached report.</p>` : ""}`
        : `<p style="margin:0 0 14px;color:#40506a">Nothing needs attention in this run.</p>`
    }

    <p style="margin:20px 0 0;font-size:13px;color:#40506a">
      The attached PDF explains every failure in plain terms - what happened, what it means and who should look at it.
      ${runUrl ? `<br><a href="${runUrl}" style="color:#2d4e86">Open the full run on GitHub</a>` : ""}
    </p>
  </div>
</body></html>`;

fs.writeFileSync(path.join(finalDir, "email.html"), html);

// The workflow reads this as the subject line.
console.log(
  `${healthy ? "PASS" : "FAIL"} · LAMISPlus ${label} tests · ${passed}/${total} passed${failed ? ` · ${failed} failed` : ""}`
);
