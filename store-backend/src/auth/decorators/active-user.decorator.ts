import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActiveUserData } from '../interfaces/active-user.interface';
import { REQUEST_USER_KEY } from '../constants/auth-constant';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

export const ActiveUser = createParamDecorator(
  (field: keyof ActiveUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request[REQUEST_USER_KEY];

    return field ? user?.[field] : user;
  },
);
