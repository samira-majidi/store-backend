import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { convertToEnglishDigits } from '#src/common/utils/persian-number-converter';

export const PERSIAN_LETTERS_REGEX = /^[\u0600-\u06FF\s\u200c]+$/;

export const IRAN_PHONE_REGEX = /^09\d{9}$/;

export class CreateUserDto {
  @ApiProperty({
    description: 'نام کاربر (فقط حروف فارسی)',
    example: 'سمیرا',
  })
  @IsNotEmpty({ message: 'وارد کردن نام الزامی است.' })
  @IsString({ message: 'نام باید از نوع متنی باشد.' })
  @Length(2, 50, { message: 'نام باید بین ۲ تا ۵۰ کاراکتر باشد.' })
  @Matches(PERSIAN_LETTERS_REGEX, {
    message:
      'نام فقط باید شامل حروف فارسی باشد (حروف انگلیسی یا اعداد مجاز نیست).',
  })
  name?: string;

  @ApiProperty({
    description: 'نام خانوادگی کاربر (فقط حروف فارسی)',
    example: 'مجیدی',
  })
  @IsNotEmpty({ message: 'وارد کردن نام خانوادگی الزامی است.' })
  @IsString({ message: 'نام خانوادگی باید از نوع متنی باشد.' })
  @Length(2, 50, { message: 'نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد.' })
  @Matches(PERSIAN_LETTERS_REGEX, {
    message: 'نام خانوادگی فقط باید شامل حروف فارسی باشد.',
  })
  lastName?: string;

  @ApiProperty({
    description: 'شماره موبایل کاربر (با 09 شروع شود)',
    example: '09123456789',
  })
  @IsNotEmpty({ message: 'وارد کردن شماره موبایل الزامی است.' })
  @Transform(({ value }: { value: unknown }) => {
    return typeof value === 'string' ? convertToEnglishDigits(value) : value;
  })
  @Matches(IRAN_PHONE_REGEX, {
    message: 'فرمت شماره موبایل نامعتبر است. نمونه صحیح: 09123456789',
  })
  phoneNumber: string;
}
