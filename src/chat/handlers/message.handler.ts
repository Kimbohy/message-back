import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { AuthenticatedSocket } from '../interfaces/socket.interface';
import { ChatService } from '../chat.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { SOCKET_EVENTS, CHAT_ERRORS } from '../constants';

/**
 * MessageHandler
 * Handles message sending and broadcasting
 */
@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Handle sending a new message
   */
  async handleSendMessage(
    client: AuthenticatedSocket,
    payload: SendMessageDto,
    server: Server,
  ): Promise<void> {
    try {
      const senderId = new ObjectId(client.userId);
      const chatId = new ObjectId(payload.chatId);

      // Verify user is in the chat
      const isInChat = await this.chatService.checkUserInChat(chatId, senderId);
      if (!isInChat) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: CHAT_ERRORS.NOT_IN_CHAT,
        });
        return;
      }

      // Send the message
      const result = await this.chatService.sendMessage(
        chatId,
        senderId,
        payload.content,
      );

      if (result.acknowledged) {
        // Prepare message object
        const messageToSend = {
          _id: result.insertedId.toString(),
          chatId: chatId.toString(),
          senderId: senderId.toString(),
          senderEmail: client.userEmail,
          content: payload.content,
          createdAt: new Date(),
        };

        // Broadcast to users in the chat room
        server.to(chatId.toString()).emit(SOCKET_EVENTS.MESSAGE, messageToSend);

        // Notify other participants (who aren't in the room)
        await this.notifyOtherParticipants(
          server,
          chatId,
          senderId,
          client.userEmail || '',
          payload.content,
        );

        this.logger.log(`Message sent to chat ${chatId} by user ${senderId}`);
      }
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      client.emit(SOCKET_EVENTS.ERROR, {
        message: CHAT_ERRORS.FAILED_TO_SEND_MESSAGE,
      });
    }
  }

  /**
   * Notify participants who are not currently in the chat room
   */
  private async notifyOtherParticipants(
    server: Server,
    chatId: ObjectId,
    senderId: ObjectId,
    senderEmail: string,
    content: string,
  ): Promise<void> {
    try {
      const chat = await this.chatService.getChatById(chatId);
      if (!chat) return;

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

      // Send update to each participant except the sender
      chat.participants.forEach((participant) => {
        if (
          participant._id &&
          participant._id.toString() !== senderId.toString()
        ) {
          server
            .to(`user_${participant._id.toString()}`)
            .emit(SOCKET_EVENTS.CHAT_UPDATED, chatUpdate);
        }
      });
    } catch (error) {
      this.logger.error(
        `Error notifying participants: ${error.message}`,
        error.stack,
      );
    }
  }
}
