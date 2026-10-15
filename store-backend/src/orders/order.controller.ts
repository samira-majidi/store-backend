import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ActiveUser } from '#src/auth/decorators/active-user.decorator';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';
import { Permission } from '#src/rbac/enums/permission.enum';
import { Permissions } from '#src/rbac/decorators/permissions.decorator';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('Orders')
@Controller('orders')
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * ایجاد سفارش از روی سبد خرید کاربر
   */
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'ثبت سفارش از روی سبد خرید',
    description:
      'سبد خرید کاربر را بررسی می‌کند، موجودی کالاها را رزرو می‌کند، سفارش و آیتم‌های آن را ایجاد می‌کند و سفارش را در وضعیت انتظار پرداخت قرار می‌دهد.',
  })
  @ApiCreatedResponse({
    description: 'سفارش با موفقیت ایجاد شد و برای پرداخت آماده است.',
    schema: {
      example: {
        message: 'سفارش با موفقیت ایجاد شد و در انتظار پرداخت است.',
        orderId: 12,
        payableAmount: 1250000,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'سبد خرید خالی است، اطلاعات سفارش نامعتبر است، قیمت یا موجودی کالا تغییر کرده یا موجودی کافی نیست.',
  })
  @ApiUnauthorizedResponse({
    description: 'کاربر احراز هویت نشده است.',
  })
  @ApiInternalServerErrorResponse({
    description: 'خطای داخلی هنگام ایجاد سفارش یا رزرو موجودی.',
  })
  public async checkout(
    @ActiveUser('sub') userId: number,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return await this.orderService.checkout(userId, createOrderDto);
  }
  /**
   * لیست سفارش‌های کاربر جاری
   */
  @Get('me')
  @ApiOperation({
    summary: 'لیست سفارش‌های من',
    description: 'فقط سفارش‌های متعلق به کاربر واردشده را نمایش می‌دهد.',
  })
  @ApiOkResponse({
    description: 'لیست سفارش‌های کاربر به همراه تعداد آن‌ها.',
  })
  @ApiUnauthorizedResponse({
    description: 'کاربر احراز هویت نشده است.',
  })
  @ApiForbiddenResponse({
    description: 'دسترسی مشاهده سفارش‌های شخصی را ندارید.',
  })
  public async getMyOrders(@ActiveUser('sub') userId: number) {
    return this.orderService.getMyOrders(userId);
  }

  @Get('me/:orderId')
  @ApiOperation({
    summary: 'جزئیات سفارش من',
    description:
      'جزئیات سفارش و آیتم‌های آن را فقط برای صاحب سفارش نمایش می‌دهد.',
  })
  @ApiParam({
    name: 'orderId',
    type: String,
    format: 'uuid',
    example: '15d7d7d7-c5c0-4976-bbc8-a41f477db8c2',
    description: 'شناسه سفارش',
  })
  @ApiOkResponse({
    description: 'جزئیات سفارش کاربر.',
  })
  @ApiBadRequestResponse({
    description: 'شناسه سفارش باید عدد صحیح باشد.',
  })
  @ApiNotFoundResponse({
    description: 'سفارش پیدا نشد یا متعلق به کاربر جاری نیست.',
  })
  @ApiUnauthorizedResponse({
    description: 'کاربر احراز هویت نشده است.',
  })
  @ApiForbiddenResponse({
    description: 'دسترسی مشاهده سفارش‌های شخصی را ندارید.',
  })
  public async getMyOrderById(
    @ActiveUser('sub') userId: number,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderService.getMyOrderById(userId, orderId);
  }

  @Get('admin/all')
  @Permissions(Permission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'لیست همه سفارش‌ها',
    description:
      'همه سفارش‌ها و آیتم‌های آن‌ها را برای دارنده دسترسی مدیریت سفارش‌ها نمایش می‌دهد.',
  })
  @ApiOkResponse({
    description: 'لیست همه سفارش‌ها به همراه تعداد آن‌ها.',
  })
  @ApiUnauthorizedResponse({
    description: 'کاربر احراز هویت نشده است.',
  })
  @ApiForbiddenResponse({
    description: 'دسترسی مشاهده همه سفارش‌ها را ندارید.',
  })
  public async getAllOrders() {
    return this.orderService.getAllOrders();
  }

  /**
   * تغییر وضعیت سفارش توسط مدیریت
   */
  @Patch('admin/:orderId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تغییر وضعیت سفارش',
    description:
      'وضعیت سفارش را تغییر می‌دهد. این مسیر برای ویرایش مبلغ، آیتم‌ها، آدرس یا روش ارسال نیست.',
  })
  @ApiParam({
    name: 'orderId',
    type: String,
    format: 'uuid',
    example: '15d7d7d7-c5c0-4976-bbc8-a41f477db8c2',
    description: 'شناسه سفارش',
  })
  @ApiOkResponse({
    description: 'وضعیت سفارش با موفقیت تغییر کرد.',
  })
  @ApiBadRequestResponse({
    description: 'شناسه یا وضعیت نامعتبر است یا تغییر وضعیت مجاز نیست.',
  })
  @ApiNotFoundResponse({
    description: 'سفارش پیدا نشد.',
  })
  @ApiUnauthorizedResponse({
    description: 'کاربر احراز هویت نشده است.',
  })
  @ApiForbiddenResponse({
    description: 'دسترسی تغییر وضعیت سفارش را ندارید.',
  })
  public async updateOrderStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(orderId, dto.status);
  }
}
