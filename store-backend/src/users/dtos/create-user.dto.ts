import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل وارد شده معتبر نیست. مثال: 09123456789',
  })
  phoneNumber: string;
}
