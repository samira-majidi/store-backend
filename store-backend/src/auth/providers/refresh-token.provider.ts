import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RefreshToken } from '../dto/refresh-token.dto';
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
  public async refreshToken(refreshtokenDto: RefreshToken) {
    const { sub } = await this.jwtService.verifyAsync<
      Pick<ActiveUserData, 'sub'>
    >(refreshtokenDto.refreshToken, {
      secret: this.jwtConfiguration.secret,
      audience: this.jwtConfiguration.audience,
      issuer: this.jwtConfiguration.issuer,
    });

    const user = await this.usersService.findUserById(sub);

    return await this.generateTokenProvider.generateToken(user);
  }
}
