import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTests, isLabTest, toggleTestSelection } from '../src/selection.ts';

const tests = [
  { id: 'T01', code: 'CBC', name: 'Complete Blood Count', price: 250, status: true },
  { id: 'T02', code: 'FBS', name: 'Fasting Blood Sugar', price: 120, status: true },
  { id: 'T15', code: 'HIV', name: 'HIV Screening', price: null, status: true },
  { id: 'T19', code: 'OLD', name: 'Old Test', price: 150, status: false },
];

test('returns active tests for empty search', () => {
  assert.deepEqual(filterTests(tests, ''), tests.slice(0, 3));
});
test('search matches test name without case sensitivity', () => {
  assert.deepEqual(filterTests(tests, '  bLoOd '), [tests[0], tests[1]]);
});
test('search matches test codes', () => {
  assert.deepEqual(filterTests(tests, 'fbs'), [tests[1]]);
});
test('inactive tests are not returned, even on matching search', () => {
  assert.deepEqual(filterTests(tests, 'old'), []);
});
test('search with no matches returns an empty array', () => {
  assert.deepEqual(filterTests(tests, 'unavailable'), []);
});
test('selection adds an ID once and preserves order', () => {
  const afterOne = toggleTestSelection([], 'T02');
  const afterTwo = toggleTestSelection(afterOne, 'T01');
  assert.deepEqual(afterTwo, ['T02', 'T01']);
  assert.deepEqual(afterOne, ['T02']);
});
test('selection toggling removes only the selected ID', () => {
  assert.deepEqual(toggleTestSelection(['T02', 'T01', 'T03'], 'T01'), ['T02', 'T03']);
});
test('package-only tests with null prices are considered valid', () => {
  assert.equal(isLabTest(tests[2]), true);
});
test('rejects malformed catalog records', () => {
  assert.equal(isLabTest({ id: 'T01', code: 'CBC', name: 'Blood', price: '250', status: true }), false);
  assert.equal(isLabTest(null), false);
});
