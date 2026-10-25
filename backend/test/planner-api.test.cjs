const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');

const dataset = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/lab-catalog.json'), 'utf8'),
);

let app;
let baseUrl;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (app) await app.close();
});

async function quote(body) {
  const response = await fetch(`${baseUrl}/api/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

for (const [index, example] of dataset.examples.entries()) {
  test(`POST /api/plan: official example ${index + 1} matches exactly`, async () => {
    const response = await quote(example.request);
    assert.equal(response.status, 200);
    assert.deepStrictEqual(response.body, example.expected);
  });
}

test('POST /api/plan: empty selection returns required error body', async () => {
  assert.deepStrictEqual(await quote({ testIds: [] }), {
    status: 400,
    body: { error: 'EMPTY_SELECTION', testIds: [] },
  });
});

test('POST /api/plan: missing testIds returns EMPTY_SELECTION', async () => {
  assert.deepStrictEqual(await quote({}), {
    status: 400,
    body: { error: 'EMPTY_SELECTION', testIds: [] },
  });
});

test('POST /api/plan: unknown and inactive IDs return INVALID_TESTS in input order', async () => {
  assert.deepStrictEqual(await quote({ testIds: ['T19', 'UNKNOWN', 'T19'] }), {
    status: 400,
    body: { error: 'INVALID_TESTS', testIds: ['T19', 'UNKNOWN'] },
  });
});

test('POST /api/plan: malformed testIds type returns a stable 400', async () => {
  for (const body of [{ testIds: 'T01' }, { testIds: [42] }, { testIds: null }]) {
    assert.deepStrictEqual(await quote(body), {
      status: 400,
      body: { error: 'INVALID_TESTS', testIds: [] },
    });
  }
});

test('POST /api/plan: repeated IDs count once', async () => {
  const response = await quote({ testIds: ['T02', 'T03', 'T02'] });
  const uniqueResponse = await quote({ testIds: ['T02', 'T03'] });
  assert.equal(response.status, 200);
  assert.deepStrictEqual(response.body, uniqueResponse.body);
});

test('GET /api/tests returns selectable tests only', async () => {
  const response = await fetch(`${baseUrl}/api/tests`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.length, 19);
  assert.ok(body.every((t) => t.status === true));
  assert.ok(body.some((t) => t.id === 'T15' && t.price === null));
  assert.ok(!body.some((t) => t.id === 'T19'));
});

test('GET /api/packages returns cleaned, active packages only', async () => {
  const response = await fetch(`${baseUrl}/api/packages`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.length, 12);
  assert.ok(!body.some((p) => p.id === 'P10'));
  const p06 = body.find((p) => p.id === 'P06');
  assert.equal(p06.testIds.length, new Set(p06.testIds).size);
  assert.ok(!body.find((p) => p.id === 'P12').testIds.includes('T99'));
});
