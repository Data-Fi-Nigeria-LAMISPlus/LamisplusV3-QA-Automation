#!/usr/bin/env node
// Render a printable PDF of a Cypress run from the merged mochawesome report.
//
// Built from merged.json rather than by printing the mochawesome HTML, for one
// reason: the point of the PDF is that a reader can see WHY each test failed
// without opening anything else. The HTML report keeps failure output behind
// client-side rendering and collapsible panels, which print badly and can drop
// the error text entirely. Here every failure is laid out with its full
// assertion message and the spec and test it came from.
//
// Usage: node scripts/report-to-pdf.js <reportDir> <label> <filename>
//   node scripts/report-to-pdf.js cypress/reports/ui UI ui-report
//
// Writes <reportDir>/final/<filename>.pdf next to the HTML report, so the
// existing "upload the final folder" CI step picks it up unchanged.
//
// Chrome: uses whatever is already installed (puppeteer-core, no bundled
// download) - GitHub's ubuntu runners ship google-chrome, and locally it finds
// Chrome or Edge. With no browser anywhere it warns and exits 0: a missing PDF
// should never turn a green test run red.

import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const findBrowser = () =>
  CHROME_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const specName = (file) => String(file ?? "").replace(/^cypress[\\/]e2e[\\/]/, "").replace(/\\/g, "/");

// ---------------------------------------------------------------------------
// Plain language
//
// The report is read by people who did not write the tests - programme leads,
// clinical staff, whoever signs off a release. Everything below turns filenames
// and assertion output into something they can act on, while the appendix keeps
// the raw detail for whoever has to fix it.
// ---------------------------------------------------------------------------

const GROUPS = {
  clinical: "Patient journeys",
  modules: "Feature areas",
  smoke: "Login and registration",
  "opd-consultation": "OPD consultation",
  api: "Server checks",
};

// Domain words that should not be title-cased into nonsense.
const TERMS = {
  hiv: "HIV", tb: "TB", opd: "OPD", pmtct: "PMTCT", prep: "PrEP", hts: "HTS",
  ict: "ICT", api: "API", ui: "UI", aefi: "AEFI", pbh: "Public health",
  cy: "", js: "", forms: "forms", form: "form",
};

// "ui/modules/hiv-art-enrollment-forms.cy.js" -> "HIV art enrollment forms"
//
// Reads from the end of the path, not the start: specs sit under ui/ or api/
// before their folder, so the first segment is the suite, not the area.
function humaniseSpec(file) {
  const parts = String(file).split("/").filter(Boolean);
  const name = parts[parts.length - 1] ?? String(file);
  const folder = parts[parts.length - 2] ?? "";

  const words = name
    .replace(/\.cy\.js$/, "")
    .split("-")
    .map((word) => (word in TERMS ? TERMS[word] : word))
    .filter(Boolean);

  const label = words.join(" ").trim();
  return {
    group: GROUPS[folder] ?? "Other",
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

// Reads the assertion output and says what happened in ordinary words.
//
// Deliberately hedged where it is an inference: the message tells us what the
// test saw, not always why. Anything asserted here has to be true of the text.
function explain(message) {
  const text = String(message ?? "");

  if (/INTERNAL_ERROR|expected 5\d\d|\b500\b/.test(text)) {
    return {
      severity: "product",
      badge: "System error",
      plain: "The system returned an error when the check tried to save something.",
      impact: "Someone doing this in the app would see the action fail. This is not a problem with the test.",
      action: "A developer needs to look at the server error.",
    };
  }
  if (/SERVICE_UNAVAILABLE|\b503\b/.test(text)) {
    return {
      severity: "product",
      badge: "Feature switched off",
      plain: "The system answered that this feature is not available right now.",
      impact: "The screen works, but nothing can be saved from it on this environment.",
      action: "Confirm whether this feature is meant to be switched on here.",
    };
  }
  if (/INVALID_INPUT_FORMAT|BUSINESS_RULE_VIOLATION|expected 400|\b400\b/.test(text)) {
    return {
      severity: "product",
      badge: "Information rejected",
      plain: "The system refused the information that was sent, saying it was not valid.",
      impact: "Either the screen is sending something wrong, or the check is filling it in incorrectly.",
      action: "A developer should confirm which side is at fault.",
    };
  }
  if (/kept rendering the app 404|Page not found/i.test(text)) {
    return {
      severity: "glitch",
      badge: "Page did not load",
      plain: "The page never appeared - the app showed its 'page not found' screen instead.",
      impact: "Usually a slow load rather than a broken page; this app is known to do it under heavy load.",
      action: "Re-run to confirm. Raise it only if it keeps happening.",
    };
  }
  if (/Expected to find (element|content)|never found it/i.test(text)) {
    return {
      severity: "data",
      badge: "Nothing to work with",
      plain: "The check could not find what it needed on the screen.",
      impact: "Most often there was no patient or record in that list to act on, so the check had nothing to do.",
      action: "Check whether this area has test data on this environment.",
    };
  }
  if (/Timed out retrying|timed out/i.test(text)) {
    return {
      severity: "glitch",
      badge: "Took too long",
      plain: "The screen did not finish what it was doing within the time allowed.",
      impact: "Often a slow environment, but it can also be a genuine hang.",
      action: "Re-run. If it repeats, worth a manual try.",
    };
  }
  return {
    severity: "glitch",
    badge: "Check did not pass",
    plain: "The screen did not behave the way the check expected.",
    impact: "See the technical detail at the end of this report.",
    action: "A tester should review this one.",
  };
}

const SEVERITY_ORDER = { product: 0, data: 1, glitch: 2 };

// How much of the API this suite actually reaches, stated plainly and taken from
// the generated inventory rather than from memory.
//
// Worth printing because the headline is easy to misread: a green API report
// says the endpoints that were called are healthy, not that the API is. Most of
// the surface needs a record id or writes data, and is not called at all.
function apiCoverage() {
  const inventoryPath = path.resolve("cypress/fixtures/api-endpoints.json");
  if (!fs.existsSync(inventoryPath)) return null;

  try {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    const total = inventory.totals?.all ?? 0;
    const byVerb = inventory.totals?.byVerb ?? {};
    const swept = inventory.totals?.sweepable ?? 0;
    const getsNeedingId = (byVerb.GET ?? 0) - swept;
    const writes = total - (byVerb.GET ?? 0);

    return { total, swept, getsNeedingId, writes, generatedAt: inventory.generatedAt };
  } catch {
    return null;
  }
}

// What the run this report came from actually does, in plain words.
//
// Readers get the report without the workflow file, so "UI Tests ran" means
// nothing on its own - this says what was exercised, when it runs and what a
// pass is worth. Keyed by the label the report is built with.
const ABOUT = {
  UI: {
    workflow: ".github/workflows/cypress-ui.yml",
    runs: "Every push to master, every night at 03:00 UTC, and on demand.",
    what: [
      "A robot signs in and drives the application in a real browser: it opens every screen in the sidebar, works through the patient journey from registration to consultation, and fills in the clinical forms across HIV, TB, immunization, family planning, pharmacy, laboratory and inpatient care.",
      "It types into the forms the same way a member of staff would, saves them, and checks what the screen does next.",
    ],
    caveat:
      "Most of these forms do not store anything yet - their save button is not connected to the server. For those, a pass means the screen works and every field can be filled in, not that the data was kept. Immunization, viral hepatitis, pharmacy, family planning and the inpatient screens do save, and those are checked properly.",
  },
  API: {
    workflow: ".github/workflows/cypress-api.yml",
    runs: "Every push to master, every night at 03:00 UTC, and on demand.",
    what: [
      "This one skips the screens entirely and talks to the server directly, the way the application does behind the scenes.",
      "It signs in, then asks the server for the things the app needs - the patient register, the wards and beds, the drug and laboratory catalogues, users and permissions - and checks each answer comes back correctly and in the shape the app expects.",
      "It also checks the server turns away requests it should: no sign-in, a forged sign-in, or a user reaching for something outside their facility.",
    ],
    caveat:
      "Read-only. Nothing here creates or changes patient data, so it is safe to run against a live environment at any time.",
  },
};

const formatDuration = (ms) => {
  const total = Math.round((Number(ms) || 0) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
};

// Cypress assertion messages carry the whole rendered table or payload they
// compared against, which can run to thousands of characters. Keep enough to
// diagnose from, and say plainly that the rest was cut.
const trim = (text, limit = 700) => {
  const clean = String(text ?? "").replace(/\r/g, "").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}\n… (truncated - see the HTML report)` : clean;
};

// Walks a spec's suites depth-first. Hook failures are collected too: a failing
// beforeEach lands as its own entry and is often the only sign that a whole
// describe block never ran.
function collectTests(node, specFile, out) {
  for (const test of node.tests ?? []) {
    out.push({ ...test, specFile });
  }
  for (const hook of [...(node.beforeHooks ?? []), ...(node.afterHooks ?? [])]) {
    if (hook?.err?.message) out.push({ ...hook, specFile, isHook: true });
  }
  for (const suite of node.suites ?? []) {
    collectTests(suite, specFile, out);
  }
}

function summarise(merged) {
  const specs = [];
  const failures = [];

  for (const result of merged.results ?? []) {
    const file = specName(result.file ?? result.fullFile);
    const tests = [];
    collectTests(result, file, tests);

    const counts = {
      total: tests.filter((test) => !test.isHook).length,
      passed: tests.filter((test) => test.pass).length,
      failed: tests.filter((test) => test.fail).length,
      pending: tests.filter((test) => test.pending).length,
      skipped: tests.filter((test) => test.skipped).length,
    };

    for (const test of tests.filter((entry) => entry.fail || (entry.isHook && entry.err?.message))) {
      failures.push({
        spec: file,
        title: test.fullTitle || test.title,
        message: test.err?.message ?? "No error message recorded",
        where: (test.err?.estack ?? "").split("\n").find((line) => /\.cy\.js|support[\\/]/.test(line))?.trim() ?? "",
      });
    }

    specs.push({ file, ...counts, duration: result.duration ?? 0 });
  }

  specs.sort((a, b) => (b.failed - a.failed) || a.file.localeCompare(b.file));
  return { specs, failures };
}

function buildHtml({ label, stats, specs, failures, env, generatedAt }) {
  const passRate = stats.tests ? ((stats.passes / stats.tests) * 100).toFixed(1) : "0.0";
  const failedSpecs = specs.filter((spec) => spec.failed > 0).length;

  // Each failure explained in ordinary words, worst kind first.
  const explained = failures
    .map((failure) => ({ ...failure, area: humaniseSpec(failure.spec), ...explain(failure.message) }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const productCount = explained.filter((entry) => entry.severity === "product").length;

  const failureBlocks = explained.length
    ? explained
        .map(
          (entry) => `
        <article class="failure sev-${entry.severity}">
          <div class="f-top">
            <span class="badge b-${entry.severity}">${escapeHtml(entry.badge)}</span>
            <span class="f-area">${escapeHtml(entry.area.label)}</span>
          </div>
          <h3>${escapeHtml(entry.title)}</h3>
          <dl>
            <dt>What happened</dt><dd>${escapeHtml(entry.plain)}</dd>
            <dt>What it means</dt><dd>${escapeHtml(entry.impact)}</dd>
            <dt>Next step</dt><dd>${escapeHtml(entry.action)}</dd>
          </dl>
        </article>`
        )
        .join("")
    : `<p class="none">Nothing needs attention - every check in this run passed.</p>`;

  // Grouped by area, named the way a reader would name them.
  const grouped = new Map();
  for (const spec of specs) {
    const { group, label } = humaniseSpec(spec.file);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push({ ...spec, label });
  }

  const areaTables = [...grouped.entries()]
    .map(
      ([group, rows]) => `
      <h3 class="grp">${escapeHtml(group)}</h3>
      <table>
        <thead><tr><th>Area checked</th><th class="num">Checks</th><th class="num">Passed</th><th class="num">Needs attention</th></tr></thead>
        <tbody>${rows
          .map(
            (row) => `
          <tr class="${row.failed ? "row-fail" : ""}">
            <td>${escapeHtml(row.label)}</td>
            <td class="num">${row.total}</td>
            <td class="num">${row.passed}</td>
            <td class="num ${row.failed ? "bad" : "muted"}">${row.failed || "–"}</td>
          </tr>`
          )
          .join("")}</tbody>
      </table>`
    )
    .join("");

  // Kept for whoever fixes it: the raw assertion output, unedited.
  const appendix = explained.length
    ? explained
        .map(
          (entry) => `
        <article class="tech">
          <p class="t-head">${escapeHtml(entry.spec)}</p>
          <p class="t-title">${escapeHtml(entry.title)}</p>
          <pre>${escapeHtml(trim(entry.message))}</pre>
          ${entry.where ? `<p class="f-where">${escapeHtml(entry.where)}</p>` : ""}
        </article>`
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(label)} test report</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #16202e; font-size: 10.5pt; line-height: 1.5; }
  h1 { font-size: 21pt; margin: 0 0 4px; letter-spacing: -0.02em; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;
       border-bottom: 1px solid #d7dee8; padding-bottom: 6px; margin: 26px 0 14px; }
  .sub { color: #5b6a7f; margin: 0 0 4px; }
  .meta { font-family: ui-monospace, Consolas, monospace; font-size: 8.5pt; color: #77869a; }
  .cards { display: flex; gap: 8px; margin-top: 16px; }
  .card { flex: 1; border: 1px solid #d7dee8; border-radius: 3px; padding: 10px 12px; }
  .card .n { font-size: 17pt; font-weight: 700; font-variant-numeric: tabular-nums; display: block; line-height: 1.15; }
  .card .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.07em; color: #77869a; }
  .card.pass .n { color: #157347; } .card.fail .n { color: #b42318; }
  .intro { background: #f4f7fb; border: 1px solid #dbe3ee; border-radius: 3px; padding: 12px 14px; margin-top: 16px; }
  .intro p { margin: 0 0 7px; } .intro p:last-child { margin: 0; }
  .about-meta { font-size: 9pt; color: #5b6a7f; border-top: 1px solid #dbe3ee; padding-top: 7px; }
  .about-meta code { font-family: ui-monospace, Consolas, monospace; font-size: 8.5pt; }
  .verdict { font-size: 12pt; line-height: 1.5; margin: 16px 0 0; }
  .verdict strong { color: #16202e; }
  .failure { border: 1px solid #dbe3ee; border-left: 3px solid #94a3b8; border-radius: 3px;
             padding: 11px 13px; margin-bottom: 10px; background: #fbfcfe; page-break-inside: avoid; }
  .failure.sev-product { border-left-color: #b42318; background: #fdf7f6; border-color: #e6d0cc; }
  .failure.sev-data { border-left-color: #b3730f; background: #fdfaf3; border-color: #e8dcc4; }
  .failure h3 { font-size: 10.5pt; margin: 6px 0 8px; font-weight: 600; }
  .f-top { display: flex; align-items: center; gap: 9px; }
  .badge { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700;
           padding: 2px 7px; border-radius: 2px; color: #fff; }
  .b-product { background: #b42318; } .b-data { background: #b3730f; } .b-glitch { background: #64748b; }
  .f-area { font-size: 8.5pt; color: #64748b; }
  dl { margin: 0; display: grid; grid-template-columns: 92px 1fr; gap: 3px 10px; }
  dt { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #77869a; padding-top: 1px; }
  dd { margin: 0; font-size: 9.5pt; }
  .f-where { font-family: ui-monospace, Consolas, monospace; font-size: 8pt; color: #77869a; margin: 7px 0 0; }
  pre { font-family: ui-monospace, Consolas, monospace; font-size: 8pt; line-height: 1.45; white-space: pre-wrap;
        word-break: break-word; background: #fff; border: 1px solid #e3e8f0; border-radius: 2px; padding: 8px 9px; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 14px; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.07em; color: #77869a;
       border-bottom: 1px solid #d7dee8; padding: 0 7px 5px 0; }
  td { padding: 4px 7px 4px 0; border-bottom: 1px solid #eef1f6; }
  tr { page-break-inside: avoid; }
  .grp { font-size: 9.5pt; margin: 16px 0 6px; color: #16202e; }
  .num { text-align: right; font-variant-numeric: tabular-nums; width: 74px; }
  .bad { color: #b42318; font-weight: 700; } .muted { color: #77869a; }
  .row-fail td:first-child { font-weight: 600; }
  .none { color: #157347; font-weight: 600; }
  .tech { margin-bottom: 10px; page-break-inside: avoid; }
  .t-head { font-family: ui-monospace, Consolas, monospace; font-size: 8pt; color: #77869a; margin: 0; }
  .t-title { font-size: 9pt; font-weight: 600; margin: 1px 0 5px; }
  .appendix-note { color: #64748b; font-size: 9.5pt; margin: 0 0 12px; }
  .page-break { page-break-before: always; }
</style></head><body>
  <h1>${escapeHtml(label)} test report</h1>
  <p class="sub">Automated testing of LAMISPlus on the <strong>${escapeHtml(env)}</strong> environment</p>
  <p class="meta">${escapeHtml(generatedAt)} &nbsp;·&nbsp; took ${formatDuration(stats.duration)}</p>

  <div class="intro">
    <p><strong>How to read this.</strong> ${(ABOUT[label]?.what ?? [
      "An automated suite exercises the system and verifies what it does.",
    ])
      .map((paragraph) => escapeHtml(paragraph))
      .join("</p>\n    <p>")}</p>
    <p>Each thing it verifies is one <em>check</em>. A check that passes means that part of the
    system behaved correctly. A check that does not pass is listed below, in plain terms, with what
    it means and who should look at it.</p>
    ${ABOUT[label]?.caveat ? `<p><strong>Worth knowing.</strong> ${escapeHtml(ABOUT[label].caveat)}</p>` : ""}
    ${
      label === "API" && apiCoverage()
        ? (() => {
            const c = apiCoverage();
            return `<p><strong>How much is covered.</strong> The API has ${c.total} endpoints in total. This suite calls
              <strong>${c.swept}</strong> of them on every run - the ones that can be requested without setting anything up
              first. The remaining ${c.getsNeedingId + c.writes} are not called: ${c.getsNeedingId} need the id of an
              existing record, and ${c.writes} create, change or delete data, which needs a payload and a way to clean up
              afterwards. So a green report here means the endpoints that were called are healthy - not that the whole API is.</p>`;
          })()
        : ""
    }
    ${
      ABOUT[label]
        ? `<p class="about-meta"><strong>When it runs.</strong> ${escapeHtml(ABOUT[label].runs)}
           &nbsp;·&nbsp; Defined in <code>${escapeHtml(ABOUT[label].workflow)}</code></p>`
        : ""
    }
  </div>

  <div class="cards">
    <div class="card pass"><span class="n">${stats.passes}</span><span class="k">Checks passed</span></div>
    <div class="card fail"><span class="n">${stats.failures}</span><span class="k">Need attention</span></div>
    <div class="card"><span class="n">${(stats.pending ?? 0) + (stats.skipped ?? 0)}</span><span class="k">Not run</span></div>
    <div class="card"><span class="n">${passRate}%</span><span class="k">Passed</span></div>
    <div class="card"><span class="n">${specs.length - failedSpecs}/${specs.length}</span><span class="k">Areas fully clear</span></div>
  </div>

  <p class="verdict">
    <strong>In short:</strong> ${stats.passes} of ${stats.tests} checks passed${
      stats.failures === 0
        ? ", and nothing needs attention."
        : `. ${stats.failures} did not, across ${failedSpecs} of ${specs.length} areas${
            productCount
              ? `, and ${productCount} of those point at a problem in the system itself rather than the test.`
              : ", and none of them point at a problem in the system itself."
          }`
    }
  </p>

  <h2>What needs attention (${explained.length})</h2>
  ${failureBlocks}

  <h2>What was tested</h2>
  ${areaTables}

  ${
    appendix
      ? `<div class="page-break"></div>
  <h2>Technical detail</h2>
  <p class="appendix-note">For whoever picks these up: the exact output for each failed check, as the test recorded it.</p>
  ${appendix}`
      : ""
  }
</body></html>`;
}

async function main() {
  const [reportDirArg, label = "UI", filename = "ui-report"] = process.argv.slice(2);

  if (!reportDirArg) {
    console.error("Usage: node scripts/report-to-pdf.js <reportDir> <label> <filename>");
    process.exit(1);
  }

  const finalDir = path.join(path.resolve(reportDirArg), "final");
  const mergedPath = path.join(finalDir, "merged.json");

  if (!fs.existsSync(mergedPath)) {
    console.error(`No merged report at ${mergedPath}. Run the merge step first.`);
    process.exit(2);
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    // A GitHub annotation rather than a failure: the HTML report is still there.
    console.log("::warning title=PDF report skipped::No Chrome or Edge found; set CHROME_PATH to enable the PDF.");
    console.warn("No Chrome/Edge executable found - skipping PDF generation.");
    return;
  }

  const merged = JSON.parse(fs.readFileSync(mergedPath, "utf8"));
  const { specs, failures } = summarise(merged);

  const html = buildHtml({
    label,
    stats: merged.stats ?? {},
    specs,
    failures,
    env: process.env.TARGET_ENV || process.env.env || "qa",
    generatedAt: new Date(merged.stats?.end ?? Date.now()).toISOString().replace("T", " ").slice(0, 16) + " UTC",
  });

  const htmlPath = path.join(finalDir, `${filename}-print.html`);
  fs.writeFileSync(htmlPath, html);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });

    const pdfPath = path.join(finalDir, `${filename}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:7pt;color:#8a97a8;width:100%;padding:0 14mm;">${escapeHtml(label)} test report</div>`,
      footerTemplate:
        '<div style="font-size:7pt;color:#8a97a8;width:100%;padding:0 14mm;text-align:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });

    console.log(`PDF report written to ${pdfPath}`);
    console.log(`  ${merged.stats?.passes ?? 0} passed, ${merged.stats?.failures ?? 0} failed, ${failures.length} failure(s) detailed`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Failed to build the PDF report");
  console.error(error);
  process.exit(1);
});
