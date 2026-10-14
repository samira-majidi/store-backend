import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentGateway,
  PaymentRequestParams,
  PaymentVerifyParams,
} from '../interfaces/gateway.interface';
import { GatewayVerificationResult } from '../types/payment.type';

const ZarinpalErrorItemSchema = z
  .object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  })
  .passthrough();

const ZarinpalErrorSchema = z.union([
  ZarinpalErrorItemSchema,
  z.array(z.unknown()),
]);

const ZarinpalRequestResponseSchema = z.object({
  data: z
    .object({
      code: z.number(),
      message: z.string().optional(),
      authority: z.string().trim().min(1).optional(),
      fee_type: z.string().nullable().optional(),
      fee: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),

  errors: ZarinpalErrorSchema.nullable().optional(),
});

const ZarinpalVerifyResponseSchema = z.object({
  data: z
    .object({
      code: z.number(),
      message: z.string().optional(),

      ref_id: z
        .union([z.number(), z.string()])
        .transform(String)
        .nullable()
        .optional(),

      card_pan: z.string().nullable().optional(),
      card_hash: z.string().nullable().optional(),
      fee_type: z.string().nullable().optional(),
      fee: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),

  errors: ZarinpalErrorSchema.nullable().optional(),
});

type ZarinpalErrors = z.infer<typeof ZarinpalErrorSchema>;

@Injectable()
export class ZarinpalAdapter implements IPaymentGateway {
  private readonly logger = new Logger(ZarinpalAdapter.name);
  private readonly merchantId: string;
  private readonly callbackUrl: string;
  private readonly requestUrl: string;
  private readonly verifyUrl: string;
  private readonly gatewayUrl: string;

  private readonly timeoutMs = 15_000;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService
      .getOrThrow<string>('ZARINPAL_MERCHANT_ID')
      .trim();

    this.callbackUrl = this.configService
      .getOrThrow<string>('PAYMENT_CALLBACK_URL')
      .trim();

    this.requestUrl = this.configService
      .getOrThrow<string>('ZARINPAL_REQUEST_URL')
      .trim();

    this.verifyUrl = this.configService
      .getOrThrow<string>('ZARINPAL_VERIFY_URL')
      .trim();

    this.gatewayUrl = this.configService
      .getOrThrow<string>('ZARINPAL_START_PAY_URL')
      .trim();
  }

  getPaymentUrl(authority: string): string {
    const normalizedAuthority = authority?.trim();

    if (!normalizedAuthority) {
      throw new BadRequestException('شناسه پرداخت زرین‌پال معتبر نیست.');
    }

    return `${this.gatewayUrl}${encodeURIComponent(normalizedAuthority)}`;
  }

  async request(params: PaymentRequestParams): Promise<string> {
    this.ensureConfiguration();

    const orderId = params.orderId?.trim();
    const description = params.description?.trim();

    if (!orderId) {
      throw new BadRequestException('شماره سفارش الزامی است.');
    }

    if (!description) {
      throw new BadRequestException('توضیحات پرداخت الزامی است.');
    }

    const amount = this.normalizeAmount(params.amount);

    const metadata: Record<string, string> = {
      order_id: orderId,
    };

    if (params.metadata?.mobile?.trim()) {
      metadata.mobile = params.metadata.mobile.trim();
    }

    if (params.metadata?.email?.trim()) {
      metadata.email = params.metadata.email.trim();
    }

    const payload: Record<string, unknown> = {
      merchant_id: this.merchantId,
      amount,
      description,
      callback_url: this.callbackUrl,
      metadata,
    };

    if (params.currency) {
      payload.currency = params.currency;
    }

    if (params.referrerId?.trim()) {
      payload.referrer_id = params.referrerId.trim();
    }

    const body = await this.postGateway('request', this.requestUrl, payload);

    const parsed = ZarinpalRequestResponseSchema.safeParse(body);

    if (!parsed.success) {
      this.logger.error(
        'Invalid Zarinpal request response',
        parsed.error.flatten(),
      );

      throw new ServiceUnavailableException(
        'ساختار پاسخ درگاه زرین‌پال معتبر نیست.',
      );
    }

    const { data, errors } = parsed.data;

    if (this.hasGatewayErrors(errors)) {
      throw new BadRequestException(this.getGatewayErrorMessage(errors));
    }

    if (data?.code !== 100 || !data.authority) {
      throw new BadRequestException(
        data?.message ?? 'درخواست پرداخت توسط زرین‌پال پذیرفته نشد.',
      );
    }

    return data.authority;
  }

  async verify(
    params: PaymentVerifyParams,
  ): Promise<GatewayVerificationResult> {
    this.ensureConfiguration();

    const authority = params.authority?.trim();

    if (!authority) {
      throw new BadRequestException('Authority پرداخت الزامی است.');
    }

    const amount = this.normalizeAmount(params.amount);

    const body = await this.postGateway('verify', this.verifyUrl, {
      merchant_id: this.merchantId,
      amount,
      authority,
    });

    const parsed = ZarinpalVerifyResponseSchema.safeParse(body);

    if (!parsed.success) {
      this.logger.error(
        'Invalid Zarinpal verify response',
        parsed.error.flatten(),
      );

      throw new ServiceUnavailableException(
        'ساختار پاسخ اعتبارسنجی زرین‌پال معتبر نیست.',
      );
    }

    const { data, errors } = parsed.data;

    /*
     * 100: پرداخت موفق و verify موفق
     * 101: پرداخت قبلاً verify شده است
     *
     * هر دو کد از نظر پرداخت موفق هستند.
     * جلوگیری از ثبت مجدد سفارش باید در لایه سرویس و دیتابیس
     * با authority یا ref_id انجام شود.
     */
    if (
      (data?.code === 100 || data?.code === 101) &&
      !this.hasGatewayErrors(errors)
    ) {
      return {
        kind: 'verified',
        code: data.code,
        refId: data.ref_id ?? null,
        cardPan: data.card_pan ?? null,
        cardHash: data.card_hash ?? null,
        feeType: data.fee_type ?? null,
        fee: data.fee ?? null,
      };
    }

    return {
      kind: 'unconfirmed',
      code: data?.code ?? this.getGatewayErrorCode(errors),
      message: data?.message ?? this.getGatewayErrorMessage(errors),
    };
  }

  private ensureConfiguration(): void {
    if (!this.merchantId || !this.callbackUrl) {
      throw new ServiceUnavailableException(
        'تنظیمات درگاه زرین‌پال کامل نیست.',
      );
    }
  }

  private normalizeAmount(value: unknown): number {
    const amount = typeof value === 'string' ? Number(value.trim()) : value;

    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new BadRequestException('مبلغ پرداخت باید یک عدد صحیح مثبت باشد.');
    }

    return amount;
  }

  private async postGateway(
    operation: 'request' | 'verify',
    url: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await axios.post<unknown>(url, payload, {
        timeout: this.timeoutMs,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        this.logger.error(
          `Zarinpal ${operation} returned HTTP ${response.status}`,
        );

        throw new ServiceUnavailableException(
          'درگاه زرین‌پال پاسخ معتبری ارسال نکرد.',
        );
      }

      return response.data;
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logGatewayError(operation, error);

      throw new ServiceUnavailableException(
        operation === 'request'
          ? 'ارتباط با درگاه زرین‌پال برقرار نشد.'
          : 'نتیجه پرداخت فعلاً از زرین‌پال قابل دریافت نیست.',
      );
    }
  }

  private hasGatewayErrors(errors: ZarinpalErrors | null | undefined): boolean {
    if (errors == null) {
      return false;
    }

    if (Array.isArray(errors)) {
      return errors.length > 0;
    }

    return Object.keys(errors).length > 0;
  }

  private getGatewayErrorCode(
    errors: ZarinpalErrors | null | undefined,
  ): number | null {
    if (!errors) {
      return null;
    }

    if (!Array.isArray(errors)) {
      return this.toNumber(errors.code);
    }

    for (const item of errors) {
      const parsed = ZarinpalErrorItemSchema.safeParse(item);

      if (!parsed.success) {
        continue;
      }

      const code = this.toNumber(parsed.data.code);

      if (code !== null) {
        return code;
      }
    }

    return null;
  }

  private getGatewayErrorMessage(
    errors: ZarinpalErrors | null | undefined,
  ): string {
    if (!errors) {
      return 'درگاه موفقیت پرداخت را تأیید نکرد.';
    }

    if (!Array.isArray(errors)) {
      return errors.message ?? 'درگاه موفقیت پرداخت را تأیید نکرد.';
    }

    for (const item of errors) {
      const parsed = ZarinpalErrorItemSchema.safeParse(item);

      if (parsed.success && parsed.data.message) {
        return parsed.data.message;
      }
    }

    return 'زرین‌پال درخواست پرداخت را رد کرد.';
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }

    return null;
  }

  private logGatewayError(
    operation: 'request' | 'verify',
    error: unknown,
  ): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logger.error(
        `Zarinpal ${operation} failed: ` +
          `code=${axiosError.code ?? 'UNKNOWN'}, ` +
          `http=${axiosError.response?.status ?? 'UNKNOWN'}`,
      );

      return;
    }

    this.logger.error(`Zarinpal ${operation} failed unexpectedly.`);
  }
}
