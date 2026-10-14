import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ActiveUser } from '#src/auth/decorators/active-user.decorator';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.Service';

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
}
