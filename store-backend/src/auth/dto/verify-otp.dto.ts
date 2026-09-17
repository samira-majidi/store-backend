import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'شماره موبایل کاربر',
    example: '09123456789',
  })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'فرمت شماره موبایل نامعتبر است.' })
  phoneNumber: string;

  @ApiProperty({
    description: 'کد تایید دریافت شده از طریق پیامک',
    example: '12345',
    minLength: 4,
    maxLength: 6,
  })
  @IsNotEmpty({ message: 'کد تایید الزامی است.' })
  @Length(5, 5, { message: 'کد تایید باید ۵ رقم باشد.' })
  code: string;
}
