import { PickType } from '@nestjs/swagger';

import { CreateUserDto } from '../../users/dtos/create-user.dto';

export class CompleteProfileDto extends PickType(CreateUserDto, [
  'name',
  'lastName',
] as const) {}
