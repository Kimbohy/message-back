import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat-gateway';
import { AuthModule } from 'src/auth';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [ChatGateway, ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
