import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

import { CartEntity } from '../cart/entity/cart.entity';
import { CartItemEntity } from '../cart/entity/cart-item.entity';

import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { OrderService } from './order.Service';
import { OrderController } from './order.controller';
import { OrderExpirationProcessor } from './processor/order-expiration.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      CartEntity,
      CartItemEntity,
      ProductVariant,
    ]),

    BullModule.registerQueue({
      name: 'order-expiration',
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderExpirationProcessor],

  exports: [OrderService],
})
export class OrdersModule {}
