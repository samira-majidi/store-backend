import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserService } from '#src/users/providers/user-service';

import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { REQUEST_USER_KEY } from '../constants/auth-constant';

@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  constructor(private readonly usersService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const activeUser = request[REQUEST_USER_KEY];

    if (!activeUser || !activeUser.sub) {
      throw new ForbiddenException('کاربر احراز هویت نشده است.');
    }

    const user = await this.usersService.findUserById(activeUser.sub);

    const isComplete = Boolean(user?.name && user?.lastName);

    if (!isComplete) {
      throw new ForbiddenException(
        'برای ثبت سفارش، لطفاً ابتدا نام و نام خانوادگی خود را در پروفایل تکمیل کنید.',
      );
    }

    return true;
  }
}
