import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ShippingMethod } from '../enums/order.enum';
import { trimString } from '../utils/trim.util';
import { convertDigits } from '../utils/convert-digits.util';

export class CreateOrderDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @Transform(convertDigits)
  @IsString()
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل گیرنده معتبر نیست' })
  mobile: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  fullAddress: string;

  @Transform(convertDigits)
  @IsString()
  @Matches(/^\d{10}$/, { message: 'کد پستی باید ۱۰ رقم باشد' })
  postalCode: string;

  @IsEnum(ShippingMethod)
  shippingMethod: ShippingMethod;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
