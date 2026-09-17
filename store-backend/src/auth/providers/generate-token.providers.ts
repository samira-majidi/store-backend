import { Inject, Injectable } from '@nestjs/common';
import * as config from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload } from '../types/jwt-payload.type';

import { ActiveUserData } from '../interfaces/active-user.interface';
import { User } from '#src/users/entity/user.entity';
import jwtConfig from '#src/common/config/jwt-config';

@Injectable()
export class GenerateTokenProviders {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: config.ConfigType<typeof jwtConfig>,
  ) {}

  public async signToken<T>(userId: number, expiresIn: number, payload?: T) {
    return await this.jwtService.signAsync<JwtPayload>(
      {
        sub: userId,
        ...payload,
      },
      {
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        secret: this.jwtConfiguration.secret,
        expiresIn,
      },
    );
  }

  public async generateToken(user: User) {
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken<Partial<ActiveUserData>>(
        user.id,
        this.jwtConfiguration.accessTokenTtl,
        {
          phoneNumber: user.phoneNumber,
          role: user.role,
          name: user.name,
        },
      ),

      this.signToken(user.id, this.jwtConfiguration.refreshTokenTtl),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
