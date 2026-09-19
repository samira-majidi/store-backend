// decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/permission.enum';
import { PERMISSIONS_KEY } from '../constants/permission-constant';

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
