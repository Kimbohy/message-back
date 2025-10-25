import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { AuthenticatedSocket } from '../interfaces/socket.interface';
import { ChatService } from '../chat.service';
import { AuthService } from 'src/auth';
import { StartChatByEmailDto } from '../dto/start-chat-by-email.dto';
import { SOCKET_EVENTS, CHAT_ERRORS } from '../constants';

/**
 * ChatCreationHandler
 * Handles creating new chats and finding existing ones
 */
@Injectable()
export class ChatCreationHandler {
  private readonly logger = new Logger(ChatCreationHandler.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Handle starting a chat by email
   */
  async handleStartChatByEmail(
    client: AuthenticatedSocket,
    payload: StartChatByEmailDto,
    server: Server,
  ): Promise<void> {
    try {
      const currentUserId = new ObjectId(client.userId);
      const { recipientEmail, initialMessage } = payload;

      // Validate user email
      if (!client.userEmail) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: CHAT_ERRORS.AUTHENTICATION_ERROR,
        });
        return;
      }

      // Check if trying to start chat with themselves
      if (recipientEmail.toLowerCase() === client.userEmail.toLowerCase()) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: CHAT_ERRORS.CANNOT_CHAT_WITH_SELF,
        });
        return;
      }

      // Find the recipient user
      const recipientUser =
        await this.authService.findUserByEmail(recipientEmail);
      if (!recipientUser) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: CHAT_ERRORS.USER_NOT_FOUND,
        });
        return;
      }

      const recipientUserId = new ObjectId(recipientUser._id);

      // Find or create private chat
      const chat = await this.chatService.findOrCreatePrivateChat(
        currentUserId,
        recipientUserId,
      );

      // Send initial message if provided
      if (initialMessage && initialMessage.trim()) {
        await this.sendInitialMessage(
          server,
          chat._id,
          currentUserId,
          recipientUserId,
          client.userEmail,
          initialMessage.trim(),
        );
      }

      // Notify both users about the chat
      client.emit(SOCKET_EVENTS.CHAT_CREATED, chat);
      server
        .to(`user_${recipientUserId.toString()}`)
        .emit(SOCKET_EVENTS.CHAT_CREATED, chat);

      this.logger.log(
        `Chat started between ${client.userEmail} and ${recipientEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Error starting chat by email: ${error.message}`,
        error.stack,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: CHAT_ERRORS.FAILED_TO_START_CHAT,
      });
    }
  }

  /**
   * Send initial message when creating a chat
   */
  private async sendInitialMessage(
    server: Server,
    chatId: ObjectId,
    senderId: ObjectId,
    recipientId: ObjectId,
    senderEmail: string,
    content: string,
  ): Promise<void> {
    try {
      const messageResult = await this.chatService.sendMessage(
        chatId,
        senderId,
        content,
      );

      if (messageResult.acknowledged) {
        const messageToSend = {
          _id: messageResult.insertedId.toString(),
          chatId: chatId.toString(),
          senderId: senderId.toString(),
          senderEmail,
          content,
          createdAt: new Date(),
        };

        // Send message to chat room
        server.to(chatId.toString()).emit(SOCKET_EVENTS.MESSAGE, messageToSend);

        // Send chat update to recipient
        const chatUpdate = {
          chatId: chatId.toString(),
          lastMessage: {
            content,
            senderEmail,
            senderId: senderId.toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        };

        server
          .to(`user_${recipientId.toString()}`)
          .emit(SOCKET_EVENTS.CHAT_UPDATED, chatUpdate);
      }
    } catch (error) {
      this.logger.error(
        `Error sending initial message: ${error.message}`,
        error.stack,
      );
    }
  }
}
