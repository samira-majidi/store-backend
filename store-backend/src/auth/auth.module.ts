import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '#src/users/users.module';
import { ConfigModule } from '@nestjs/config';

import { JwtModule } from '@nestjs/jwt';
import { GenerateTokenProviders } from './providers/generate-token.providers';
import { RefreshTokenProvider } from './providers/refresh-token.provider';
import jwtConfig from '#src/common/config/jwt-config';
import { OtpService } from './providers/otpService';
import { SmsService } from './providers/sms.service';
@Module({
  imports: [
    UsersModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],

  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SmsService,
    GenerateTokenProviders,
    RefreshTokenProvider,
  ],
  exports: [AuthService],
})
export class AuthModule {}
