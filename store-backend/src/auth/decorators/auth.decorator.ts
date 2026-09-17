import { SetMetadata } from '@nestjs/common';
import { AuthType } from '../enums/auth-type.enum';
import { AUTH_TYPE_KEY } from '../constants/auth-constant';

export const Auth = (...authtype: AuthType[]) =>
  SetMetadata(AUTH_TYPE_KEY, authtype);
