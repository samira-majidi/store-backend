// src/categories/dto/update-category.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

// parentId عمداً حذف شده — جابه‌جایی دسته از طریق API ممکن نیست
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['parentId'] as const),
) {}
