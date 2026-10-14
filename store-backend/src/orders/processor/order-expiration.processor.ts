import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order.enum';
import { ProductVariant } from '#src/product/entity/product-variant.entity';

interface ExpirationJobData {
  orderId: string;
}

@Processor('order-expiration')
export class OrderExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderExpirationProcessor.name);

  constructor(private readonly dataSource: DataSource) {
    super();
  }
  async process(job: Job<ExpirationJobData>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`[OrderExpiration] بررسی وضعیت انقضای سفارش: ${orderId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    let connected = false;

    try {
      await queryRunner.connect();
      connected = true;

      await queryRunner.startTransaction();

      const order = await queryRunner.manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        this.logger.warn(`[OrderExpiration] سفارش ${orderId} یافت نشد.`);
        await queryRunner.rollbackTransaction();
        return;
      }

      if (order.status === OrderStatus.PENDING_PAYMENT) {
        order.status = OrderStatus.CANCELLED;
        await queryRunner.manager.save(Order, order);

        const orderItems = await queryRunner.manager.find(OrderItem, {
          where: { orderId: order.id },
        });

        for (const item of orderItems) {
          if (!item.variantId) continue;

          await queryRunner.manager
            .createQueryBuilder()
            .update(ProductVariant)
            .set({
              stock: () => '"stock" + :qty',
              reservedStock: () => '"reservedStock" - :qty',
            })
            .where('id = :id', { id: item.variantId })
            .setParameter('qty', item.quantity)
            .execute();
        }

        await queryRunner.commitTransaction();
        this.logger.log(`⏳ سفارش ${orderId} منقضی و موجودی‌ها آزاد شدند.`);
      } else {
        await queryRunner.commitTransaction();
        this.logger.log(
          `✅ سفارش ${orderId} قبلاً تعیین تکلیف شده است (${order.status}).`,
        );
      }
    } catch (error: any) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ خطا در لغو سفارش ${orderId}: ${errorMessage}`);
      throw error;
    } finally {
      if (connected && !queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }
}
