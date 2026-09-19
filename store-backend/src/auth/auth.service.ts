import { Injectable } from '@nestjs/common';
import { UserService } from '#src/users/providers/user-service';

import { UserRole } from '#src/users/dtos/user-role.enum';
import { GenerateTokenProviders } from './providers/generate-token.providers';
import { OtpService } from './providers/otpService';
import { SmsService } from './providers/sms.service';
import { RefreshTokenProvider } from './providers/refresh-token.provider';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly generateTokenProviders: GenerateTokenProviders,
    private readonly refreshTokenProvider: RefreshTokenProvider,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * مرحله اول: درخواست ارسال کد OTP
   */
  public async requestOtp(phoneNumber: string) {
    const otpCode = await this.otpService.createAndSaveOtp(phoneNumber);

    await this.smsService.sendOtp(phoneNumber, otpCode);

    return { message: 'کد تأیید ارسال شد.' };
  }

  /**
   * متد یکپارچه ورود و ثبت‌نام برای همه (کاربر و ادمین)
   */
  public async verifyOtp(phoneNumber: string, otpCode: string) {
    await this.otpService.validateOtp(phoneNumber, otpCode);

    let user = await this.usersService.findUserByPhoneNumber(phoneNumber);

    if (!user) {
      user = await this.usersService.createUser({ phoneNumber }, UserRole.USER);
    }

    const { accessToken, refreshToken } =
      await this.generateTokenProviders.generateToken(user);

    const isProfileComplete = Boolean(user.name && user.lastName);

    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isProfileComplete,
      },
      accessToken,
      refreshToken,
    };
  }
}
