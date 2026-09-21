import {
  Controller,
  Get,
  HttpStatus,
  HttpCode,
  Body,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { User } from './entity/user.entity';
import { UserService } from './providers/user-service';
import { Permission } from '#src/rbac/enums/permission.enum';
import { Permissions } from '#src/rbac/decorators/permissions.decorator';
import { ActiveUser } from '#src/auth/decorators/active-user.decorator';
import { CompleteProfileDto } from './dtos/complete-profile.dto';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Permissions(Permission.USER_READ_ALL)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'دریافت لیست تمام کاربران سیستم',
    description:
      'این اندپوینت لیست تمامی کاربران (عادی، متخصص و ادمین) را برمی‌گرداند. (دسترسی ادمین)',
  })
  @ApiOkResponse({
    description: 'لیست کاربران با موفقیت بازگردانده شد.',
    type: [User],
  })
  @ApiInternalServerErrorResponse({
    description: 'خطای داخلی سرور در دریافت اطلاعات کاربران.',
  })
  public async getAllUsers(): Promise<User[]> {
    return await this.userService.findAllUsers();
  }
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth() // این دکوراتور برای Swagger الزامیه تا بدونه این روت توکن می‌خواد
  @ApiOperation({
    summary: 'تکمیل یا ویرایش پروفایل کاربر',
    description:
      'کاربر پس از ثبت‌نام اولیه، اطلاعات تکمیلی خود (نام و نام خانوادگی) را از طریق این روت ارسال می‌کند.',
  })
  @ApiOkResponse({
    description: 'پروفایل کاربر با موفقیت بروزرسانی شد.',
  })
  @ApiBadRequestResponse({
    description: 'داده‌های ارسالی نامعتبر است (خطای ولیدیشن DTO).',
  })
  public async updateProfile(
    @ActiveUser('sub') userId: number,
    @Body() updateProfileDto: CompleteProfileDto,
  ) {
    return await this.userService.updateProfile(userId, updateProfileDto);
  }
  @Get('my-profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'دریافت پروفایل کاربری خودم',
    description:
      'اطلاعات پروفایل کاربری که لاگین کرده را بر اساس توکن برمی‌گرداند.',
  })
  @ApiOkResponse({
    description: 'اطلاعات پروفایل شما با موفقیت پیدا شد.',
    type: User,
  })
  public async getMyProfile(@ActiveUser('sub') userId: number): Promise<User> {
    return await this.userService.findUserById(userId);
  }
}
