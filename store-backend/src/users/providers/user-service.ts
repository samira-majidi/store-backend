import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserRole } from '../dtos/user-role.enum';
import { User } from '../entity/user.entity';
import { CreateUserProvider } from './create-user.provider';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly createUserProvider: CreateUserProvider,
  ) {}

  public async createUser(
    createUserDto: CreateUserDto,
    role: UserRole,
  ): Promise<User> {
    this.logger.log(
      `Attempting to create a new user with phone number: ${createUserDto.phoneNumber} and role: ${role}`,
    );

    try {
      const user = await this.createUserProvider.createUser(
        createUserDto,
        role,
      );
      this.logger.log(`User created successfully with ID: ${user.id}`);

      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; stack?: string };

      if (err.code === '23505') {
        this.logger.warn(
          `User creation failed - Phone number already exists: ${createUserDto.phoneNumber}`,
        );
        throw new ConflictException('این شماره موبایل قبلاً ثبت شده است.');
      }

      this.logger.error(`Failed to create user: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        'مشکلی در هنگام ثبت‌نام رخ داد، لطفاً مجدداً تلاش کنید.',
      );
    }
  }

  public async findUserById(id: number): Promise<User> {
    this.logger.log(`Fetching user with ID: ${id}`);

    try {
      const user = await this.userRepository.findOneBy({ id });

      if (!user) {
        this.logger.warn(`User with ID ${id} not found.`);
        throw new NotFoundException(`کاربری با شناسه ${id} یافت نشد.`);
      }

      this.logger.debug(`User with ID ${id} found successfully.`);
      return user;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const err = error as Error;
      this.logger.error(`Error fetching user with ID ${id}`, err.stack);
      throw new InternalServerErrorException(
        'خطایی در دریافت اطلاعات کاربر رخ داد.',
      );
    }
  }

  public async findUserByPhoneNumber(
    phoneNumber: string,
  ): Promise<User | null> {
    this.logger.log(`Searching for user with phone number: ${phoneNumber}`);

    try {
      const user = await this.userRepository.findOneBy({ phoneNumber });

      if (user) {
        this.logger.debug(`User found with phone number: ${phoneNumber}`);
      } else {
        this.logger.debug(`No user found with phone number: ${phoneNumber}`);
      }

      return user;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error searching user by phone number: ${phoneNumber}`,
        err.stack,
      );
      throw new InternalServerErrorException('خطایی در جستجوی کاربر رخ داد.');
    }
  }
}
