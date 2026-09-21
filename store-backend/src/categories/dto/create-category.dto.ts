// src/categories/dto/create-category.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

// فقط حروف فارسی/انگلیسی، عدد و خط تیره
const SLUG_PATTERN = /^[\u0600-\u06FFa-z0-9]+(?:-[\u0600-\u06FFa-z0-9]+)*$/;

export class CreateCategoryDto {
  @ApiProperty({ example: 'فشارسنج بازویی دیجیتال', maxLength: 150 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(2, 150)
  name: string;

  @ApiPropertyOptional({
    example: 'فشارسنج-بازویی-دیجیتال',
    description: 'در صورت خالی بودن، از name تولید می‌شود',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Length(2, 200)
  @Matches(SLUG_PATTERN, {
    message: 'اسلاگ فقط می‌تواند شامل حرف، عدد و خط تیره باشد',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'آیدی دسته والد؛ خالی = دسته ریشه' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ default: 0, description: 'ترتیب نمایش بین هم‌سطح‌ها' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  metaTitle?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  metaDescription?: string;
}
