import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthType } from '#src/auth/enums/auth-type.enum';
import { AccessTokenGuard } from '../access-token/access-token.guard';
import { AUTH_TYPE_KEY } from '#src/auth/constants/auth-constant';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  authTypeGuardMap: Record<AuthType, CanActivate>;

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
  ) {
    //آن `[AuthType.Bearer]` آرایه نیست؛ یعنی مقدار `AuthType.Bearer` را حساب کن و
    // از آن به‌عنوان **کلید (key)** آبجکت استفاده کن.
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,

      [AuthType.None]: { canActivate: () => true },
    };
  }

  private static readonly defaultAuthType = AuthType.Bearer;
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypes = this.reflector.getAllAndOverride<AuthType[]>(
      AUTH_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [AuthenticationGuard.defaultAuthType];

    const guards = authTypes.map((type) => this.authTypeGuardMap[type]).flat();

    const error = new UnauthorizedException();

    for (const instance of guards) {
      try {
        const canActivate = await Promise.resolve(
          instance.canActivate(context),
        );

        if (canActivate) {
          return true;
        }
      } catch (err) {
        if (!(err instanceof UnauthorizedException)) {
          throw err;
        }
      }
    }

    throw error;
  }
}
