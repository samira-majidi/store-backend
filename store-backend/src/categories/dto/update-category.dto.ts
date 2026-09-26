// src/categories/dto/update-category.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['parentId'] as const),
) {}
