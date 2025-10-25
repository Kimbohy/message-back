import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth';
import { RedisModule } from 'src/redis/redis.module';
import { ChatGateway } from './chat-gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatRepository, MessageRepository } from './repositories';
import {
  ChatListHandler,
  ChatRoomHandler,
  MessageHandler,
  ChatCreationHandler,
} from './handlers';

/**
 * ChatModule
 * Organizes all chat-related components with clear separation of concerns
 */
@Module({
  imports: [AuthModule, RedisModule],
  providers: [
    // Gateway
    ChatGateway,

    // Service (business logic)
    ChatService,

    // Repositories (data access)
    ChatRepository,
    MessageRepository,

    // Event Handlers
    ChatListHandler,
    ChatRoomHandler,
    MessageHandler,
    ChatCreationHandler,
  ],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
