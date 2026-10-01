import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartEntity } from './entity/cart.entity';
import { CartItemEntity } from './entity/cart-item.entity';

import { RedisModule } from '#src/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartEntity, CartItemEntity]),

    RedisModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
