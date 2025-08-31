import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateChatDto } from './dto/create-chat.dto';
import { StartChatByEmailDto } from './dto/start-chat-by-email.dto';
import { ObjectId } from 'mongodb';
import { ChatGateway } from './chat-gateway';
import { AuthService } from 'src/auth/auth.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly authService: AuthService,
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
    }

    return result;
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
    const currentUserId = new ObjectId(req.user._id);
    const { recipientEmail, initialMessage } = startChatDto;

    // Check if trying to start chat with themselves
    if (recipientEmail.toLowerCase() === req.user.email.toLowerCase()) {
      throw new BadRequestException('Cannot start a chat with yourself');
    }

    // Find the recipient user by email
    const recipientUser =
      await this.authService.findUserByEmail(recipientEmail);

    if (!recipientUser) {
      throw new NotFoundException('User with this email does not exist');
    }

    const recipientUserId = new ObjectId(recipientUser._id);

    // Find or create private chat
    const chat = await this.chatService.findOrCreatePrivateChat(
      currentUserId,
      recipientUserId,
    );

    // If there's an initial message, send it
    if (initialMessage && initialMessage.trim()) {
      const messageResult = await this.chatService.sendMessage(
        chat._id,
        currentUserId,
        initialMessage.trim(),
      );

      if (messageResult.acknowledged) {
        const messageToSend = {
          _id: messageResult.insertedId.toString(),
          chatId: chat._id.toString(),
          senderId: currentUserId.toString(),
          senderEmail: req.user.email,
          content: initialMessage.trim(),
          createdAt: new Date(),
        };

        // Send message to both users if they're connected via WebSocket
        this.chatGateway.server
          .to(chat._id.toString())
          .emit('message', messageToSend);

        // Send chat update to recipient
        const chatUpdate = {
          chatId: chat._id.toString(),
          lastMessage: {
            content: initialMessage.trim(),
            senderEmail: req.user.email,
            senderId: currentUserId.toString(),
            createdAt: new Date(),
          },
          updatedAt: new Date(),
        };

        this.chatGateway.server
          .to(`user_${recipientUserId.toString()}`)
          .emit('chatUpdated', chatUpdate);
      }
    }

    // Notify both users about the new/found chat
    this.chatGateway.server
      .to(`user_${currentUserId.toString()}`)
      .emit('chatCreated', chat);

    this.chatGateway.server
      .to(`user_${recipientUserId.toString()}`)
      .emit('chatCreated', chat);

    return {
      success: true,
      chat: {
        _id: chat._id.toString(),
        type: chat.type,
        participants: chat.participants.map((p) => p.toString()),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      message: 'Chat started successfully',
    };
  }

  // todo: add chats participants management
}
