import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateChatDto } from './dto/create-chat.dto';
import { ObjectId } from 'mongodb';

/**
 * ChatController
 * HTTP REST endpoints for chat operations
 * WebSocket operations are handled by ChatGateway
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Get all chats for authenticated user
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getChats(@Request() req: any) {
    const userId = new ObjectId(req.user._id);
    return this.chatService.getChatsForUser(userId);
  }

  /**
   * Create a new chat (group chat)
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createChat(@Request() req: any, @Body() createChatDto: CreateChatDto) {
    const userId = new ObjectId(req.user._id);
    const participantIds = createChatDto.participants.map(
      (p) => new ObjectId(p),
    );
    const participants = new Set([...participantIds, userId]);

    return this.chatService.createChatWithNotification({
      ...createChatDto,
      participants: Array.from(participants),
    });
  }

  /**
   * Get all messages for a specific chat
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  async getMessages(@Param('id') chatId: string, @Request() req: any) {
    const objectId = new ObjectId(chatId);
    const userId = new ObjectId(req.user._id);

    // Verify user is in the chat
    const isInChat = await this.chatService.checkUserInChat(objectId, userId);
    if (!isInChat) {
      throw new Error('You are not a participant in this chat');
    }

    return this.chatService.getMessagesForChat(objectId);
  }
}
