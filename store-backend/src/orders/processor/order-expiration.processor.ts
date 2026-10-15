import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { OrderService } from '../order.service';

interface ExpirationJobData {
  orderId: string;
}

@Processor('order-expiration')
export class OrderExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderExpirationProcessor.name);

  constructor(private readonly orderService: OrderService) {
    super();
  }

  async process(job: Job<ExpirationJobData>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`[OrderExpiration] بررسی وضعیت انقضای سفارش: ${orderId}`);

    try {
      const result =
        await this.orderService.cancelOrderAndReleaseStock(orderId);

      this.logger.log(`⏳ نتیجه انقضای سفارش ${orderId}: ${result.message}`);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ خطا در لغو سفارش ${orderId}: ${errorMessage}`);
      throw error;
    }
  }
}
