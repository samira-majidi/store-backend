import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Auth } from './decorators/auth.decorator';
import { AuthType } from './enums/auth-type.enum';

import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from './constants/auth-cookies.constant';
import { RefreshTokenProvider } from './providers/refresh-token.provider';

@ApiTags('احراز هویت (Authentication)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenProvider: RefreshTokenProvider,
  ) {}

  @Auth(AuthType.None)
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ارسال کد یکبار مصرف (OTP)',
    description:
      'یک کد تایید ۵ یا ۶ رقمی به شماره موبایل ارسال می‌کند. در صورت عدم وجود کاربر، کاربر جدید ثبت اولیه می‌شود.',
  })
  @ApiOkResponse({
    description: 'کد تایید با موفقیت ارسال شد.',
    schema: {
      example: {
        message: 'کد تایید ارسال شد.',
        expiresIn: 120, // ثانیه
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'فرمت شماره موبایل نامعتبر است.',
  })
  @ApiTooManyRequestsResponse({
    description: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۲ دقیقه صبر کنید.',
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.requestOtp(dto.phoneNumber);
  }

  @Auth(AuthType.None)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'بررسی کد تایید و ورود / ثبت‌نام',
    description:
      'کد ارسالی را اعتبارسنجی کرده و توکن‌های دسترسی (Access Token و Refresh Token) را برمی‌گرداند.',
  })
  @ApiOkResponse({
    description: 'ورود موفقیت‌آمیز بود و توکن‌ها صادر شدند.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'dGhpc2lzYXJlZnJlc2h0b2tlbg...',
        user: {
          id: '64e8b3b4f9a1b2c3d4e5f6a7',
          phoneNumber: '09123456789',
          name: 'سمیرا',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'کد تایید وارد شده اشتباه یا منقضی شده است.',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.verifyOtp(dto.phoneNumber, dto.code);

    response.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      user,
      accessToken,
    };
  }

  @Auth(AuthType.None)
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  public async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    const incomingRefreshToken = cookies?.[REFRESH_COOKIE_NAME];

    if (!incomingRefreshToken) {
      throw new UnauthorizedException('رفرش‌توکن در کوکی یافت نشد');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.refreshTokenProvider.refreshToken(incomingRefreshToken);

    response.cookie(
      REFRESH_COOKIE_NAME,
      newRefreshToken,
      REFRESH_COOKIE_OPTIONS,
    );

    return {
      accessToken,
    };
  }
}
