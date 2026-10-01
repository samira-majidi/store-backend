import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetDiscountDto {
  @ApiProperty({
    description: 'درصد تخفیف بین 0 تا ۹۹ (برای حذف تخفیف null بفرستید)',
    example: 20,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  discountPercentage?: number | null;
}
