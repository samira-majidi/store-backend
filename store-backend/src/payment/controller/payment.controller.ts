// src/payments/controllers/payment.controller.ts

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ActiveUser } from '#src/auth/decorators/active-user.decorator';

import { PaymentService } from '../payment.service';
import { RequestPaymentDto } from '../dto/request-payment.dto';
import { PaymentCallbackDto } from '../dto/payment-callback.dto';

import type {
  RequestPaymentResult,
  VerifyPaymentResult,
} from '../types/payment.type';
import { Auth } from '#src/auth/decorators/auth.decorator';
import { AuthType } from '#src/auth/enums/auth-type.enum';

const paymentValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * درخواست پرداخت سفارش کاربر
   */
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'درخواست پرداخت سفارش',
    description:
      'برای سفارش متعلق به کاربر احراز هویت‌شده، لینک پرداخت دریافت می‌کند. مبلغ از اطلاعات سفارش خوانده می‌شود. در صورت وجود پرداخت در انتظار، سرویس فعلی همان لینک را برمی‌گرداند.',
  })
  @ApiOkResponse({
    description: 'شناسه تراکنش و لینک ورود به درگاه پرداخت.',
    schema: {
      type: 'object',
      required: ['paymentUrl', 'authority'],
      properties: {
        paymentUrl: {
          type: 'string',
          format: 'uri',
          description: 'آدرس ورود به درگاه پرداخت',
        },
        authority: {
          type: 'string',
          description: 'شناسه تراکنش درگاه',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'شناسه سفارش یا مبلغ پرداخت معتبر نیست.',
  })
  @ApiUnauthorizedResponse({
    description: 'کاربر احراز هویت نشده یا شناسه کاربر معتبر نیست.',
  })
  @ApiNotFoundResponse({
    description: 'سفارش یافت نشد یا متعلق به کاربر احراز هویت‌شده نیست.',
  })
  public async requestPayment(
    @ActiveUser('sub') userId: number,
    @Body(paymentValidationPipe) dto: RequestPaymentDto,
  ): Promise<RequestPaymentResult> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException(
        'اطلاعات کاربر احراز هویت‌شده معتبر نیست.',
      );
    }

    return await this.paymentService.requestPayment(userId, dto.orderId);
  }

  /**
   * دریافت callback درگاه و بررسی نتیجه پرداخت
   */

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @Auth(AuthType.None)
  // دکوراتور عمومی پروژه را اینجا اضافه کن.
  // این مسیر باید بدون JWT قابل دسترسی باشد.
  @ApiOperation({
    summary: 'بررسی نتیجه پرداخت پس از بازگشت از درگاه',
    description:
      'شناسه تراکنش و وضعیت بازگشتی درگاه را به سرویس پرداخت ارسال می‌کند. وضعیت OK در query به‌تنهایی تأیید پرداخت نیست؛ نتیجه مالی توسط سرویس تعیین می‌شود. پاسخ این مسیر JSON است.',
  })
  @ApiQuery({
    name: 'Authority',
    type: String,
    required: true,
    description: 'شناسه تراکنش صادرشده توسط درگاه',
  })
  @ApiQuery({
    name: 'Status',
    enum: ['OK', 'NOK'],
    required: true,
    description: 'وضعیت بازگشتی درگاه',
  })
  @ApiOkResponse({
    description:
      'نتیجه بررسی یا نتیجه قبلاً ثبت‌شده پرداخت. دریافت HTTP 200 الزاماً به معنی موفقیت مالی نیست.',
  })
  @ApiBadRequestResponse({
    description: 'شناسه تراکنش یا وضعیت callback معتبر نیست.',
  })
  @ApiNotFoundResponse({
    description: 'تراکنش موردنظر یافت نشد.',
  })
  public async callback(
    @Query(paymentValidationPipe) query: PaymentCallbackDto,
  ): Promise<VerifyPaymentResult> {
    return await this.paymentService.verifyPayment(
      query.Authority,
      query.Status,
    );
  }
}
