import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers & Services

import { ProductsService } from './provider/products.service';

// Entities
import { Product } from './entity/product.entity';
import { ProductVariant } from './entity/product-variant.entity';
import { Category } from '../categories/entity/category.entity';
import { Upload } from '#src/common/upload/entity/upload.entity';
import { ProductsController } from './products.controller';
import { UploadModule } from '#src/common/upload/upload.module';
import { ProductVariantsService } from './provider/product-variants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, Category, Upload]),
    UploadModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductVariantsService],
  exports: [ProductsService],
})
export class ProductsModule {}
