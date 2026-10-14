// فایل: gateway.interface.ts
import { GatewayVerificationResult } from '../types/payment.type';

export type ZarinpalCurrency = 'IRR' | 'IRT';

export interface PaymentMetadata {
  mobile?: string;
  email?: string;
}

export interface PaymentRequestParams {
  amount: number;
  orderId: string;
  description: string;
  currency?: ZarinpalCurrency;
  referrerId?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentVerifyParams {
  amount: number;
  authority: string;
}

export interface IPaymentGateway {
  request(params: PaymentRequestParams): Promise<string>;

  verify(params: PaymentVerifyParams): Promise<GatewayVerificationResult>;

  getPaymentUrl(authority: string): string;
}
