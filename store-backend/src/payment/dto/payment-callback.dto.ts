import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PaymentCallbackDto {
  @ApiProperty({
    description: 'شناسه تراکنش صادرشده توسط درگاه',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'شناسه تراکنش باید رشته باشد.',
  })
  @IsNotEmpty({
    message: 'شناسه تراکنش الزامی است.',
  })
  @MaxLength(255)
  Authority!: string;

  @ApiProperty({
    description: 'وضعیت بازگشتی درگاه',
    enum: ['OK', 'NOK'],
  })
  @IsString()
  @IsIn(['OK', 'NOK'], {
    message: 'وضعیت callback باید OK یا NOK باشد.',
  })
  Status!: 'OK' | 'NOK';
}
