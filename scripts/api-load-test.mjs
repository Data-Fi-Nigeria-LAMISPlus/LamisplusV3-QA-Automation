#!/usr/bin/env node
// Load and performance test for the LAMISPlus API.
//
// Two passes, because they answer different questions:
//
//   baseline  one request per endpoint, in sequence, on an idle connection.
//             "How fast is this endpoint when nothing else is happening?"
//   load      many virtual users looping over the endpoints for a set time.
//             "Does it hold up, and what does the slow tail look like?"
//
// Written without a load-testing dependency on purpose. The suite already
// installs Cypress and a browser; adding Artillery or k6 to every npm ci for a
// job that is a few hundred lines of fetch is a poor trade, and this way the
// auth handling, the thresholds and the JSON the report is built from are all
// under our control.
//
// Usage
//   node scripts/api-load-test.mjs                       defaults below
//   node scripts/api-load-test.mjs --vus 20 --duration 90
//   node scripts/api-load-test.mjs --p95 800 --error-rate 0.5
//   node scripts/api-load-test.mjs --baseline-only
//
// Exits non-zero when a threshold is breached, so CI can gate on it.

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value === undefined || value.startsWith("--") ? true : value;
};

const CONFIG = {
  vus: Number(flag("vus", 10)),
  duration: Number(flag("duration", 60)),      // seconds of sustained load
  rampUp: Number(flag("ramp", 15)),            // seconds spent reaching full load
  thresholdP95: Number(flag("p95", 1500)),     // ms
  thresholdErrorRate: Number(flag("error-rate", 1)), // percent
  baselineOnly: Boolean(flag("baseline-only", false)),
  outDir: String(flag("out", "cypress/reports/perf")),
};

// The read endpoints the application leans on. Weights approximate how often a
// working clinic actually hits them: the patient register and the worklists are
// opened constantly, the catalogues are opened when a form is filled.
//
// Read-only by design. A load test that writes would leave thousands of rows
// behind on a shared environment and change what the next run measures.
const ENDPOINTS = [
  { name: "patient register",        path: "/plugin/ehr/api/v1/patient?page=0&size=10",              weight: 20 },
  { name: "service points",          path: "/plugin/ehr/api/v1/service-points?size=100",             weight: 10 },
  { name: "encounters",              path: "/plugin/ehr/api/v1/encounter",                           weight: 10 },
  { name: "lab orders",              path: "/plugin/ehr/api/v1/lab-orders",                          weight: 8 },
  { name: "drug catalogue",          path: "/plugin/ehr/api/v1/drug?page=0&size=10",                 weight: 8 },
  { name: "lab tests",               path: "/plugin/ehr/api/v1/lab-test",                            weight: 6 },
  { name: "admissions",              path: "/plugin/inpatient/api/v1/admissions",                    weight: 8 },
  { name: "beds",                    path: "/plugin/inpatient/api/v1/beds",                          weight: 6 },
  { name: "wards",                   path: "/plugin/inpatient/api/v1/wards",                         weight: 4 },
  { name: "codeset groups",          path: "/core/api/v1/codeset-groups/groups",                     weight: 6 },
  { name: "users (paged)",           path: "/core/api/v1/users?page=0&size=10",                      weight: 5 },
  { name: "my plugins",              path: "/core/api/v1/plugin/my-plugins",                         weight: 5 },
  { name: "current user",            path: "/core/api/v1/users/me",                                  weight: 4 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const readEnv = () => {
  const file = path.resolve(".env");
  const fromFile = fs.existsSync(file)
    ? Object.fromEntries(
        fs
          .readFileSync(file, "utf8")
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$/))
          .filter(Boolean)
          .map((match) => [match[1], match[2].replace(/^["']|["']$/g, "")])
      )
    : {};

  // Environment variables win, so CI can supply secrets without a .env file.
  return { ...fromFile, ...process.env };
};

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const summarise = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    mean: sorted.length ? Math.round(total / sorted.length) : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
  };
};

const pad = (value, width) => String(value).padEnd(width);
const padLeft = (value, width) => String(value).padStart(width);

// Weighted pick, so the mix reflects real usage rather than a flat rotation.
const weightedPicker = (endpoints) => {
  const table = [];
  endpoints.forEach((endpoint, index) => {
    for (let n = 0; n < endpoint.weight; n += 1) table.push(index);
  });
  return () => endpoints[table[Math.floor(Math.random() * table.length)]];
};

// ---------------------------------------------------------------------------
// Auth
//
// The login endpoint allows 10 requests per minute per IP. A load test that
// signed in per virtual user would exhaust that in seconds and measure the
// throttle instead of the API, so one token is taken up front and shared. A
// single mid-run refresh is allowed in case the token expires under a long run.
// ---------------------------------------------------------------------------

let token = null;
let refreshing = null;

async function login(base, env) {
  const response = await fetch(`${base}/core/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.EMAIL, password: env.PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  if (!body.accessToken) throw new Error("Login returned no accessToken");
  return body.accessToken;
}

async function refreshToken(base, env) {
  if (!refreshing) {
    refreshing = login(base, env)
      .then((fresh) => {
        token = fresh;
        return fresh;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function timedGet(base, endpoint, env) {
  const started = performance.now();
  try {
    let response = await fetch(base + endpoint.path, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (response.status === 401) {
      await refreshToken(base, env);
      response = await fetch(base + endpoint.path, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
    }

    // Drain the body: without it the connection is not returned to the pool and
    // the timings drift as sockets pile up.
    await response.arrayBuffer();

    return { ms: performance.now() - started, status: response.status, ok: response.ok };
  } catch (error) {
    return { ms: performance.now() - started, status: 0, ok: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

async function baselinePass(base, env) {
  console.log("\nBaseline - one request per endpoint, no concurrency\n");
  console.log(`  ${pad("endpoint", 34)}${padLeft("status", 7)}${padLeft("ms", 8)}`);
  console.log(`  ${"-".repeat(49)}`);

  const results = [];
  for (const endpoint of ENDPOINTS) {
    const result = await timedGet(base, endpoint, env);
    results.push({ endpoint: endpoint.name, path: endpoint.path, ...result, ms: Math.round(result.ms) });
    const marker = result.ok ? "" : "  <-- not 2xx";
    console.log(`  ${pad(endpoint.name, 34)}${padLeft(result.status, 7)}${padLeft(Math.round(result.ms), 8)}${marker}`);
  }
  return results;
}

async function loadPass(base, env) {
  const pick = weightedPicker(ENDPOINTS);
  const samples = [];
  const perEndpoint = new Map(ENDPOINTS.map((endpoint) => [endpoint.name, []]));
  const statuses = new Map();
  let stop = false;

  const rampMs = CONFIG.rampUp * 1000;
  const totalMs = rampMs + CONFIG.duration * 1000;
  const startedAt = Date.now();

  console.log(
    `\nLoad - ${CONFIG.vus} virtual users, ${CONFIG.rampUp}s ramp then ${CONFIG.duration}s sustained\n`
  );

  const virtualUser = async (index) => {
    // Stagger arrivals across the ramp so load builds rather than spikes.
    await new Promise((resolve) => setTimeout(resolve, Math.round((rampMs / CONFIG.vus) * index)));

    while (!stop && Date.now() - startedAt < totalMs) {
      const endpoint = pick();
      const result = await timedGet(base, endpoint, env);

      samples.push(result.ms);
      perEndpoint.get(endpoint.name).push(result.ms);
      const key = result.error ? `network: ${result.error}` : String(result.status);
      statuses.set(key, (statuses.get(key) ?? 0) + 1);
    }
  };

  const progress = setInterval(() => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    process.stdout.write(`  ${elapsed}s elapsed, ${samples.length} requests\r`);
  }, 5000);

  await Promise.all(Array.from({ length: CONFIG.vus }, (_, index) => virtualUser(index)));
  stop = true;
  clearInterval(progress);

  const wallSeconds = (Date.now() - startedAt) / 1000;
  return { samples, perEndpoint, statuses, wallSeconds };
}

// ---------------------------------------------------------------------------

async function main() {
  const env = readEnv();
  const base = env.QA_BASE_URL || env.TARGET_BASE_URL;

  if (!base) throw new Error("No base URL. Set QA_BASE_URL in .env or the environment.");
  if (!env.EMAIL || !env.PASSWORD) throw new Error("Missing EMAIL or PASSWORD.");

  console.log(`LAMISPlus API load and performance test`);
  console.log(`  target      ${base}`);
  console.log(`  endpoints   ${ENDPOINTS.length} read-only`);
  console.log(`  thresholds  p95 <= ${CONFIG.thresholdP95}ms, errors <= ${CONFIG.thresholdErrorRate}%`);

  token = await login(base, env);
  console.log("  auth        signed in");

  const baseline = await baselinePass(base, env);
  const report = {
    target: base,
    startedAt: new Date().toISOString(),
    config: CONFIG,
    baseline,
  };

  if (!CONFIG.baselineOnly) {
    const { samples, perEndpoint, statuses, wallSeconds } = await loadPass(base, env);

    const overall = summarise(samples);
    const ok = [...statuses.entries()]
      .filter(([status]) => /^2\d\d$/.test(status))
      .reduce((sum, [, count]) => sum + count, 0);
    const errorRate = samples.length ? ((samples.length - ok) / samples.length) * 100 : 0;
    const throughput = samples.length / wallSeconds;

    console.log(`\n  ${pad("endpoint", 26)}${padLeft("n", 7)}${padLeft("p50", 8)}${padLeft("p95", 8)}${padLeft("p99", 8)}${padLeft("max", 8)}`);
    console.log(`  ${"-".repeat(65)}`);

    const byEndpoint = {};
    for (const [name, values] of perEndpoint) {
      const stats = summarise(values);
      byEndpoint[name] = stats;
      console.log(
        `  ${pad(name, 26)}${padLeft(stats.count, 7)}${padLeft(Math.round(stats.p50), 8)}${padLeft(
          Math.round(stats.p95), 8
        )}${padLeft(Math.round(stats.p99), 8)}${padLeft(Math.round(stats.max), 8)}`
      );
    }

    console.log(`\n  requests    ${samples.length} in ${wallSeconds.toFixed(1)}s (${throughput.toFixed(1)}/s)`);
    console.log(`  latency     p50 ${Math.round(overall.p50)}ms · p95 ${Math.round(overall.p95)}ms · p99 ${Math.round(overall.p99)}ms · max ${Math.round(overall.max)}ms`);
    console.log(`  responses   ${[...statuses.entries()].map(([status, count]) => `${status}×${count}`).join(", ")}`);
    console.log(`  error rate  ${errorRate.toFixed(2)}%`);

    Object.assign(report, {
      overall: { ...overall, throughputPerSecond: Number(throughput.toFixed(2)), wallSeconds: Number(wallSeconds.toFixed(1)) },
      byEndpoint,
      statuses: Object.fromEntries(statuses),
      errorRate: Number(errorRate.toFixed(2)),
    });

    const breaches = [];
    if (overall.p95 > CONFIG.thresholdP95) {
      breaches.push(`p95 ${Math.round(overall.p95)}ms exceeds ${CONFIG.thresholdP95}ms`);
    }
    if (errorRate > CONFIG.thresholdErrorRate) {
      breaches.push(`error rate ${errorRate.toFixed(2)}% exceeds ${CONFIG.thresholdErrorRate}%`);
    }
    report.breaches = breaches;

    fs.mkdirSync(path.resolve(CONFIG.outDir), { recursive: true });
    const outFile = path.join(path.resolve(CONFIG.outDir), "api-load.json");
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`\n  report      ${outFile}`);

    if (breaches.length) {
      console.log(`\n  THRESHOLD BREACHED`);
      breaches.forEach((breach) => console.log(`    - ${breach}`));
      process.exitCode = 1;
      return;
    }
    console.log(`\n  thresholds met`);
    return;
  }

  fs.mkdirSync(path.resolve(CONFIG.outDir), { recursive: true });
  fs.writeFileSync(path.join(path.resolve(CONFIG.outDir), "api-load.json"), JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("\nLoad test failed to run");
  console.error(error.message);

  // Behind a TLS-inspecting corporate proxy, Node rejects the intercepted
  // certificate while browsers accept it, which makes this look like the API is
  // down when it is not.
  if (/certificate|UNABLE_TO_VERIFY/i.test(String(error.message) + String(error.cause?.message ?? ""))) {
    console.error("\nThe certificate could not be verified. On Node 22+ re-run with:");
    console.error("  node --use-system-ca scripts/api-load-test.mjs");
    console.error("or point NODE_EXTRA_CA_CERTS at your organisation's root certificate.");
  }

  process.exit(2);
});
