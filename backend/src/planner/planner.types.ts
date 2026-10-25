/** Response contract specified in the MedEx Lab Test Bundle Finder brief. */
export interface PlanItem {
  type: 'package' | 'test';
  id: string;
  name: string;
  price: number;
  /** Selected test IDs included in this item, in the caller's selection order. */
  covers: string[];
}

export interface PlanResult {
  items: PlanItem[];
  total: number;
  extraTests: string[];
  individualTotal: number | null;
  savings: number | null;
}

export type PlanErrorCode = 'EMPTY_SELECTION' | 'INVALID_TESTS' | 'NOT_AVAILABLE';

export class PlanError extends Error {
  constructor(
    public readonly code: PlanErrorCode,
    public readonly status: 400 | 422,
    public readonly testIds: string[],
  ) {
    super(code);
    this.name = 'PlanError';
  }

  toResponse(): { error: PlanErrorCode; testIds: string[] } {
    return { error: this.code, testIds: this.testIds };
  }
}
