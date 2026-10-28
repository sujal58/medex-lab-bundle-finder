import { performance } from "node:perf_hooks";

const BASE_URL = "http://localhost:3001";
const WARMUP = 10;
const RUNS = 100;

const response = await fetch(`${BASE_URL}/api/tests`);
if (!response.ok) throw new Error("Backend is not running");

const tests = await response.json();
const ids = tests.map((test) => test.id);

const scenarios = {
  "Single test": ids.slice(0, 1),
  "Four tests": ["T02", "T03", "T04", "T06"],
  "Package-only test": ["T15"],
  "All selectable tests": ids,
};

async function measure(testIds) {
  const start = performance.now();

  const response = await fetch(`${BASE_URL}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testIds }),
  });

  const body = await response.json();
  const elapsed = performance.now() - start;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return elapsed;
}

for (const [name, testIds] of Object.entries(scenarios)) {
  for (let i = 0; i < WARMUP; i++) {
    await measure(testIds);
  }

  const times = [];

  for (let i = 0; i < RUNS; i++) {
    times.push(await measure(testIds));
  }

  times.sort((a, b) => a - b);

  const average = times.reduce((sum, t) => sum + t, 0) / RUNS;
  const p95 = times[Math.ceil(0.95 * RUNS) - 1];
  const max = times[times.length - 1];

  console.log(`\n${name} (${testIds.length} tests)`);
  console.log(`Average: ${average.toFixed(2)} ms`);
  console.log(`P95:     ${p95.toFixed(2)} ms`);
  console.log(`Maximum: ${max.toFixed(2)} ms`);
  console.log(`Result:  ${max < 300 ? "PASS" : "EXCEEDS 300ms"}`);
}
