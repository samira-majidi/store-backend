import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

// تعریف نوع کل Config
interface AppConfig {
  redis: RedisConfig;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private configService: ConfigService<AppConfig>) {
    const redisConfig = this.configService.get('redis', { infer: true });

    if (!redisConfig) {
      throw new Error('Redis configuration is missing');
    }

    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: 0,
    });
  }
  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    const parsed: unknown = value ? JSON.parse(value) : null;
    return parsed as T;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }
  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
