import { Body, Controller, HttpCode, HttpException, Post } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { PlanError } from './planner.types';
import type { PlanResult } from './planner.types';

/**
 * Validate the JSON envelope separately from test-ID business validation.
 * For malformed data types we return INVALID_TESTS with an empty ID list,
 * since non-string values cannot be represented as test identifiers.
 */
function parseTestIds(body: unknown): string[] {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new PlanError('EMPTY_SELECTION', 400, []);
  }

  const { testIds } = body as { testIds?: unknown };
  if (testIds === undefined) {
    throw new PlanError('EMPTY_SELECTION', 400, []);
  }
  if (!Array.isArray(testIds) || !testIds.every((id) => typeof id === 'string')) {
    throw new PlanError('INVALID_TESTS', 400, []);
  }
  return testIds as string[];
}

@Controller('api')
export class PlannerController {
  constructor(private readonly planner: PlannerService) {}

  @Post('plan')
  @HttpCode(200) 
  plan(@Body() body: unknown): PlanResult {
    try {
      return this.planner.plan(parseTestIds(body));
    } catch (error: unknown) {
      // Preserve the assessment's exact error schema instead of Nest's default.
      if (error instanceof PlanError) {
        throw new HttpException(error.toResponse(), error.status);
      }
      throw error; // Unexpected errors should surface as server errors, not 400s.
    }
  }
}
