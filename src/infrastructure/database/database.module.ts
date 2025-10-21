import { Global, Module } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import { AppConfigService } from '../config';
import { UserRepository } from './repositories/user.repository';
import { ChatRepository } from './repositories/chat.repository';
import { MessageRepository } from './repositories/message.repository';

@Global()
@Module({
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
    UserRepository,
    ChatRepository,
    MessageRepository,
  ],
  exports: ['MONGO_DB', UserRepository, ChatRepository, MessageRepository],
})
export class DatabaseModule {}
