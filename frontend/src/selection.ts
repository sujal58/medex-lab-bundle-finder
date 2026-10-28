export interface LabTest {
  id: string;
  code: string;
  name: string;
  price: number | null;
  status: boolean;
}

/**
 * Search by a test's human-readable name or catalog code.
 * Whitespace and letter casing do not affect results.
 */
export function filterTests(tests: readonly LabTest[], search: string): LabTest[] {
  const term = search.trim().toLowerCase();
  if (!term) return tests.filter((test) => test.status);

  return tests.filter(
    (test) =>
      test.status &&
      (test.name.toLowerCase().includes(term) || test.code.toLowerCase().includes(term)),
  );
}

/** Add/remove IDs without duplicates, retaining the user's selection order. */
export function toggleTestSelection(selected: readonly string[], testId: string): string[] {
  return selected.includes(testId)
    ? selected.filter((id) => id !== testId)
    : [...selected, testId];
}

export function isLabTest(value: unknown): value is LabTest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const test = value as Partial<LabTest>;
  return (
    typeof test.id === 'string' &&
    typeof test.code === 'string' &&
    typeof test.name === 'string' &&
    (test.price === null || (typeof test.price === 'number' && Number.isFinite(test.price))) &&
    typeof test.status === 'boolean'
  );
}
