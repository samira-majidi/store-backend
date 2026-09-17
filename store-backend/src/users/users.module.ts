import { Module } from '@nestjs/common';
import { UserService } from './providers/user-service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { CreateUserProvider } from './providers/create-user.provider';

@Module({
  providers: [UserService, CreateUserProvider],
  exports: [UserService],

  imports: [TypeOrmModule.forFeature([User])],
})
export class UsersModule {}
