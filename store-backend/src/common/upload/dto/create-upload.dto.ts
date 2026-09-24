import { IsString, Matches } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  filename: string;

  @IsString()
  @Matches(/^(image\/png|image\/jpeg|image\/webp)$/, {
    message: 'فقط فرمت‌های png, jpeg و webp مجاز هستند',
  })
  contentType: string;
}
