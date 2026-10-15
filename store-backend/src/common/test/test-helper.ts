import { ConfigModule } from '@nestjs/config';
import {
  DynamicModule,
  ForwardReference,
  Provider,
  Type,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

// ==========================================
// انتیتی‌های کامل سیستم (Core Entities)
// ==========================================
import { User } from '#src/users/entity/user.entity';
import { Category } from '#src/categories/entity/category.entity';
import { Product } from '#src/product/entity/product.entity';
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { Upload } from '#src/common/upload/entity/upload.entity';
import { CartEntity } from '#src/cart/entity/cart.entity';
import { CartItemEntity } from '#src/cart/entity/cart-item.entity';
import { Payment } from '#src/payment/entities/payment.entity';
import { OrderItem } from '#src/orders/entities/order-item.entity';
import { Order } from '#src/orders/entities/order.entity';

// ==========================================
// سرویس‌های زیرساخت Redis پروژه
// ==========================================
import { RedisService } from '#src/redis/providers/redis.service';
import { RedisLockService } from '#src/redis/providers/redis-lock.service';

export interface TestModuleOptions {
  providers?: Provider[];
  imports?: Array<
    Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference
  >;
}

export class IntegrationTestHelper {
  public static redisClient: Redis;
  public static dataSource: DataSource;
  public static moduleRef: TestingModule;

  public static readonly allEntities = [
    User,
    Category,
    Product,
    ProductVariant,
    Upload,
    CartEntity,
    CartItemEntity,
    Order,
    OrderItem,
    Payment,
  ];

  static async createTestingModule(
    options: TestModuleOptions = {},
  ): Promise<TestingModule> {
    const { providers = [], imports = [] } = options;

    const redisHost = process.env.REDIS_TEST_HOST || 'localhost';
    const redisPort = Number(process.env.REDIS_TEST_PORT) || 6379;

    this.redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      db: 15,
      lazyConnect: false,
    });

    this.moduleRef = await Test.createTestingModule({
      imports: [
        // حل مشکل دپندنسی RedisService (نیاز به ConfigService)
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              redis: {
                host: redisHost,
                port: redisPort,
                db: 15,
              },
              REDIS_HOST: redisHost,
              REDIS_PORT: redisPort,
              REDIS_DB: 15,
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_TEST_HOST || 'localhost',
          port: Number(process.env.DB_TEST_PORT) || 5432,
          username: process.env.DB_TEST_USER || 'postgres',
          password: process.env.DB_TEST_PASSWORD || '211067ha',
          database: 'store_test_db',
          entities: this.allEntities,
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature(this.allEntities),
        ...imports,
      ],
      providers: [
        RedisService,
        RedisLockService,
        {
          provide: 'REDIS_CLIENT',
          useValue: this.redisClient,
        },
        ...providers,
      ],
    }).compile();

    this.dataSource = this.moduleRef.get<DataSource>(DataSource);
    return this.moduleRef;
  }

  /**
   * تمیزکاری سریع و استاندارد: پاک کردن کامل Redis (db 15) و Truncate جداول PostgreSQL
   */
  static async cleanAll(): Promise<void> {
    if (this.redisClient?.status === 'ready') {
      await this.redisClient.flushdb();
    }

    if (this.dataSource?.isInitialized) {
      const entities = this.dataSource.entityMetadatas;
      for (const entity of entities) {
        const repository = this.dataSource.getRepository(entity.name);
        await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
      }
    }
  }

  static async closeAll(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }

    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }

    if (this.moduleRef) {
      await this.moduleRef.close();
    }
  }
}
