import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatalogModule } from './catalog/catalog.module';
import { PlannerModule } from './planner/planner.module';

@Module({
  imports: [CatalogModule, PlannerModule],
  controllers: [AppController],
})
export class AppModule {}
