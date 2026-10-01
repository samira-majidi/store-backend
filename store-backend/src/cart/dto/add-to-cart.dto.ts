import { IsInt, IsNotEmpty, IsUUID, Min, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// پایه (برای کاربر لاگین شده)
export class UserAddToCartDto {
  @ApiProperty({ description: 'شناسه تنوع محصول' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'تعداد محصول', example: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class GuestAddToCartDto extends UserAddToCartDto {
  @ApiProperty({ description: 'شناسه سبد خرید مهمان (تولید شده توسط فرانت)' })
  @IsString()
  @IsNotEmpty()
  cartId: string;
}
