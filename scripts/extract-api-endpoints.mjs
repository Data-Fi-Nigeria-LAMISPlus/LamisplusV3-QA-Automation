#!/usr/bin/env node
// Builds the endpoint inventory the sweep spec runs against.
//
// Why not read Swagger: /swagger-ui/index.html and every api-docs path on QA
// answer 401 to an anonymous request, to a valid bearer token and to basic auth.
// The UI opens in a browser session, but nothing scriptable can reach the
// document, so the inventory is taken from the controllers instead - the same
// information Swagger renders, from the source it renders it from.
//
// The backend lives outside this repository, so this is run by hand when the API
// changes and the result is committed:
//
//   node scripts/extract-api-endpoints.mjs --source ../Lamisplus3.0/api
//
// Writes cypress/fixtures/api-endpoints.json.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const SOURCE = path.resolve(flagValue("source", "../Lamisplus3.0/api"));
const OUT = path.resolve(flagValue("out", "cypress/fixtures/api-endpoints.json"));

// Left out of the sweep even when they are GETs: these either change state,
// move a lot of data, or end the session the sweep is using.
const UNSAFE = /backup|export|import|download|logout|shutdown|restart|install|uninstall|sync\/trigger|generator|delete|archive/i;

// Each plugin is mounted under /plugin/<name>, and the controllers know nothing
// about it - EncounterController declares /api/v1/encounter and is served at
// /plugin/ehr/api/v1/encounter. Without this the extracted paths look right and
// 404 everywhere, which reads as a routing gap in the API rather than a mistake
// in the inventory. Confirmed against the paths the frontend calls.
//
// Modules absent from this map are skipped rather than guessed at: a wrong
// prefix produces confident nonsense.
const MODULE_PREFIX = {
  "lamisplus-core": "",
  "lamisplus-ehr": "/plugin/ehr",
  "lamisplus-pbh": "/plugin/pbh",
  "lamisplus-inpatient": "/plugin/inpatient",
  "appointment-plugin": "/plugin/appointments",
  "report-plugin": "/plugin/reports",
};

const moduleOf = (file) => {
  const relative = path.relative(SOURCE, file).replace(/\\/g, "/");
  return relative.split("/")[0];
};

if (!fs.existsSync(SOURCE)) {
  console.error(`Backend source not found at ${SOURCE}`);
  console.error("Pass --source <path to Lamisplus3.0/api>");
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".java")) files.push(full);
  }
})(SOURCE);

// Base paths are usually constants, so the annotations have to be resolved
// against them - but scoped, not pooled.
//
// A single global pool gets this wrong: several modules each declare their own
// BASE_URL, and whichever file was read last silently wins for everybody. That
// produced paths like /api/v1/core/health/details for RoleController, which then
// 404 and look like missing routes. Resolution goes same file, then same module,
// then global.
// Constants are stored as their raw expression, not as a finished string, and
// resolved recursively. Controllers build their base from another constant -
// BASE_VERSION = CORE_BASE_URL + "/v1/roles" - so a matcher that only captures
// plain literals misses those and falls back to whichever same-named constant it
// did capture. Three core controllers each declare BASE_VERSION; only the health
// one is a plain literal, so every other controller inherited the health path.
const byFile = new Map();
const byModule = new Map();
const globalConstants = {};

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const module = moduleOf(file);
  const fileConstants = {};

  for (const match of text.matchAll(/static\s+final\s+String\s+(\w+)\s*=\s*([^;]+);/g)) {
    const [, name, expression] = match;
    fileConstants[name] = expression.trim();
    if (!byModule.has(module)) byModule.set(module, {});
    // A file-local definition must not be overwritten by another file's, so the
    // module and global pools only take a name the first time they see it.
    if (!(name in byModule.get(module))) byModule.get(module)[name] = expression.trim();
    if (!(name in globalConstants)) globalConstants[name] = expression.trim();
  }
  byFile.set(file, fileConstants);
}

const lookup = (name, file) =>
  byFile.get(file)?.[name] ??
  byModule.get(moduleOf(file))?.[name] ??
  globalConstants[name];

const resolve = (raw, file, depth = 0) => {
  if (!raw || depth > 6) return "";
  const trimmed = raw.trim();

  return trimmed
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('"')) return part.replace(/^"|"$/g, "");
      const expression = lookup(part, file);
      if (expression === undefined) return `{${part}}`;
      // The constant may itself be composed, hence the recursion.
      return resolve(expression, file, depth + 1);
    })
    .join("");
};

const endpoints = [];
const skippedModules = new Set();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (!/@RestController|@Controller/.test(text)) continue;

  const module = moduleOf(file);
  const prefix = MODULE_PREFIX[module];
  if (prefix === undefined) {
    skippedModules.add(module);
    continue;
  }

  const classMapping = text.match(/@RequestMapping\(\s*(?:value\s*=\s*)?([^)]*?)\s*\)/);
  const base = classMapping ? resolve(classMapping[1].split(",")[0], file) : "";

  for (const match of text.matchAll(/@(Get|Post|Put|Delete|Patch)Mapping\(?\s*(?:value\s*=\s*)?([^)\n]*)\)?/g)) {
    const verb = match[1].toUpperCase();
    let suffix = resolve((match[2] || "").split(",")[0], file);
    if (suffix && !suffix.startsWith("/") && !suffix.startsWith("{")) suffix = `/${suffix}`;

    endpoints.push({
      verb,
      path: `${prefix}${base}${suffix}`.replace(/\/+/g, "/"),
      controller: path.basename(file, ".java"),
      module,
    });
  }
}

const seen = new Set();
const unique = endpoints.filter((endpoint) => {
  const key = `${endpoint.verb} ${endpoint.path}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Only parameterless GETs can be called blind. Anything with a path variable
// needs a real id, and anything that writes needs a payload and a cleanup plan.
const sweepable = unique
  .filter((endpoint) => endpoint.verb === "GET")
  .filter((endpoint) => !/\{/.test(endpoint.path))
  .filter((endpoint) => !UNSAFE.test(endpoint.path))
  .sort((a, b) => a.path.localeCompare(b.path));

const byVerb = unique.reduce((counts, endpoint) => {
  counts[endpoint.verb] = (counts[endpoint.verb] ?? 0) + 1;
  return counts;
}, {});

const inventory = {
  generatedFrom: path.relative(process.cwd(), SOURCE).replace(/\\/g, "/"),
  generatedAt: new Date().toISOString().slice(0, 10),
  totals: { all: unique.length, byVerb, sweepable: sweepable.length },
  skippedModules: [...skippedModules],
  note:
    "Sweepable = GET endpoints with no path variable and no side effect, so they can be called without setup. " +
    "Regenerate with: node scripts/extract-api-endpoints.mjs --source ../Lamisplus3.0/api",
  sweepable,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(inventory, null, 2));

console.log(`${unique.length} endpoints found`);
console.log(`  by verb: ${Object.entries(byVerb).map(([verb, count]) => `${verb} ${count}`).join(", ")}`);
console.log(`  sweepable: ${sweepable.length}`);
if (skippedModules.size) {
  console.log(`  skipped modules (mount path unknown): ${[...skippedModules].join(", ")}`);
}
console.log(`written to ${path.relative(process.cwd(), OUT)}`);
