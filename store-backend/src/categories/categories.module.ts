import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesController } from './categories.controller';
import { Category } from './entity/category.entity';
import { CategoriesService } from './provider/categories.service';
import { Module } from '@nestjs/common';
import { CategoriesTreeService } from './provider/CategoriesTreeCache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesTreeService],
  exports: [CategoriesService, CategoriesTreeService],
})
export class CategoriesModule {}
