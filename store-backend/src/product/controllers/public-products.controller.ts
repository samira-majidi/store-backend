// src/products/public-products.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicProductsService } from '../provider/public-product.provider';
import { ProductsSearchService } from '../provider/products-search.service';
import { FilterProductsDto } from '../dto/filter-products.dto';
import { Auth } from '#src/auth/decorators/auth.decorator';
import { AuthType } from '#src/auth/enums/auth-type.enum';

@ApiTags('Products (Public)')
@Auth(AuthType.None)
@Controller('public/products')
export class PublicProductsController {
  constructor(
    private readonly publicProductsService: PublicProductsService,
    private readonly productsSearchService: ProductsSearchService,
  ) {}

  // ==================== Special Products ====================
  @Get('special')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'دریافت محصولات پیشنهاد ویژه',
    description:
      'دریافت لیست محصولاتی که تیک پیشنهاد ویژه دارند (مناسب اسلایدر یا بخش شگفت‌انگیز صفحه اصلی). این مسیر عمومی است.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'تعداد محصولات دریافتی (پیش‌فرض: ۱۰)',
    example: 10,
  })
  @ApiOkResponse({
    description: 'لیست کارت‌های محصولات ویژه با موفقیت دریافت شد.',
  })
  public async getSpecialProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.publicProductsService.getSpecialProducts(limit);
  }

  // ==================== Search ====================
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'جستجوی زنده (Instant Search) محصولات و دسته‌بندی‌ها',
    description:
      'دریافت همزمان محصولات و دسته‌بندی‌های مرتبط با یک کلمه کلیدی برای نمایش در دراپ‌داون جستجو',
  })
  @ApiQuery({
    name: 'keyword',
    required: true,
    type: String,
    description: 'عبارت مورد نظر برای جستجو',
    example: 'فشارسنج',
  })
  @ApiOkResponse({
    description: 'نتایج جستجوی لایو شامل دسته‌بندی‌ها و محصولات بازگردانده شد.',
  })
  public async instantSearch(@Query('keyword') keyword: string) {
    return await this.productsSearchService.instantSearch(keyword || '');
  }

  // ==================== Filter Options ====================

  @Get('filter-options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'دریافت گزینه‌های فیلتر (برندها و بازه قیمت)' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'شناسه دسته‌بندی برای فیلتر گزینه‌ها (اختیاری)',
  })
  @ApiQuery({
    name: 'categorySlug',
    required: false,
    type: String,
    description: 'اسلاگ دسته‌بندی برای فیلتر گزینه‌ها (اختیاری)',
  })
  public async getFilterOptions(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
  ) {
    const parsedId = categoryId ? Number(categoryId) : undefined;
    return await this.productsSearchService.getFilterOptions(
      Number.isNaN(parsedId) ? undefined : parsedId,
      categorySlug,
    );
  }

  // ==================== Filter Products ====================
  @Get('filter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'فیلتر پیشرفته محصولات' })
  public async filterProducts(@Query() filterDto: FilterProductsDto) {
    return await this.productsSearchService.filterProducts(filterDto);
  }

  // ==================== Get By Category Slug ====================
  // ==================== Get By Category Slug ====================
  @Get('category/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'دریافت و فیلتر محصولات یک دسته‌بندی',
    description:
      'دریافت لیست محصولات یک دسته همراه با اعمال تمام فیلترها (برند، قیمت، کلمه کلیدی، مرتب‌سازی و صفحه‌بندی)',
  })
  @ApiParam({
    name: 'slug',
    type: 'string',
    description: 'اسلاگ دسته‌بندی مورد نظر',
    example: 'digital-arm-blood-pressure',
  })
  public async getProductsByCategory(
    @Param('slug') slug: string,
    @Query() filterDto: FilterProductsDto,
  ) {
    // اسلاگ موجود در URL را داخل DTO تزریق می‌کنیم تا فیلتر روی همین دسته اعمال شود
    filterDto.categorySlug = slug;
    return await this.productsSearchService.filterProducts(filterDto);
  }

  // ==================== Get Product By ID ====================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'دریافت جزئیات یک محصول با شناسه' })
  @ApiParam({ name: 'id', description: 'شناسه محصول' })
  @ApiOkResponse({ description: 'اطلاعات کامل محصول بازگردانده شد.' })
  @ApiNotFoundResponse({ description: 'محصولی با این شناسه یافت نشد.' })
  public async getProductById(@Param('id') id: string) {
    return await this.publicProductsService.getProductById(id);
  }
}
