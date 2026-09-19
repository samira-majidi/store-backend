import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../dtos/user-role.enum';
import { User } from '../entity/user.entity';

@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // اینجا هر دو متد رو صدا می‌زنیم که هر دو ادمین رو بسازه
    await this.seedAdmin();
    await this.seedHamidAdmin();
  }

  private async seedAdmin(): Promise<void> {
    const phoneNumber = process.env.ADMIN_PHONE_NUMBER;

    if (!phoneNumber) {
      this.logger.warn('ADMIN_PHONE_NUMBER is not set. Skipping admin seed.');
      return;
    }

    const existingAdmin = await this.userRepository.findOne({
      where: { phoneNumber },
    });

    if (existingAdmin) {
      this.logger.log(
        `Admin with phone ${phoneNumber} already exists. Skipping.`,
      );
      return;
    }

    const admin = this.userRepository.create({
      phoneNumber,
      role: UserRole.ADMIN,
      name: process.env.ADMIN_FIRST_NAME ?? 'Admin',
      lastName: process.env.ADMIN_LAST_NAME ?? 'User',
    });

    await this.userRepository.save(admin);
    this.logger.log(
      `Admin user created successfully for phone: ${phoneNumber}`,
    );
  }

  private async seedHamidAdmin(): Promise<void> {
    const phoneNumber = process.env.SECOND_ADMIN_PHONE;

    if (!phoneNumber) {
      this.logger.warn(
        'SECOND_ADMIN_PHONE is not set. Skipping second admin seed.',
      );
      return;
    }

    const existingAdmin = await this.userRepository.findOne({
      where: { phoneNumber },
    });

    if (existingAdmin) {
      this.logger.log(
        `Admin with phone ${phoneNumber} already exists. Skipping.`,
      );
      return;
    }

    const admin = this.userRepository.create({
      phoneNumber,
      role: UserRole.ADMIN,
      name: process.env.SECOND_ADMIN_FIRST_NAME ?? 'Hamid',
      lastName: process.env.SECOND_ADMIN_LAST_NAME ?? 'Shakeri',
    });

    await this.userRepository.save(admin);
    this.logger.log(
      `Second Admin user created successfully for phone: ${phoneNumber}`,
    );
  }
}
