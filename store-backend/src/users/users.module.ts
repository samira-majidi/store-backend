import { Module } from '@nestjs/common';
import { UserService } from './providers/user-service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { CreateUserProvider } from './providers/create-user.provider';
import { AdminSeederService } from './providers/admin-seeder.service';
import { UserController } from './user.controller';

@Module({
  providers: [UserService, CreateUserProvider, AdminSeederService],
  exports: [UserService, AdminSeederService],
  controllers: [UserController],
  imports: [TypeOrmModule.forFeature([User])],
})
export class UsersModule {}
