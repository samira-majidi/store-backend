import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';

import { Payment, PaymentStatus } from './entities/payment.entity';
import type {
  RequestPaymentResult,
  VerifyPaymentResult,
} from './types/payment.type';
import type { IPaymentGateway } from './interfaces/gateway.interface';
import { ZarinpalAdapter } from './adapters/zarinpal.adapter';

import { Order } from '#src/orders/entities/order.entity';
import { PaymentTransactionRepository } from './repositories/payment-transaction.repository';
import { OrderStatus } from '#src/orders/enums/order.enum';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectQueue('order-expiration')
    private readonly expirationQueue: Queue,
    @Inject(ZarinpalAdapter)
    private readonly paymentGateway: IPaymentGateway,

    private readonly paymentTransactionRepo: PaymentTransactionRepository,
  ) {}

  async requestPayment(
    userId: number,
    orderId: string,
  ): Promise<RequestPaymentResult> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('این سفارش در وضعیت قابل پرداخت نیست.');
    }
    const existingPayment = await this.paymentRepo.findOne({
      where: { orderId: order.id, status: PaymentStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (existingPayment) {
      return {
        paymentUrl: this.paymentGateway.getPaymentUrl(
          existingPayment.authority,
        ),
        authority: existingPayment.authority,
      };
    }

    const amount = Number(order.finalAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('مبلغ پرداخت معتبر نیست.');
    }

    const authority = await this.paymentGateway.request({
      amount,
      orderId: order.id,
      description: `پرداخت سفارش ${order.id}`,
    });

    const selectedAuthority =
      await this.paymentTransactionRepo.createPaymentWithLock(
        userId,
        order.id,
        amount,
        authority,
      );

    return {
      paymentUrl: this.paymentGateway.getPaymentUrl(selectedAuthority),
      authority: selectedAuthority,
    };
  }

  async verifyPayment(
    authority: string,
    gatewayStatus?: string,
  ): Promise<VerifyPaymentResult> {
    const normalizedAuthority = authority.trim();
    if (!normalizedAuthority)
      throw new BadRequestException('شناسه معتبر نیست.');

    const payment = await this.paymentRepo.findOne({
      where: { authority: normalizedAuthority },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد.');

    if (payment.status === PaymentStatus.SUCCESS) {
      const order = await this.orderRepo.findOne({
        where: { id: payment.orderId },
      });
      return this.paymentTransactionRepo.buildRecordedResult(payment, order!);
    }
    if (gatewayStatus === 'NOK') {
      await this.paymentRepo.update(
        { id: payment.id },
        {
          status: PaymentStatus.FAILED,
          failureReason: 'پرداخت توسط کاربر لغو شد یا ناموفق بود.',
        },
      );

      return {
        success: false,
        message: 'پرداخت انجام نشد یا توسط کاربر لغو گردید.',
        orderId: payment.orderId,
        refId: null,
        alreadyProcessed: false,
        requiresReview: false,
        retryable: true,
      };
    }
    if (gatewayStatus !== 'OK') {
      this.logger.debug(
        `Callback requires verification: payment=${payment.id}`,
      );
    }

    const gatewayResult = await this.paymentGateway.verify({
      amount: Number(payment.amount),
      authority: payment.authority,
    });

    let result: VerifyPaymentResult;
    if (gatewayResult.kind === 'unconfirmed') {
      result = await this.paymentTransactionRepo.recordUnconfirmedResult(
        payment,
        gatewayResult,
      );
    } else {
      result = await this.paymentTransactionRepo.applySuccessfulPayment(
        payment,
        gatewayResult,
      );
      await this.removeExpirationJob(result.orderId);
    }

    if (result.requiresReview) {
      this.logger.error(
        `Payment requires review: order=${result.orderId}, payment=${payment.id}`,
      );
    }

    return result;
  }

  private async removeExpirationJob(orderId: string): Promise<void> {
    try {
      const jobId = `order-${orderId}`;
      const job = await this.expirationQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(
          `[PaymentService] جاب انقضای سفارش ${orderId} با موفقیت حذف شد.`,
        );
      }
    } catch {
      this.logger.warn(`Could not remove expiration job for order: ${orderId}`);
    }
  }
}
