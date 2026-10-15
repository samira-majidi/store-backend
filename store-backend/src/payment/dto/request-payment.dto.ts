import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RequestPaymentDto {
  @ApiProperty({
    description: 'شناسه سفارش متعلق به کاربر',
    format: 'uuid',
    example: '045662bf-8900-4846-915f-56f4f02deca8',
  })
  @IsUUID('all', {
    message: 'شناسه سفارش باید UUID معتبر باشد.',
  })
  orderId!: string;
}
