// src/auth/providers/refresh-token.provider.ts
import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as config from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { GenerateTokenProviders } from './generate-token.providers';
import { UserService } from '#src/users/providers/user-service';
import { ActiveUserData } from '../interfaces/active-user.interface';
import jwtConfig from '#src/common/config/jwt-config';

@Injectable()
export class RefreshTokenProvider {
  constructor(
    private readonly generateTokenProvider: GenerateTokenProviders,
    @Inject(forwardRef(() => UserService))
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: config.ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * متد تمدید توکن - ورودی را مستقیماً به عنوان رشته از کوکی می‌گیرد
   */
  public async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('رفرش توکن یافت نشد.');
    }

    try {
      const { sub } = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'sub'>
      >(refreshToken, {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
      });

      const user = await this.usersService.findUserById(sub);
      if (!user) {
        throw new UnauthorizedException('کاربر مورد نظر یافت نشد.');
      }

      return await this.generateTokenProvider.generateToken(user);
    } catch {
      throw new UnauthorizedException('رفرش توکن نامعتبر یا منقضی شده است.');
    }
  }
}
