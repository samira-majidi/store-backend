import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface KavenegarResponse {
  return?: {
    status: number;
    message: string;
  };
  entries?: Array<{
    messageid: number;
    message: string;
    status: number;
    statustext: string;
    sender: string;
    receptor: string;
    date: number;
    cost: number;
  }>;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string;
  private readonly templateName: string;
  private readonly isDev: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('KAVENEGAR_API_KEY', '');
    this.templateName = this.configService.get<string>(
      'KAVENEGAR_VERIFY_TEMPLATE',
      'verify-code',
    );
    this.isDev = this.configService.get<string>('NODE_ENV') === 'development';

    if (!this.apiKey && !this.isDev) {
      this.logger.warn(
        '⚠️ KAVENEGAR_API_KEY is not defined in environment variables!',
      );
    }
  }

  async sendOtp(receptor: string, code: string): Promise<boolean> {
    if (this.isDev) {
      this.logger.log(`🧪 [DEV MODE] OTP Code for ${receptor}: 👉 ${code} 👈`);
      return true;
    }

    let data: KavenegarResponse;

    try {
      const url = `https://api.kavenegar.com/v1/${this.apiKey}/verify/lookup.json`;
      const body = new URLSearchParams({
        receptor,
        token: code,
        template: this.templateName,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      data = (await response.json()) as KavenegarResponse;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown network error';
      this.logger.error(`❌ Network error: ${errorMessage}`);
      throw new InternalServerErrorException(
        'عدم برقراری ارتباط با سرویس پیامک',
      );
    }

    if (data?.return?.status === 200) {
      this.logger.log(`✅ OTP SMS sent successfully to ${receptor}`);
      return true;
    }

    this.logger.error(
      `❌ Kavenegar API Error: ${data?.return?.message || 'Unknown error'}`,
    );
    throw new InternalServerErrorException('خطا در ارسال پیامک اعتبارسنجی');
  }
}
