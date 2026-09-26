import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @Type(() => Number)
  @IsInt({ message: 'قیمت باید یک عدد صحیح باشد' })
  @Min(0, { message: 'قیمت نمی‌تواند منفی باشد' })
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @IsInt({ message: 'موجودی باید عدد صحیح باشد' })
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    description:
      'آرایه‌ای از شناسه‌های تصاویر. اولین شناسه (ایندکس صفر) به عنوان عکس اصلی و بقیه به عنوان گالری در نظر گرفته می‌شوند.',
    example: [12, 5, 8],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'محصول باید حداقل دارای یک تصویر (به عنوان تصویر اصلی) باشد',
  })
  @IsNumber({}, { each: true, message: 'شناسه تصویر باید عدد باشد' })
  imageIds: number[];

  @ApiProperty({ description: 'آیدی دسته‌بندی محصول', example: 5 })
  @IsInt()
  @IsNotEmpty()
  categoryId: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsBoolean()
  isSpecial?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'محصول باید حداقل دارای یک تنوع (Variant) باشد' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];
}
