import { Global, Module } from '@nestjs/common';
import { RedisService } from './providers/redis.service';
import { RedisLockService } from './providers/redis-lock.service';
import { ConfigModule } from '@nestjs/config';
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, RedisLockService],
  exports: [RedisService, RedisLockService],
})
export class RedisModule {}
