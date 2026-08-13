#!/usr/bin/env node
// Merge the per-spec mochawesome JSON files in a report directory into one
// report, then render the HTML.
//
// Replaces the previous shell pipeline:
//   mochawesome-merge "cypress/reports/ui/*.json" -o .../final/merged.json && marge ...
//
// That form fails the whole reporting step with
//   TypeError: Cannot read properties of undefined (reading 'filter')
// as soon as the glob matches any .json that is not a mochawesome report -
// mochawesome-merge maps over every match and reads `report.results` without
// checking it exists. The error names no file, so the cause is invisible from
// the CI log.
//
// Here the file list is built in-process and anything without a `results` array
// is skipped by name, so a stray JSON is reported rather than fatal.

import fs from "node:fs";
import path from "node:path";
import { merge } from "mochawesome-merge";
import marge from "mochawesome-report-generator";

function collectReportFiles(reportDir, outFile) {
  if (!fs.existsSync(reportDir)) {
    return { files: [], skipped: [] };
  }

  const files = [];
  const skipped = [];

  for (const entry of fs.readdirSync(reportDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;

    const filePath = path.join(reportDir, entry.name);
    if (path.resolve(filePath) === path.resolve(outFile)) {
      skipped.push(`${entry.name} (merge output)`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      skipped.push(`${entry.name} (unreadable: ${error.message})`);
      continue;
    }

    // The single field mochawesome-merge requires. A merged report has it too,
    // so it is excluded by name above rather than by shape.
    if (!parsed || !Array.isArray(parsed.results)) {
      skipped.push(`${entry.name} (no "results" array - not a mochawesome report)`);
      continue;
    }

    files.push(filePath);
  }

  return { files, skipped };
}

async function main() {
  const reportDirArg = process.argv[2];
  const reportFilename = process.argv[3];

  if (!reportDirArg || !reportFilename) {
    console.error("Usage: node scripts/merge-reports.js <reportDir> <reportFilename>");
    process.exit(1);
  }

  const reportDir = path.resolve(reportDirArg);
  const outDir = path.join(reportDir, "final");
  const outFile = path.join(outDir, "merged.json");

  const { files, skipped } = collectReportFiles(reportDir, outFile);

  for (const entry of skipped) {
    console.warn(`Skipped ${entry}`);
  }

  if (files.length === 0) {
    console.error(`No mochawesome report files found in ${reportDir}.`);
    process.exit(2);
  }

  console.log(`Merging ${files.length} report file(s) from ${reportDir}`);

  const merged = await merge({ files });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
  console.log(`Merged report written to ${outFile}`);

  await marge.create(merged, { reportDir: outDir, reportFilename });
  console.log(`HTML report written to ${path.join(outDir, `${reportFilename}.html`)}`);
}

main().catch((error) => {
  console.error("Failed to merge reports");
  console.error(error);
  process.exit(1);
});
