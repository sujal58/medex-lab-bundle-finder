import { getAvailablePackages } from '../catalog/catalog.loader';
import type { LabCatalog, LabPackage, LabTest } from '../catalog/catalog.types';
import { PlanError } from './planner.types';
import type { PlanItem, PlanResult } from './planner.types';

interface Candidate extends PlanResult {
  /** Sorted item IDs, used only for deterministic tie-breaking. */
  sortedItemIds: string[];
}

function compareIds(left: readonly string[], right: readonly string[]): number {
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return left.length - right.length;
}

/** MedEx's tie-breaking rules, evaluated in the required order. */
function isBetter(candidate: Candidate, best: Candidate | null): boolean {
  if (!best) return true;
  if (candidate.total !== best.total) return candidate.total < best.total;
  if (candidate.items.length !== best.items.length) {
    return candidate.items.length < best.items.length;
  }
  if (candidate.extraTests.length !== best.extraTests.length) {
    return candidate.extraTests.length < best.extraTests.length;
  }
  return compareIds(candidate.sortedItemIds, best.sortedItemIds) < 0;
}

/**
 * Find the globally cheapest valid purchase plan for a normalized catalog.
 *
 * Enumerate each subset of *relevant active* packages. Every subset uniquely
 * determines which selected tests still need to be bought individually.
 * (Buying an additional covered individual test cannot improve cost or ties.)
 *
 * Time: O(2^P * (P + T)), where P = relevant packages and T = selected tests.
 * Space: O(P + T) per candidate. This intentionally targets the 13-package
 * assessment dataset; 40 packages would require a scalable alternative.
 *
 * The caller must supply a catalog normalized with normalizeCatalog().
 */
export function calculatePlan(catalog: LabCatalog, requestedTestIds: string[]): PlanResult {
  if (!Array.isArray(requestedTestIds) || requestedTestIds.length === 0) {
    throw new PlanError('EMPTY_SELECTION', 400, []);
  }

  // Repeated IDs count only once; Set preserves the user's original order.
  const selected = [...new Set(requestedTestIds)];
  const testsById = new Map(catalog.tests.map((test) => [test.id, test]));
  const invalid = selected.filter((id) => !testsById.get(id)?.status);
  if (invalid.length > 0) throw new PlanError('INVALID_TESTS', 400, invalid);

  const selectedSet = new Set(selected);
  const packages = getAvailablePackages(catalog).filter((pack) =>
    pack.testIds.some((id) => selectedSet.has(id)),
  );

  // A test with no individual price must be covered by at least one package.
  const unavailable = selected.filter((id) => {
    const test = testsById.get(id)!;
    return test.price === null && !packages.some((pack) => pack.testIds.includes(id));
  });
  if (unavailable.length > 0) throw new PlanError('NOT_AVAILABLE', 422, unavailable);

  // Bitwise masks use signed 32-bit integers, so only use positions 0..29.
  // The provided catalog has 19 selectable tests and 12 active packages.
  if (selected.length > 30 || packages.length > 20) {
    throw new Error('Exact enumeration exceeds its documented size limit.');
  }

  const positions = new Map(selected.map((id, i) => [id, i]));
  const masks = packages.map((pack) =>
    pack.testIds.reduce((mask, id) => {
      const pos = positions.get(id);
      return pos === undefined ? mask : mask | (1 << pos);
    }, 0),
  );

  const canBuyIndividually = selected.every((id) => testsById.get(id)!.price !== null);
  const individualTotal = canBuyIndividually
    ? selected.reduce((sum, id) => sum + testsById.get(id)!.price!, 0)
    : null;

  let best: Candidate | null = null;
  const numberOfSubsets = 2 ** packages.length;

  for (let subset = 0; subset < numberOfSubsets; subset += 1) {
    let total = 0;
    let coveredMask = 0;
    const chosen: LabPackage[] = [];
    const extras = new Set<string>();

    for (let index = 0; index < packages.length; index += 1) {
      if ((subset & (1 << index)) === 0) continue;
      const pack = packages[index];
      chosen.push(pack);
      total += pack.price;
      coveredMask |= masks[index];
      for (const id of pack.testIds) {
        if (!selectedSet.has(id)) extras.add(id);
      }
    }

    // All prices are nonnegative; an already-expensive subset cannot win.
    if (best && total > best.total) continue;

    const individuals: LabTest[] = [];
    let possible = true;
    for (let index = 0; index < selected.length; index += 1) {
      if ((coveredMask & (1 << index)) !== 0) continue;
      const test = testsById.get(selected[index])!;
      if (test.price === null) {
        possible = false;
        break;
      }
      individuals.push(test);
      total += test.price;
    }
    if (!possible || (best && total > best.total)) continue;

    const items: PlanItem[] = [
      ...chosen.map((pack) => ({
        type: 'package' as const,
        id: pack.id,
        name: pack.name,
        price: pack.price,
        covers: selected.filter((id) => pack.testIds.includes(id)),
      })),
      ...individuals.map((test) => ({
        type: 'test' as const,
        id: test.id,
        name: test.name,
        price: test.price!,
        covers: [test.id],
      })),
    ].sort((a, b) => compareIds([a.id], [b.id]));

    const candidate: Candidate = {
      items,
      total,
      extraTests: [...extras].sort(),
      individualTotal,
      savings: individualTotal === null ? null : individualTotal - total,
      sortedItemIds: items.map((item) => item.id),
    };

    if (isBetter(candidate, best)) best = candidate;
  }

  if (!best) throw new PlanError('NOT_AVAILABLE', 422, selected);
  const { sortedItemIds: _unused, ...result } = best;
  return result;
}
