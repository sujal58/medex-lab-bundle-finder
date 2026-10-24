import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getAvailablePackages,
  getSelectableTests,
  normalizeCatalog,
} from './catalog.loader';
import type { LabCatalog, LabPackage, LabTest } from './catalog.types';

@Injectable()
export class CatalogService {
  private readonly catalog: LabCatalog;

  constructor() {
    // Works from backend/src/catalog (development) and backend/dist/catalog (build).
    const filePath = resolve(__dirname, '../../../data/lab-catalog.json');
    this.catalog = normalizeCatalog(JSON.parse(readFileSync(filePath, 'utf8')));
  }

  getTests(): LabTest[] {
    return getSelectableTests(this.catalog);
  }

  getPackages(): LabPackage[] {
    return getAvailablePackages(this.catalog);
  }

  // Available to the planner service we implement in the next milestone.
  getCatalog(): LabCatalog {
    return this.catalog;
  }
}
