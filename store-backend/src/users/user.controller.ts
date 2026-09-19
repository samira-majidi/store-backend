import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

import { User } from './entity/user.entity';
import { UserService } from './providers/user-service';
import { Permission } from '#src/rbac/enums/permission.enum';
import { Permissions } from '#src/rbac/decorators/permissions.decorator';

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

  /**
   * روت دریافت یک کاربر با شناسه
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'دریافت اطلاعات یک کاربر با شناسه (ID)',
    description:
      'مشخصات کامل یک کاربر بر اساس شناسه دیتابیسی او برگردانده می‌شود.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'شناسه عددی کاربر در دیتابیس',
  })
  @ApiOkResponse({
    description: 'اطلاعات کاربر با موفقیت پیدا شد.',
    type: User,
  })
  @ApiNotFoundResponse({
    description: 'کاربری با شناسه ارسال‌شده یافت نشد.',
  })
  @ApiInternalServerErrorResponse({
    description: 'خطای داخلی سرور در دریافت مشخصات کاربر.',
  })
  public async getUserById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<User> {
    return await this.userService.findUserById(id);
  }
}
