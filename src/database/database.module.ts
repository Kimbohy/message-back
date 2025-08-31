import { Global, Module } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import { AppConfigModule, AppConfigService } from '../config';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: 'MONGO_DB',
      useFactory: async (configService: AppConfigService): Promise<Db> => {
        const client = new MongoClient(configService.mongoUri);
        await client.connect();
        return client.db();
      },
      inject: [AppConfigService],
    },
  ],
  exports: ['MONGO_DB'],
})
export class DatabaseModule {}
