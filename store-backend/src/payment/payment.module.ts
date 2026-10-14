import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { PaymentController } from './controller/payment.controller';
import { PaymentService } from './payment.service';

import { Payment } from './entities/payment.entity';
import { Order } from '#src/orders/entities/order.entity';

import { PaymentTransactionRepository } from './repositories/payment-transaction.repository';
import { ZarinpalAdapter } from './adapters/zarinpal.adapter';

@Module({
  imports: [
    ConfigModule,

    TypeOrmModule.forFeature([Payment, Order]),

    BullModule.registerQueue({
      name: 'order-expiration',
    }),
  ],

  controllers: [PaymentController],

  providers: [PaymentService, PaymentTransactionRepository, ZarinpalAdapter],

  exports: [PaymentService, PaymentTransactionRepository],
})
export class PaymentModule {}
