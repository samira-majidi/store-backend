import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Order } from '#src/orders/entities/order.entity';
import { OrderItem } from '#src/orders/entities/order-item.entity';
import { OrderStatus } from '#src/orders/enums/order.enum';
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  GatewayVerificationResult,
  VerifyPaymentResult,
  StockReservationItem,
} from '../types/payment.type';

@Injectable()
export class PaymentTransactionRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createPaymentWithLock(
    userId: number,
    orderId: string,
    amount: number,
    authority: string,
  ): Promise<string> {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const order = await this.lockOrder(manager, orderId);

      if (order.userId !== userId) {
        throw new NotFoundException('سفارش یافت نشد.');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('این سفارش در وضعیت انتظار پرداخت نیست.');
      }

      if (Number(order.finalAmount) !== amount) {
        throw new ConflictException('مبلغ سفارش تغییر کرده است.');
      }

      const repository = manager.getRepository(Payment);
      const pendingPayment = await repository.findOne({
        where: { orderId: order.id, status: PaymentStatus.PENDING },
        order: { createdAt: 'DESC' },
      });

      if (pendingPayment) {
        return pendingPayment.authority;
      }

      const payment = repository.create({
        orderId: order.id,
        amount,
        authority,
        status: PaymentStatus.PENDING,
      });

      await repository.save(payment);
      return payment.authority;
    });
  }

  async applySuccessfulPayment(
    payment: Payment,
    gatewayResult: Extract<GatewayVerificationResult, { kind: 'verified' }>,
  ): Promise<VerifyPaymentResult> {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const order = await this.lockOrder(manager, payment.orderId);
      const lockedPayment = await manager
        .getRepository(Payment)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.id = :paymentId', { paymentId: payment.id })
        .getOne();

      if (!lockedPayment) {
        throw new NotFoundException('تراکنش یافت نشد.');
      }

      if (lockedPayment.status === PaymentStatus.SUCCESS) {
        return this.buildRecordedResult(lockedPayment, order);
      }

      let requiresReview = true;
      const amountMatches =
        Number(order.finalAmount) === Number(lockedPayment.amount);

      if (order.status === OrderStatus.PENDING_PAYMENT && amountMatches) {
        const orderItems = await manager
          .getRepository(OrderItem)
          .find({ where: { orderId: order.id } });
        await this.consumeReservedStock(manager, orderItems);

        const updateResult = await manager
          .getRepository(Order)
          .update(
            { id: order.id, status: OrderStatus.PENDING_PAYMENT },
            { status: OrderStatus.PAID },
          );

        if (updateResult.affected === 1) {
          requiresReview = false;
        } else {
          requiresReview = true;
        }
        if (updateResult.affected !== 1) {
          throw new ConflictException(
            'وضعیت سفارش هنگام ثبت پرداخت تغییر کرده است.',
          );
        }

        requiresReview = false;
      }

      lockedPayment.status = PaymentStatus.SUCCESS;

      lockedPayment.refId = gatewayResult.refId ?? lockedPayment.refId ?? null;
      lockedPayment.cardNumber =
        gatewayResult.cardPan ?? lockedPayment.cardNumber ?? null;

      lockedPayment.gatewayCode = String(gatewayResult.code);
      lockedPayment.failureReason = requiresReview ? 'REVIEW_REQUIRED' : null;

      await manager.getRepository(Payment).save(lockedPayment);

      return {
        success: true,
        message: requiresReview
          ? 'پرداخت موفق ثبت شد، اما سفارش نیاز به بررسی و احتمالاً بازپرداخت دارد.'
          : 'پرداخت با موفقیت ثبت شد و سفارش پرداخت‌شده است.',
        orderId: order.id,
        refId: lockedPayment.refId ?? null,
        alreadyProcessed: false,
        requiresReview,
        retryable: false,
      };
    });
  }

  async recordUnconfirmedResult(
    payment: Payment,
    gatewayResult: Extract<GatewayVerificationResult, { kind: 'unconfirmed' }>,
  ): Promise<VerifyPaymentResult> {
    await this.dataSource.getRepository(Payment).update(
      { id: payment.id, status: PaymentStatus.PENDING },
      {
        status: PaymentStatus.FAILED,
        gatewayCode:
          gatewayResult.code === null ? null : String(gatewayResult.code),
        failureReason: gatewayResult.message,
      },
    );

    const latestPayment = await this.dataSource
      .getRepository(Payment)
      .findOne({ where: { id: payment.id } });
    if (latestPayment?.status === PaymentStatus.SUCCESS) {
      const order = await this.dataSource
        .getRepository(Order)
        .findOne({ where: { id: payment.orderId } });
      if (order) return this.buildRecordedResult(latestPayment, order);
    }

    return {
      success: false,
      message: 'موفقیت پرداخت تأیید نشد؛ نتیجه نیاز به بررسی مجدد دارد.',
      orderId: payment.orderId,
      refId: null,
      alreadyProcessed: false,
      requiresReview: false,
      retryable: true,
    };
  }

  private async lockOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<Order> {
    const order = await manager
      .getRepository(Order)
      .createQueryBuilder('order')
      .setLock('pessimistic_write')
      .where('order.id = :orderId', { orderId })
      .getOne();

    if (!order) throw new NotFoundException('سفارش یافت نشد.');
    return order;
  }

  private async consumeReservedStock(
    manager: EntityManager,
    orderItems: OrderItem[],
  ): Promise<void> {
    const reservations = new Map<string, StockReservationItem>();
    for (const item of orderItems) {
      const key = String(item.variantId);
      const quantity = (reservations.get(key)?.quantity ?? 0) + item.quantity;
      reservations.set(key, { variantId: item.variantId!, quantity });
    }

    for (const res of reservations.values()) {
      const updateResult = await manager
        .getRepository(ProductVariant)
        .createQueryBuilder()
        .update(ProductVariant)
        .set({ reservedStock: () => '"reservedStock" - :quantity' })
        .where('id = :variantId', { variantId: res.variantId })
        .andWhere('"reservedStock" >= :quantity', { quantity: res.quantity })
        .execute();

      if (updateResult.affected !== 1) {
        throw new ConflictException(
          `رزرو موجودی تنوع ${res.variantId} کافی یا معتبر نیست.`,
        );
      }
    }
  }

  public buildRecordedResult(
    payment: Payment,
    order: Order,
  ): VerifyPaymentResult {
    const requiresReview =
      payment.failureReason === 'REVIEW_REQUIRED' ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.PENDING_PAYMENT;

    return {
      success: true,
      message: requiresReview
        ? 'سفارش نیاز به بررسی دارد.'
        : 'این پرداخت قبلاً با موفقیت ثبت شده است.',
      orderId: order.id,
      refId: payment.refId ?? null,
      alreadyProcessed: true,
      requiresReview,
      retryable: false,
    };
  }
}
