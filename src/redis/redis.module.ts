import { Module } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { RedisCacheService } from '../common/services/redis-cache.service';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        const client: RedisClientType = createClient({
          url: 'redis://localhost:6379',
        });
        await client.connect();
        return client;
      },
    },
    RedisCacheService,
  ],
  exports: ['REDIS_CLIENT', RedisCacheService],
})
export class RedisModule {}
