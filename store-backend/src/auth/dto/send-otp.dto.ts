import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'شماره موبایل کاربر (فرمت ایران)',
    example: '09123456789',
  })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'فرمت شماره موبایل نامعتبر است (مثال: 09123456789)',
  })
  phoneNumber: string;
}
