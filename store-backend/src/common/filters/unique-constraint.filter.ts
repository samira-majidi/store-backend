import { Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { Response } from 'express';

interface PostgresDriverError {
  code?: string;
  constraint?: string;
  detail?: string;
}

@Catch(QueryFailedError)
export class UniqueConstraintFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errorWithDriver = exception as unknown as {
      driverError?: PostgresDriverError;
    };
    const driverError = errorWithDriver.driverError;
    const errorCode = driverError?.code;
    const constraintName = driverError?.constraint;

    if (errorCode === '23505') {
      let message = 'داده وارد شده تکراری است.';

      if (constraintName === 'UQ_one_default_variant_per_product') {
        message = 'یک محصول نمی‌تواند بیش از یک تنوع پیش‌فرض داشته باشد.';
      } else if (constraintName?.includes('sku')) {
        message = 'کد SKU وارد شده تکراری است و قبلاً استفاده شده.';
      } else if (constraintName?.includes('slug')) {
        message = 'این اسلاگ (slug) قبلاً ثبت شده است.';
      }

      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message,
        error: 'Conflict',
      });
    }

    super.catch(exception, host);
  }
}
