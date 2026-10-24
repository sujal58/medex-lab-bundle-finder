import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { LabPackage, LabTest } from './catalog.types';

@Controller('api')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('tests')
  getTests(): LabTest[] {
    return this.catalog.getTests();
  }

  @Get('packages')
  getPackages(): LabPackage[] {
    return this.catalog.getPackages();
  }
}
