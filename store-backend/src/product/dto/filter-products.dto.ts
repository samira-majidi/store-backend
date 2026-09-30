import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsArray,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterProductsDto {
  @ApiPropertyOptional({ description: 'جستجو در نام یا اسلاگ محصول' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'شناسه دسته‌بندی' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'اسلاگ دسته‌بندی' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'حداقل قیمت (تومان)', example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'حداکثر قیمت (تومان)',
    example: 10000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'لیست برندها (می‌تواند آرایه یا رشته جدا شده با کاما باشد)',
    example: ['Omron', 'Microlife'],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (!value) return undefined;

    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
    }

    return undefined;
  })
  @IsArray()
  @IsString({ each: true })
  brands?: string[];

  @ApiPropertyOptional({ description: 'شماره صفحه', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'تعداد آیتم در هر صفحه', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'مرتب‌سازی',
    enum: ['newest', 'price_asc', 'price_desc'],
    default: 'newest',
  })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
}
