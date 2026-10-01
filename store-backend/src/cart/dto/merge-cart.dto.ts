import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeCartDto {
  @ApiProperty({ description: 'شناسه سبد مهمان برای ادغام' })
  @IsString()
  @IsNotEmpty()
  guestCartId: string;
}
