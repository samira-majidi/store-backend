import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

import { Permission } from '#src/rbac/enums/permission.enum';
import { Permissions } from '#src/rbac/decorators/permissions.decorator';
import { ActiveUser } from '#src/auth/decorators/active-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entity/product.entity';
import { ProductsService } from './provider/products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Permissions(Permission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'ایجاد محصول جدید با تنوع‌ها (Variants)',
    description:
      'این اندپوینت یک محصول جدید همراه با تصویر اصلی، گالری تصاویر، و تنوع‌های مختلف (رنگ، سایز، موجودی و ...) ایجاد می‌کند. (نیاز به دسترسی ادمین)',
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
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Permissions(Permission.PRODUCT_DELETE)
  @ApiOperation({
    summary: 'حذف محصول',
    description:
      'حذف کامل یک محصول به همراه تنوع‌های (Variants) آن. تصاویر متصل به محصول در دیتابیس آزاد شده و در نهایت توسط کران‌جاب از فضای ابری حذف می‌شوند. (نیاز به دسترسی ادمین)',
  })
  @ApiOkResponse({
    description: 'محصول با موفقیت حذف شد.',
  })
  @ApiNotFoundResponse({
    description: 'محصولی با این شناسه یافت نشد.',
  })
  @ApiInternalServerErrorResponse({
    description: 'خطای داخلی سرور هنگام حذف محصول.',
  })
  public async deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return await this.productsService.remove(id);
  }
}
