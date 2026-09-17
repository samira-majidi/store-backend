import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entity/user.entity';
import { UserRole } from '../dtos/user-role.enum';

@Injectable()
export class CreateUserProvider {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  public async createUser(
    createUserDto: CreateUserDto,
    role: UserRole,
  ): Promise<User> {
    const user = this.userRepository.create({
      ...createUserDto,
      role,
    });

    return this.userRepository.save(user);
  }
}
