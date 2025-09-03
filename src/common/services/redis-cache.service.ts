import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisCacheService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set<T>(key: string, value: T, ttl: number = 60 * 30): Promise<void> {
    const stringValue = JSON.stringify(value);
    await this.redisClient.setEx(key, ttl, stringValue);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}
