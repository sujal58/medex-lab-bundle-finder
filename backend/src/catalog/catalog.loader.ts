import type { LabCatalog, LabPackage, LabTest } from './catalog.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Validate the catalog's basic structure and handle known bad references. */
export function normalizeCatalog(source: unknown): LabCatalog {
  if (!isObject(source) || !Array.isArray(source.tests) || !Array.isArray(source.packages)) {
    throw new Error('Invalid lab catalog: expected tests[] and packages[]');
  }

  const tests: LabTest[] = source.tests.map((raw: unknown, index: number) => {
    if (
      !isObject(raw) || !isName(raw.id) || !isName(raw.code) ||
      !isName(raw.name) || !(raw.price === null || isPrice(raw.price)) ||
      typeof raw.status !== 'boolean'
    ) {
      throw new Error(`Invalid lab test at index ${index}`);
    }
    return {
      id: raw.id,
      code: raw.code,
      name: raw.name,
      price: raw.price,
      status: raw.status,
    };
  });

  const testsById = new Map(tests.map((test) => [test.id, test]));
  if (testsById.size !== tests.length) {
    throw new Error('Invalid lab catalog: duplicate test IDs');
  }

  const packages: LabPackage[] = source.packages.map((raw: unknown, index: number) => {
    if (
      !isObject(raw) || !isName(raw.id) || !isName(raw.name) ||
      !isPrice(raw.price) || typeof raw.status !== 'boolean' ||
      !Array.isArray(raw.testIds)
    ) {
      throw new Error(`Invalid lab package at index ${index}`);
    }

    // Ignore repeated and unknown test IDs (the supplied catalog contains both).
    // Inactive tests are excluded too: customers cannot select them.
    const seen = new Set<string>();
    const testIds = raw.testIds.filter((id: unknown): id is string => {
      if (typeof id !== 'string' || seen.has(id)) return false;
      const test = testsById.get(id);
      if (!test?.status) return false;
      seen.add(id);
      return true;
    });

    return { id: raw.id, name: raw.name, price: raw.price, testIds, status: raw.status };
  });

  if (new Set(packages.map((item) => item.id)).size !== packages.length) {
    throw new Error('Invalid lab catalog: duplicate package IDs');
  }

  return { tests, packages };
}

export function getSelectableTests(catalog: LabCatalog): LabTest[] {
  return catalog.tests.filter((test) => test.status);
}

export function getAvailablePackages(catalog: LabCatalog): LabPackage[] {
  return catalog.packages.filter((item) => item.status && item.testIds.length > 0);
}
