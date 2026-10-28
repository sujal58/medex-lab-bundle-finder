import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createLatestPlanRunner, describePlanError, formatBaht, isPlanResult, requestPlan,
} from '../src/planner.ts';

const catalog = JSON.parse(readFileSync(new URL('../../data/lab-catalog.json', import.meta.url), 'utf8'));
const examples = catalog.examples;

for (const [index, example] of examples.entries()) {
  test(`accepts exact MedEx example ${index + 1} as planner API response`, async () => {
    const signal = new AbortController().signal;
    let sent = null;
    const fetcher = async (_url, options) => {
      sent = JSON.parse(options.body);
      assert.equal(options.method, 'POST');
      assert.equal(options.signal, signal);
      return new Response(JSON.stringify(example.expected), { status: 200 });
    };
    assert.deepEqual(await requestPlan(example.request.testIds, signal, fetcher), example.expected);
    assert.deepEqual(sent, example.request);
  });
}

test('validates plans before allowing prices to be rendered', () => {
  assert.equal(isPlanResult(examples[0].expected), true);
  assert.equal(isPlanResult({ ...examples[0].expected, total: '1500' }), false);
  assert.equal(isPlanResult({ ...examples[0].expected, items: [{ type: 'package', id: 'P01' }] }), false);
  assert.equal(isPlanResult(null), false);
});

test('translates MedEx 400/422 errors into readable user messages', () => {
  assert.match(describePlanError({ error: 'EMPTY_SELECTION', testIds: [] }, 400), /Select at least one/i);
  assert.match(describePlanError({ error: 'INVALID_TESTS', testIds: ['T99'] }, 400), /T99/);
  assert.match(describePlanError({ error: 'NOT_AVAILABLE', testIds: ['T15'] }, 422), /T15/);
  assert.match(describePlanError(null, 500), /temporarily unavailable/);
});

test('rejects unexpected success payloads instead of showing incorrect prices', async () => {
  await assert.rejects(
    requestPlan(['T01'], new AbortController().signal,
      async () => new Response(JSON.stringify({ total: 9 }), { status: 200 })),
    /unexpected information/i,
  );
});

test('propagates a 422 error with its human-readable explanation', async () => {
  await assert.rejects(
    requestPlan(['T15'], new AbortController().signal,
      async () => new Response(JSON.stringify({ error: 'NOT_AVAILABLE', testIds: ['T15'] }), { status: 422 })),
    /T15/,
  );
});

test('reports a network failure without showing technical details', async () => {
  await assert.rejects(
    requestPlan(['T01'], new AbortController().signal,
      async () => { throw new TypeError('Failed to fetch'); }),
    /Unable to reach the planner/,
  );
});

test('THB formatter includes the correct amount and currency', () => {
  assert.match(formatBaht(1500), /1,500/);
  assert.match(formatBaht(1500), /THB|฿/);
});

test('latest-plan runner ignores a slow earlier response, even when transport ignores abort', async () => {
  const pending = [];
  const runner = createLatestPlanRunner((ids, signal) => new Promise((resolve, reject) => {
    pending.push({ ids, signal, resolve, reject });
  }));
  const seen = [];
  const callbacks = {
    onSuccess: (result) => seen.push(result.total),
    onError: (message) => seen.push(message),
  };
  runner.start(['T02'], callbacks);
  runner.start(['T02', 'T03'], callbacks);
  assert.equal(pending.length, 2);
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(examples[0].expected);
  await Promise.resolve();
  assert.deepEqual(seen, [1500]);
  pending[0].resolve(examples[1].expected);
  await Promise.resolve();
  assert.deepEqual(seen, [1500]);
  runner.cancel();
});

test('latest-plan runner ignores late errors from obsolete requests', async () => {
  const pending = [];
  const runner = createLatestPlanRunner(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const errors = [];
  runner.start(['T01'], { onSuccess: () => {}, onError: (message) => errors.push(message) });
  runner.start(['T02'], { onSuccess: () => {}, onError: (message) => errors.push(message) });
  pending[0].reject(new Error('old error'));
  await Promise.resolve();
  assert.deepEqual(errors, []);
  pending[1].reject(new Error('current error'));
  await Promise.resolve();
  assert.deepEqual(errors, ['current error']);
  runner.cancel();
});

test('cancellation suppresses a response after unmount or empty selection', async () => {
  let resolve;
  const runner = createLatestPlanRunner(() => new Promise((done) => { resolve = done; }));
  let called = false;
  runner.start(['T15'], { onSuccess: () => { called = true; }, onError: () => { called = true; } });
  runner.cancel();
  resolve(examples[2].expected);
  await Promise.resolve();
  assert.equal(called, false);
});
