export interface GatewayEnvelope {
  data: Record<string, unknown> | null;
  errors: unknown;
}

export type GatewayVerificationResult =
  | {
      kind: 'verified';
      code: 100 | 101;
      refId: string | null;
      cardPan: string | null;
      cardHash: string | null;
      feeType: string | null;
      fee: number | null;
    }
  | {
      kind: 'unconfirmed';
      code: number | null;
      message: string;
    };

export interface RequestPaymentResult {
  paymentUrl: string;
  authority: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  message: string;
  orderId: string;
  refId: string | null;
  alreadyProcessed: boolean;
  requiresReview: boolean;
  retryable: boolean;
}

export interface StockReservationItem {
  variantId: number | string;
  quantity: number;
}
