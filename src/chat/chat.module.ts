import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat-gateway';
import { AuthModule } from 'src/auth';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [forwardRef(() => AuthModule), RedisModule],
  providers: [ChatGateway, ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
