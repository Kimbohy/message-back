import { Global, Module } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27018/whatsapp_db';
const client = new MongoClient(uri);
@Global()
@Module({
  providers: [
    {
      provide: 'MONGO_DB',
      useFactory: async (): Promise<Db> => {
        await client.connect();
        return client.db();
      },
    },
  ],
  exports: ['MONGO_DB'],
})
export class DatabaseModule {}
