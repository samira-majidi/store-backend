// src/orders/dto/update-order-status.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../enums/order.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'وضعیت جدید سفارش',
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
  })
  @IsEnum(OrderStatus, {
    message: 'وضعیت سفارش معتبر نیست.',
  })
  status: OrderStatus;
}
