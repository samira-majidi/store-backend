import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers & Services

import { ProductsService } from './provider/products.service';

// Entities
import { Product } from './entity/product.entity';
import { ProductVariant } from './entity/product-variant.entity';
import { Category } from '../categories/entity/category.entity';
import { Upload } from '#src/common/upload/entity/upload.entity';
import { ProductsController } from './controllers/products.controller';
import { UploadModule } from '#src/common/upload/upload.module';
import { ProductVariantsService } from './provider/product-variants.service';
import { PublicProductsService } from './provider/public-product.provider';
import { PublicProductsController } from './controllers/public-products.controller';
import { CategoriesModule } from '#src/categories/categories.module';
import { ProductsSearchService } from './provider/products-search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, Category, Upload]),
    UploadModule,
    CategoriesModule,
  ],
  controllers: [ProductsController, PublicProductsController],
  providers: [
    ProductsService,
    ProductVariantsService,
    PublicProductsService,
    ProductsSearchService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
