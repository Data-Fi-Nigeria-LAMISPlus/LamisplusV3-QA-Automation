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

const stagesFlag = flag("stages", null);

const CONFIG = {
  vus: Number(flag("vus", 10)),
  duration: Number(flag("duration", 60)),      // seconds of sustained load
  rampUp: Number(flag("ramp", 15)),            // seconds spent reaching full load
  thresholdP95: Number(flag("p95", 1500)),     // ms
  thresholdErrorRate: Number(flag("error-rate", 1)), // percent
  baselineOnly: Boolean(flag("baseline-only", false)),
  outDir: String(flag("out", "cypress/reports/perf")),

  // Performance mode's own budget. A percentile means nothing on one sample per
  // endpoint, so the performance run is graded on a flat per-endpoint ceiling
  // instead: is any single endpoint slow when nothing else is happening?
  maxEndpointMs: Number(flag("max-endpoint-ms", 1000)),

  // Stress mode: --stages 10,25,50,100 walks up through those user counts,
  // measuring each separately. One number tells you whether it coped at that
  // level; a set of them tells you where it stops coping, which is the question
  // worth asking before a rollout.
  stages: typeof stagesFlag === "string"
    ? stagesFlag.split(",").map((value) => Number(value.trim())).filter((value) => value > 0)
    : null,
  stageDuration: Number(flag("stage-duration", 30)),
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

async function loadPass(base, env, { vus, duration, rampUp, quiet = false } = {}) {
  const users = vus ?? CONFIG.vus;
  const seconds = duration ?? CONFIG.duration;
  const ramp = rampUp ?? CONFIG.rampUp;

  const pick = weightedPicker(ENDPOINTS);
  const samples = [];
  const perEndpoint = new Map(ENDPOINTS.map((endpoint) => [endpoint.name, []]));
  const statuses = new Map();
  let stop = false;

  const rampMs = ramp * 1000;
  const totalMs = rampMs + seconds * 1000;
  const startedAt = Date.now();

  if (!quiet) {
    console.log(`\nLoad - ${users} virtual users, ${ramp}s ramp then ${seconds}s sustained\n`);
  }

  const virtualUser = async (index) => {
    // Stagger arrivals across the ramp so load builds rather than spikes.
    await new Promise((resolve) => setTimeout(resolve, Math.round((rampMs / users) * index)));

    while (!stop && Date.now() - startedAt < totalMs) {
      const endpoint = pick();
      const result = await timedGet(base, endpoint, env);

      samples.push(result.ms);
      perEndpoint.get(endpoint.name).push(result.ms);
      const key = result.error ? `network: ${result.error}` : String(result.status);
      statuses.set(key, (statuses.get(key) ?? 0) + 1);
    }
  };

  const progress = quiet
    ? null
    : setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        process.stdout.write(`  ${elapsed}s elapsed, ${samples.length} requests\r`);
      }, 5000);

  await Promise.all(Array.from({ length: users }, (_, index) => virtualUser(index)));
  stop = true;
  if (progress) clearInterval(progress);

  const wallSeconds = (Date.now() - startedAt) / 1000;
  const countWhere = (test) =>
    [...statuses.entries()].filter(([status]) => test(status)).reduce((sum, [, count]) => sum + count, 0);

  // 429 is kept apart from the failures on purpose. Being throttled is the API
  // protecting itself and answering correctly; a 500 is the API breaking. Adding
  // them together reads as "12% errors" when nothing actually failed, which is
  // the difference between a capacity note and an incident.
  const ok = countWhere((status) => /^2\d\d$/.test(status));
  const throttled = countWhere((status) => status === "429");
  const failed = samples.length - ok - throttled;

  return {
    samples,
    perEndpoint,
    statuses,
    wallSeconds,
    users,
    errorRate: samples.length ? (failed / samples.length) * 100 : 0,
    throttleRate: samples.length ? (throttled / samples.length) * 100 : 0,
    throughput: samples.length / wallSeconds,
  };
}

// Walks up through the requested user counts, measuring each level on its own.
//
// The interesting output is not any single row but the shape of the columns:
// while throughput keeps rising and p95 stays flat there is headroom, and the
// level where throughput stops rising but latency climbs is the one to quote.
async function stagedPass(base, env) {
  console.log(`\nStress - stages of ${CONFIG.stages.join(", ")} users, ${CONFIG.stageDuration}s each\n`);
  console.log(
    `  ${pad("users", 8)}${padLeft("requests", 10)}${padLeft("req/s", 9)}${padLeft("p50", 7)}${padLeft("p95", 7)}${padLeft("p99", 7)}${padLeft("throttled", 11)}${padLeft("failed", 9)}`
  );
  console.log(`  ${"-".repeat(68)}`);

  const stages = [];
  for (const users of CONFIG.stages) {
    const result = await loadPass(base, env, {
      vus: users,
      duration: CONFIG.stageDuration,
      // A short ramp inside each stage; the previous stage already warmed things.
      rampUp: Math.min(5, Math.max(1, Math.round(users / 10))),
      quiet: true,
    });

    const stats = summarise(result.samples);
    const row = {
      users,
      requests: stats.count,
      throughput: Number(result.throughput.toFixed(1)),
      p50: Math.round(stats.p50),
      p95: Math.round(stats.p95),
      p99: Math.round(stats.p99),
      errorRate: Number(result.errorRate.toFixed(2)),
      throttleRate: Number(result.throttleRate.toFixed(2)),
      statuses: Object.fromEntries(result.statuses),
    };
    stages.push(row);

    // "Healthy" means fast and not failing. Throttling is reported beside it
    // rather than folded into it - see the note in loadPass.
    const withinThresholds =
      row.p95 <= CONFIG.thresholdP95 && row.errorRate <= CONFIG.thresholdErrorRate && row.throttleRate === 0;
    console.log(
      `  ${pad(users, 8)}${padLeft(row.requests, 10)}${padLeft(row.throughput, 9)}${padLeft(row.p50, 7)}${padLeft(
        row.p95, 7
      )}${padLeft(row.p99, 7)}${padLeft(row.throttleRate + "%", 11)}${padLeft(row.errorRate + "%", 9)}${
        withinThresholds ? "" : row.errorRate > CONFIG.thresholdErrorRate ? "   <-- failing" : "   <-- throttled"
      }`
    );
  }

  // The highest level served in full: fast, nothing failing, and nothing turned
  // away. Above this the API still answers, it just starts refusing some callers.
  const healthy = stages.filter(
    (s) => s.p95 <= CONFIG.thresholdP95 && s.errorRate <= CONFIG.thresholdErrorRate && s.throttleRate === 0
  );
  const best = healthy.length ? healthy[healthy.length - 1] : null;

  // If throughput stops rising while users keep increasing, the ceiling may be
  // this machine rather than the server. Worth saying out loud before anyone
  // quotes the number as a server limit.
  const peak = stages.reduce((max, s) => (s.throughput > max.throughput ? s : max), stages[0]);
  const plateaued = peak !== stages[stages.length - 1];

  const firstThrottled = stages.find((s) => s.throttleRate > 0);
  const firstFailing = stages.find((s) => s.errorRate > CONFIG.thresholdErrorRate);

  console.log(
    best
      ? `\n  served in full up to ${best.users} users at ${best.throughput} req/s (p95 ${best.p95}ms)`
      : `\n  no stage was served in full`
  );
  if (firstThrottled) {
    console.log(
      `  rate limiting starts at ${firstThrottled.users} users (${firstThrottled.throttleRate}% of requests got 429)`
    );
    console.log(`  those callers were refused, not failed - the API answered correctly under pressure.`);
  }
  if (firstFailing) {
    console.log(`  genuine failures appear at ${firstFailing.users} users (${firstFailing.errorRate}%)`);
  }
  if (plateaued) {
    console.log(
      `  throughput peaked at ${peak.users} users (${peak.throughput} req/s) and did not rise after.`
    );
    console.log(`  above that the load generator may be the limit, not the API - confirm from a bigger runner.`);
  }

  return { stages, highestHealthy: best, throughputPeak: peak, plateaued };
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

  // Stress mode replaces the single sustained pass with a walk up through levels.
  if (CONFIG.stages) {
    const staged = await stagedPass(base, env);
    Object.assign(report, staged);

    const breaches = [];
    if (!staged.highestHealthy) {
      breaches.push(`no stage met p95 <= ${CONFIG.thresholdP95}ms and errors <= ${CONFIG.thresholdErrorRate}%`);
    }
    report.breaches = breaches;

    fs.mkdirSync(path.resolve(CONFIG.outDir), { recursive: true });
    const stagedFile = path.join(path.resolve(CONFIG.outDir), "api-load.json");
    fs.writeFileSync(stagedFile, JSON.stringify(report, null, 2));
    console.log(`\n  report      ${stagedFile}`);

    if (breaches.length) {
      console.log(`\n  THRESHOLD BREACHED`);
      breaches.forEach((breach) => console.log(`    - ${breach}`));
      process.exitCode = 1;
    }
    return;
  }

  if (!CONFIG.baselineOnly) {
    const { samples, perEndpoint, statuses, wallSeconds, errorRate, throttleRate, throughput } = await loadPass(base, env);

    const overall = summarise(samples);

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
    console.log(`  throttled   ${throttleRate.toFixed(2)}% (429 - refused, not failed)`);
    console.log(`  error rate  ${errorRate.toFixed(2)}%`);

    Object.assign(report, {
      overall: { ...overall, throughputPerSecond: Number(throughput.toFixed(2)), wallSeconds: Number(wallSeconds.toFixed(1)) },
      byEndpoint,
      statuses: Object.fromEntries(statuses),
      errorRate: Number(errorRate.toFixed(2)),
      throttleRate: Number(throttleRate.toFixed(2)),
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

  // Performance mode ends here: one request per endpoint, graded against a flat
  // per-endpoint budget. Written to its own file so a performance run never
  // overwrites a load run's numbers.
  const slowest = [...baseline].sort((a, b) => b.ms - a.ms)[0];
  const overBudget = baseline.filter((entry) => entry.ms > CONFIG.maxEndpointMs);
  const notOk = baseline.filter((entry) => !entry.ok);

  console.log(`\n  slowest     ${slowest.endpoint} at ${slowest.ms}ms`);
  console.log(`  budget      ${CONFIG.maxEndpointMs}ms per endpoint`);

  report.slowest = { endpoint: slowest.endpoint, ms: slowest.ms };
  report.breaches = [
    ...overBudget.map((entry) => `${entry.endpoint} took ${entry.ms}ms, over the ${CONFIG.maxEndpointMs}ms budget`),
    ...notOk.map((entry) => `${entry.endpoint} answered ${entry.status}`),
  ];

  fs.mkdirSync(path.resolve(CONFIG.outDir), { recursive: true });
  const outFile = path.join(path.resolve(CONFIG.outDir), "api-performance.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n  report      ${outFile}`);

  if (report.breaches.length) {
    console.log(`\n  THRESHOLD BREACHED`);
    report.breaches.forEach((breach) => console.log(`    - ${breach}`));
    process.exitCode = 1;
    return;
  }
  console.log(`\n  every endpoint within budget`);
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
