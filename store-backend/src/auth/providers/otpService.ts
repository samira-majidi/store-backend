import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '#src/redis/providers/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OtpService {
  private readonly OTP_PREFIX = 'otp_code:';
  private readonly ATTEMPT_PREFIX = 'otp_attempts:';

  private readonly OTP_TTL = 120;

  private readonly MAX_ATTEMPTS = 3;

  private readonly BLOCK_TTL = 300;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * تولید و ذخیره کد OTP
   */

  public async createAndSaveOtp(phoneNumber: string): Promise<string> {
    const isDev = this.configService.get<string>('NODE_ENV') !== 'production';
    const attemptKey = `${this.ATTEMPT_PREFIX}${phoneNumber}`;

    const attempts = (await this.redisService.get<number>(attemptKey)) || 0;

    // در محیط توسعه لیمیتر رو رد می‌کنیم تا موقع تست کلافه نشی
    if (!isDev && attempts >= this.MAX_ATTEMPTS) {
      throw new HttpException(
        'شما بیش از حد مجاز تلاش کرده‌اید. لطفا چند دقیقه دیگر دوباره تلاش کنید.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();

    const otpKey = `${this.OTP_PREFIX}${phoneNumber}`;
    await this.redisService.set(otpKey, otpCode, this.OTP_TTL);
    await this.redisService.set(attemptKey, attempts + 1, this.BLOCK_TTL);

    // 📢 نمایش شیک کد داخل ترمینال فقط در محیط توسعه
    if (isDev) {
      console.log('\n┌───────────────────────────────────────────────┐');
      console.log(`│ 🚀 [DEV MODE] New OTP Generated               │`);
      console.log(`│ 📱 Phone : ${phoneNumber.padEnd(34)} │`);
      console.log(`│ 🔑 Code  : ${otpCode.padEnd(34)} │`);
      console.log('└───────────────────────────────────────────────┘\n');
    }

    return otpCode;
  }

  /**
   * بررسی صحت کد OTP
   */
  public async validateOtp(
    phoneNumber: string,
    code: string,
  ): Promise<boolean> {
    const otpKey = `${this.OTP_PREFIX}${phoneNumber}`;

    const savedCode = await this.redisService.get<string>(otpKey);

    if (!savedCode) {
      throw new BadRequestException('کد تایید منقضی شده یا وجود ندارد.');
    }

    if (savedCode !== code) {
      throw new BadRequestException('کد تایید اشتباه است.');
    }

    await this.redisService.del(otpKey);
    await this.redisService.del(`${this.ATTEMPT_PREFIX}${phoneNumber}`);

    return true;
  }
}
