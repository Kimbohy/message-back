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
import { StartChatByEmailDto } from './dto/start-chat-by-email.dto';
import { ObjectId } from 'mongodb';
import { ChatGateway } from './chat-gateway';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getChats(@Request() req: any) {
    const userId = req.user._id;
    return this.chatService.getChatsForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createChat(@Request() req: any, @Body() createChatDto: CreateChatDto) {
    const userId = req.user._id;
    const participants = new Set([...createChatDto.participants, userId]);

    const result = await this.chatService.createChat({
      ...createChatDto,
      participants: Array.from(participants),
    });

    if (result.acknowledged) {
      // Get the created chat with all details
      const newChat = await this.chatService.getChatById(result.insertedId);

      if (newChat) {
        // Notify all participants of the new chat
        newChat.participants.forEach((participantId) => {
          this.chatGateway.server
            .to(`user_${participantId.toString()}`)
            .emit('chatCreated', newChat);
        });
      }

      return newChat;
    }

    throw new Error('Failed to create chat');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  async getMessages(@Param('id') chatId: string) {
    const objectId = new ObjectId(chatId);
    return this.chatService.getMessagesForChat(objectId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('start-by-email')
  async startChatByEmail(
    @Request() req: any,
    @Body() startChatDto: StartChatByEmailDto,
  ) {
    return this.chatService.startByEmail(req, startChatDto);
  }

  // todo: add chats participants management
}
