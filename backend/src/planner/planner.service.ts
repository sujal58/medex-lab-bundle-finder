import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { calculatePlan } from './plan';
import type { PlanResult } from './planner.types';

/** Thin adapter: keep optimization logic pure and easy to unit-test. */
@Injectable()
export class PlannerService {
  constructor(private readonly catalog: CatalogService) {}

  plan(testIds: string[]): PlanResult {
    return calculatePlan(this.catalog.getCatalog(), testIds);
  }
}
