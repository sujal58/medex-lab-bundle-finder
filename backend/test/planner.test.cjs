const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const { normalizeCatalog } = require('../dist/catalog/catalog.loader.js');
const { calculatePlan } = require('../dist/planner/plan.js');
const { PlanError } = require('../dist/planner/planner.types.js');

const dataset = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/lab-catalog.json'), 'utf8'),
);
const catalog = normalizeCatalog(dataset);

for (const [index, example] of dataset.examples.entries()) {
  test(`official MedEx example ${index + 1}: exact expected response`, () => {
    assert.deepStrictEqual(calculatePlan(catalog, example.request.testIds), example.expected);
  });
}

test('duplicates count once and covers preserve the requested order', () => {
  const result = calculatePlan(catalog, ['T06', 'T02', 'T03', 'T04', 'T02']);
  assert.deepStrictEqual(result.items.map((item) => item.id), ['P02']);
  assert.deepStrictEqual(result.items[0].covers, ['T06', 'T02', 'T03', 'T04']);
  assert.equal(result.total, 1500);
});

test('empty selection is a 400 EMPTY_SELECTION error', () => {
  assert.throws(() => calculatePlan(catalog, []), (error) =>
    error instanceof PlanError && error.status === 400 &&
    assert.deepStrictEqual(error.toResponse(), { error: 'EMPTY_SELECTION', testIds: [] }) === undefined,
  );
});

test('unknown and inactive tests are rejected once each in selection order', () => {
  assert.throws(() => calculatePlan(catalog, ['T19', 'BAD', 'T19']), (error) =>
    error instanceof PlanError && error.status === 400 &&
    assert.deepStrictEqual(error.toResponse(), {
      error: 'INVALID_TESTS', testIds: ['T19', 'BAD'],
    }) === undefined,
  );
});

test('inactive packages are not considered', () => {
  const result = calculatePlan(catalog, ['T05', 'T14']);
  assert.deepStrictEqual(result.items.map((item) => item.id), ['T05', 'T14']);
  assert.equal(result.total, 1200);
});

test('a package-only test returns null individualTotal and null savings', () => {
  const result = calculatePlan(catalog, ['T15']);
  assert.equal(result.individualTotal, null);
  assert.equal(result.savings, null);
  assert.deepStrictEqual(result.extraTests, ['T14']);
});

test('unknown T99 in package P12 is not reported as a free extra', () => {
  const result = calculatePlan(catalog, ['T13', 'T17']);
  assert.deepStrictEqual(result.items.map((item) => item.id), ['P12']);
  assert.deepStrictEqual(result.extraTests, []);
});

test('NOT_AVAILABLE lists only the unobtainable selected tests', () => {
  const custom = normalizeCatalog({
    tests: [
      { id: 'T1', code: 'A', name: 'A', price: null, status: true },
      { id: 'T2', code: 'B', name: 'B', price: 10, status: true },
    ],
    packages: [],
  });
  assert.throws(() => calculatePlan(custom, ['T1', 'T2']), (error) =>
    error instanceof PlanError && error.status === 422 &&
    assert.deepStrictEqual(error.toResponse(), {
      error: 'NOT_AVAILABLE', testIds: ['T1'],
    }) === undefined,
  );
});

test('total price is the primary optimization criterion', () => {
  const custom = normalizeCatalog({
    tests: [
      { id: 'T1', code: 'A', name: 'A', price: 60, status: true },
      { id: 'T2', code: 'B', name: 'B', price: 60, status: true },
    ],
    packages: [{ id: 'P1', name: 'Both', price: 110, testIds: ['T1', 'T2'], status: true }],
  });
  assert.deepStrictEqual(calculatePlan(custom, ['T1', 'T2']).items.map((i) => i.id), ['P1']);
});

test('tie 1: fewer items wins over separate individual tests', () => {
  const custom = normalizeCatalog({
    tests: [
      { id: 'T1', code: 'A', name: 'A', price: 60, status: true },
      { id: 'T2', code: 'B', name: 'B', price: 40, status: true },
    ],
    packages: [{ id: 'P1', name: 'Both', price: 100, testIds: ['T1', 'T2'], status: true }],
  });
  assert.deepStrictEqual(calculatePlan(custom, ['T1', 'T2']).items.map((i) => i.id), ['P1']);
});

test('tie 2: fewer extra tests wins at equal price and item count', () => {
  const custom = normalizeCatalog({
    tests: [
      { id: 'T1', code: 'A', name: 'A', price: 100, status: true },
      { id: 'T2', code: 'B', name: 'B', price: 20, status: true },
    ],
    packages: [
      { id: 'P01', name: 'Extra', price: 10, testIds: ['T1', 'T2'], status: true },
      { id: 'P02', name: 'No extra', price: 10, testIds: ['T1'], status: true },
    ],
  });
  assert.deepStrictEqual(calculatePlan(custom, ['T1']).items.map((i) => i.id), ['P02']);
});

test('tie 3: alphabetical sorted item IDs wins', () => {
  const custom = normalizeCatalog({
    tests: [{ id: 'T1', code: 'A', name: 'A', price: 100, status: true }],
    packages: [
      { id: 'P09', name: 'Later', price: 10, testIds: ['T1'], status: true },
      { id: 'P01', name: 'Earlier', price: 10, testIds: ['T1'], status: true },
    ],
  });
  assert.deepStrictEqual(calculatePlan(custom, ['T1']).items.map((i) => i.id), ['P01']);
});

test('overlapping packages count extra tests only once', () => {
  const custom = normalizeCatalog({
    tests: [
      { id: 'T1', code: 'A', name: 'A', price: 100, status: true },
      { id: 'T2', code: 'B', name: 'B', price: 100, status: true },
      { id: 'T3', code: 'C', name: 'C', price: 1, status: true },
    ],
    packages: [
      { id: 'P01', name: 'One', price: 10, testIds: ['T1', 'T3'], status: true },
      { id: 'P02', name: 'Two', price: 10, testIds: ['T2', 'T3'], status: true },
    ],
  });
  const plan = calculatePlan(custom, ['T1', 'T2']);
  assert.equal(plan.total, 20);
  assert.deepStrictEqual(plan.extraTests, ['T3']);
  assert.deepStrictEqual(plan.items.map((item) => item.id), ['P01', 'P02']);
});

test('entire catalog selection completes within 300 ms on this machine', () => {
  const allActive = catalog.tests.filter((item) => item.status).map((item) => item.id);
  const start = performance.now();
  const plan = calculatePlan(catalog, allActive);
  const elapsed = performance.now() - start;
  assert.ok(plan.total >= 0);
  assert.ok(elapsed < 300, `Planner required ${elapsed.toFixed(1)} ms`);
});
