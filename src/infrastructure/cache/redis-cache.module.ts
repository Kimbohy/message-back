import { Global, Module } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { RedisCacheService } from './redis-cache.service';
import { AppConfigService } from '../config';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: AppConfigService) => {
        const client: RedisClientType = createClient({
          socket: {
            host: configService.redisHost,
            port: configService.redisPort,
          },
        });
        await client.connect();
        return client;
      },
      inject: [AppConfigService],
    },
    RedisCacheService,
  ],
  exports: ['REDIS_CLIENT', RedisCacheService],
})
export class RedisCacheModule {}
