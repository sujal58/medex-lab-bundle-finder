/** MedEx POST /api/plan contract. Prices are integer Thai baht. */
export interface PlanItem {
  type: 'package' | 'test';
  id: string;
  name: string;
  price: number;
  covers: string[];
}

export interface PlanResult {
  items: PlanItem[];
  total: number;
  extraTests: string[];
  individualTotal: number | null;
  savings: number | null;
}

type PlanErrorCode = 'EMPTY_SELECTION' | 'INVALID_TESTS' | 'NOT_AVAILABLE';
interface PlannerApiError {
  error: PlanErrorCode;
  testIds: string[];
}

/** Consistent THB display for the whole app. */
export const formatBaht = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'THB', maximumFractionDigits: 0,
  }).format(value);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

function isPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Reject unexpected API payloads rather than displaying misleading prices. */
export function isPlanResult(value: unknown): value is PlanResult {
  if (!isRecord(value) || !Array.isArray(value.items) || !isIdArray(value.extraTests)) return false;
  if (!isPrice(value.total) || !(value.individualTotal === null || isPrice(value.individualTotal))) return false;
  if (!(value.savings === null || (typeof value.savings === 'number' && Number.isFinite(value.savings)))) return false;
  return value.items.every((item: unknown) =>
    isRecord(item) &&
    (item.type === 'package' || item.type === 'test') &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    isPrice(item.price) && isIdArray(item.covers),
  );
}

function isApiError(value: unknown): value is PlannerApiError {
  return isRecord(value) &&
    (value.error === 'EMPTY_SELECTION' || value.error === 'INVALID_TESTS' || value.error === 'NOT_AVAILABLE') &&
    isIdArray(value.testIds);
}

export function describePlanError(payload: unknown, status: number): string {
  if (isApiError(payload)) {
    if (payload.error === 'EMPTY_SELECTION') return 'Select at least one test to calculate a plan.';
    const names = payload.testIds.join(', ');
    if (payload.error === 'INVALID_TESTS') {
      return names ? `Some selected tests are no longer valid: ${names}. Remove them and try again.` :
        'The selected tests could not be checked. Please try selecting them again.';
    }
    return names ? `These tests cannot currently be booked: ${names}. Please change your selection.` :
      'This combination cannot currently be booked. Please change your selection.';
  }
  return status >= 500 ? 'The planner is temporarily unavailable. Please try again.' :
    'We could not calculate that plan. Please try again.';
}

/** Call the actual HTTP API; accepts a fetch implementation for deterministic tests. */
export async function requestPlan(
  testIds: readonly string[], signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<PlanResult> {
  let response: Response;
  try {
    response = await fetcher('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testIds }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Unable to reach the planner. Check your connection and retry.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The planner returned an unreadable response. Please retry.');
  }
  if (!response.ok) throw new Error(describePlanError(payload, response.status));
  if (!isPlanResult(payload)) throw new Error('The planner returned unexpected information. Please retry.');
  return payload;
}

interface PlanCallbacks {
  onSuccess: (value: PlanResult) => void;
  onError: (message: string) => void;
}

/**
 * The latest selection wins, even if a transport ignores AbortSignal.
 * Cancel the active request on selection changes and component unmount.
 */
export function createLatestPlanRunner(
  load: (ids: readonly string[], signal: AbortSignal) => Promise<PlanResult> = requestPlan,
) {
  let revision = 0;
  let controller: AbortController | null = null;

  function cancel() {
    revision += 1;
    controller?.abort();
    controller = null;
  }

  function start(testIds: readonly string[], callbacks: PlanCallbacks) {
    cancel();
    const currentRevision = revision;
    const requestController = new AbortController();
    controller = requestController;
    void load(testIds, requestController.signal).then(
      (result) => {
        if (revision === currentRevision && !requestController.signal.aborted) {
          callbacks.onSuccess(result);
        }
      },
      (error: unknown) => {
        if (revision === currentRevision && !requestController.signal.aborted) {
          callbacks.onError(error instanceof Error ? error.message : 'Unable to calculate the plan.');
        }
      },
    );
  }

  return { start, cancel };
}
