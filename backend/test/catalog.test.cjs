const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const {
  getAvailablePackages,
  getSelectableTests,
  normalizeCatalog,
} = require('../dist/catalog/catalog.loader.js');

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../data/lab-catalog.json'), 'utf8'));
const catalog = normalizeCatalog(raw);

test('shows only active tests, including package-only tests', () => {
  const tests = getSelectableTests(catalog);
  assert.equal(tests.length, 19);
  assert.ok(tests.some((item) => item.id === 'T15' && item.price === null));
  assert.ok(!tests.some((item) => item.id === 'T19'));
});

test('shows only active, non-empty packages', () => {
  const packages = getAvailablePackages(catalog);
  assert.equal(packages.length, 12);
  assert.ok(!packages.some((item) => item.id === 'P10'));
});

test('removes duplicate test references without changing their order', () => {
  const pkg = catalog.packages.find((item) => item.id === 'P06');
  assert.deepEqual(pkg.testIds, ['T01', 'T02', 'T04', 'T05', 'T06', 'T11', 'T12']);
});

test('drops unknown test references instead of failing the whole catalog', () => {
  const pkg = catalog.packages.find((item) => item.id === 'P12');
  assert.deepEqual(pkg.testIds, ['T13', 'T17']);
});

test('keeps the original JSON dataset unchanged', () => {
  assert.equal(raw.packages.find((item) => item.id === 'P06').testIds.length, 8);
  assert.ok(raw.packages.find((item) => item.id === 'P12').testIds.includes('T99'));
});

test('excludes inactive test references in packages', () => {
  const custom = normalizeCatalog({
    tests: [
      { id: 'T1', code: 'A', name: 'Active', price: 100, status: true },
      { id: 'T2', code: 'B', name: 'Inactive', price: 100, status: false },
    ],
    packages: [
      { id: 'P1', name: 'Mixed', price: 100, status: true, testIds: ['T1', 'T2'] },
    ],
  });
  assert.deepEqual(custom.packages[0].testIds, ['T1']);
});

test('rejects invalid top-level catalog data', () => {
  assert.throws(() => normalizeCatalog({ tests: [] }), /expected tests\[\] and packages\[\]/);
});

test('rejects duplicate test IDs', () => {
  const row = { id: 'T1', code: 'A', name: 'Test A', price: 100, status: true };
  assert.throws(() => normalizeCatalog({ tests: [row, row], packages: [] }), /duplicate test IDs/);
});

test('rejects malformed prices', () => {
  assert.throws(() => normalizeCatalog({
    tests: [{ id: 'T1', code: 'A', name: 'Test A', price: 12.5, status: true }],
    packages: [],
  }), /Invalid lab test/);
});
