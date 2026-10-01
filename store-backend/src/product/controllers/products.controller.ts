// src/products/products.controller.ts
import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { Permission } from '#src/rbac/enums/permission.enum';
import { Permissions } from '#src/rbac/decorators/permissions.decorator';
import { ActiveUser } from '#src/auth/decorators/active-user.decorator';
import { UniqueConstraintFilter } from '#src/common/filters/unique-constraint.filter';

import {
  CreateProductDto,
  CreateProductVariantDto,
} from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entity/product.entity';
import { ProductVariant } from '../entity/product-variant.entity';
import { ProductsService } from '../provider/products.service';
import { SetDiscountDto } from '../dto/set-discount.dto';
import { ProductVariantsService } from '../provider/product-variants.service';

@ApiTags('Products (Admin)')
@Controller('products')
@UseFilters(UniqueConstraintFilter)
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  /**
   * ایجاد محصول جدید
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'ایجاد محصول جدید با تنوع‌ها (Variants)',
    description:
      'این اندپوینت یک محصول جدید همراه با تصویر اصلی، گالری تصاویر، و تنوع‌های مختلف (رنگ، سایز، موجودی و ...) ایجاد می‌کند. (مخصوص ادمین)',
  })
  @ApiCreatedResponse({
    description: 'محصول با موفقیت ایجاد و در دیتابیس ذخیره شد.',
    type: Product,
  })
  @ApiBadRequestResponse({
    description:
      'داده‌های ارسالی نامعتبر است (خطای ولیدیشن DTO) یا کدهای SKU در تنوع‌های ارسالی تکراری هستند.',
  })
  @ApiConflictResponse({
    description: 'خطای تداخل داده: محصولی با این اسلاگ قبلاً ثبت شده است.',
  })
  @ApiInternalServerErrorResponse({
    description: 'خطای داخلی سرور هنگام ذخیره‌سازی محصول یا ارتباط با دیتابیس.',
  })
  public async createProduct(
    @ActiveUser('sub') userId: number,
    @Body() createProductDto: CreateProductDto,
  ): Promise<Product> {
    return await this.productsService.create(createProductDto, userId);
  }

  /**
   * ویرایش محصول و همگام‌سازی تنوع‌ها و گالری
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.PRODUCT_UPDATE)
  @ApiOperation({
    summary: 'ویرایش محصول، تصاویر و تنوع‌ها',
    description:
      'ویرایش مشخصات اصلی محصول، به‌روزرسانی تصاویر گالری و همگام‌سازی کامل واریانت‌ها (افزودن، ویرایش و حذف واریانت‌های غایب). (مخصوص ادمین)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای محصول (UUID)',
  })
  @ApiOkResponse({
    description: 'محصول با موفقیت ویرایش شد.',
    type: Product,
  })
  @ApiNotFoundResponse({
    description: 'محصول یا دسته‌بندی با شناسه مشخص‌شده پیدا نشد.',
  })
  @ApiBadRequestResponse({
    description:
      'داده‌های ارسالی نامعتبر است یا تنوع پیش‌فرض نامعتبر تعیین شده است.',
  })
  public async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveUser('sub') userId: number,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return await this.productsService.update(id, updateProductDto, userId);
  }
  /**
   * تنظیم یا ویرایش تخفیف شگفت‌انگیز برای یک واریانت
   */
  @Patch(':id/variants/:variantId/discount')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.PRODUCT_UPDATE)
  @ApiOperation({
    summary: 'تنظیم تخفیف شگفت‌انگیز برای یک تنوع (Flash Sale)',
    description:
      'درصد تخفیف و زمان پایان تخفیف را برای یک تنوع خاص تنظیم می‌کند. قیمت نهایی و مبلغ تخفیف به صورت خودکار توسط سیستم محاسبه و همگام‌سازی می‌شود. (مخصوص ادمین)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای محصول (UUID)',
  })
  @ApiParam({
    name: 'variantId',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای تنوع (UUID)',
  })
  @ApiOkResponse({
    description: 'تخفیف با موفقیت روی تنوع اعمال شد و قیمت‌ها بروزرسانی شدند.',
    type: ProductVariant,
  })
  @ApiNotFoundResponse({
    description: 'محصول یا تنوع مورد نظر پیدا نشد.',
  })
  public async setVariantDiscount(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() setDiscountDto: SetDiscountDto, // یادت نره این DTO رو ایمپورت کنی
  ): Promise<ProductVariant> {
    return await this.productVariantsService.setVariantDiscount(
      productId,
      variantId,
      setDiscountDto,
    );
  }

  /**
   * افزودن تکی یک واریانت به محصول
   */
  @Post(':id/variants')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.PRODUCT_UPDATE)
  @ApiOperation({
    summary: 'افزودن یک واریانت جدید به محصول',
    description:
      'یک تنوع جدید (رنگ، سایز، قیمت و موجودی) به محصول موجود اضافه می‌کند. در صورت انتخاب به عنوان پیش‌فرض، پیش‌فرض قبلی خنثی می‌شود. (مخصوص ادمین)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای محصول (UUID)',
  })
  @ApiCreatedResponse({
    description: 'واریانت جدید با موفقیت اضافه شد.',
    type: ProductVariant,
  })
  @ApiNotFoundResponse({
    description: 'محصولی با این شناسه یافت نشد.',
  })
  @ApiBadRequestResponse({
    description: 'فیلدهای sku، price یا stock نامعتبر و خالی هستند.',
  })
  public async addVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
  ): Promise<ProductVariant> {
    return await this.productsService.addVariant(productId, dto);
  }

  /**
   * حذف یک واریانت تکی از محصول
   */
  @Delete(':id/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.PRODUCT_UPDATE)
  @ApiOperation({
    summary: 'حذف یک واریانت از محصول',
    description:
      'یک تنوع محصول را حذف می‌کند. اگر واریانت پیش‌فرض حذف شود، اولین واریانت باقی‌مانده خودکار به عنوان پیش‌فرض ست می‌شود. محصول نمی‌تواند بدون واریانت بماند. (مخصوص ادمین)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای محصول (UUID)',
  })
  @ApiParam({
    name: 'variantId',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای تنوع (UUID)',
  })
  @ApiOkResponse({
    description: 'تنوع با موفقیت حذف شد.',
  })
  @ApiNotFoundResponse({
    description: 'تنوع مورد نظر پیدا نشد.',
  })
  @ApiBadRequestResponse({
    description: 'امکان حذف آخرین تنوع محصول وجود ندارد.',
  })
  public async removeVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ): Promise<{ message: string }> {
    return await this.productsService.removeVariant(productId, variantId);
  }

  /**
   * حذف کامل محصول
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.PRODUCT_DELETE)
  @ApiOperation({
    summary: 'حذف کامل محصول',
    description:
      'حذف کامل محصول به همراه تمام تنوع‌ها. تصاویر دیتابیس آزاد شده و در صف پاک‌سازی باکت ابری قرار می‌گیرند. (مخصوص ادمین)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'شناسه یکتای محصول (UUID)',
  })
  @ApiOkResponse({
    description: 'محصول با موفقیت حذف شد.',
  })
  @ApiNotFoundResponse({
    description: 'محصولی با این شناسه یافت نشد.',
  })
  @ApiInternalServerErrorResponse({
    description: 'خطای سرور هنگام حذف محصول.',
  })
  public async deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return await this.productsService.remove(id);
  }
}
