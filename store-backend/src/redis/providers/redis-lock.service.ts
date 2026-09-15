import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(private readonly redisService: RedisService) {}

  async acquireLock(
    key: string,
    ttl: number = 10000,
    retries: number = 3,
    retryDelay: number = 100,
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const client = this.redisService.getClient();

    for (let i = 0; i < retries; i++) {
      const result = await client.set(key, lockValue, 'PX', ttl, 'NX');

      if (result === 'OK') {
        this.logger.debug(`Lock acquired: ${key}`);
        return lockValue;
      }

      if (i < retries - 1) {
        await this.sleep(retryDelay * (i + 1));
      }
    }

    this.logger.warn(`Failed to acquire lock: ${key}`);
    return null;
  }

  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const client = this.redisService.getClient();

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await client.eval(script, 1, key, lockValue);

    if (result === 1) {
      this.logger.debug(`Lock released: ${key}`);
      return true;
    }

    return false;
  }

  async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = 10000,
  ): Promise<T> {
    const lockValue = await this.acquireLock(key, ttl);

    if (!lockValue) {
      throw new Error(`Could not acquire lock: ${key}`);
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(key, lockValue);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
/*
قفل در بلاک try گرفته می‌شه
اگه هر خطایی رخ بده (اتاق پیدا نشد، اتاق available نیست، خطای دیتابیس، …)
بلاک finally اجرا می‌شه و قفل release می‌شه

*/
