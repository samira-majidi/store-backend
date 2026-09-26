import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  CreateProductDto,
  CreateProductVariantDto,
} from './create-product.dto';
import { IsOptional, IsUUID, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductVariantDto extends PartialType(
  CreateProductVariantDto,
) {
  @ApiPropertyOptional({
    description: 'آیدی واریانت (اگر ارسال نشود، واریانت جدید ساخته می‌شود)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'فرمت آیدی واریانت باید UUID معتبر باشد' })
  id?: string;
}

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variants', 'slug'] as const),
) {
  @ApiPropertyOptional({
    description: 'لیست تنوع‌های محصول جهت ویرایش یا افزودن',
    type: () => [UpdateProductVariantDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantDto)
  variants?: UpdateProductVariantDto[];
}
