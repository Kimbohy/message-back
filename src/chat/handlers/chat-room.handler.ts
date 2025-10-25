import { Injectable, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AuthenticatedSocket } from '../interfaces/socket.interface';
import { ChatService } from '../chat.service';
import { JoinChatDto } from '../dto/join-chat.dto';
import { LeaveChatDto } from '../dto/leave-chat.dto';
import { SOCKET_EVENTS, CHAT_ERRORS } from '../constants';

/**
 * ChatRoomHandler
 * Handles joining and leaving chat rooms
 */
@Injectable()
export class ChatRoomHandler {
  private readonly logger = new Logger(ChatRoomHandler.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Handle user joining a chat room
   */
  async handleJoinChat(
    client: AuthenticatedSocket,
    payload: JoinChatDto,
  ): Promise<void> {
    try {
      const userId = new ObjectId(client.userId);
      const chatId = new ObjectId(payload.chatId);

      // Verify user is in the chat
      const isInChat = await this.chatService.checkUserInChat(chatId, userId);
      if (!isInChat) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: CHAT_ERRORS.NOT_IN_CHAT,
        });
        return;
      }

      // Join the socket room
      client.join(chatId.toString());

      // Mark messages as seen
      await this.chatService.setChatSeen(chatId, userId);

      this.logger.log(`User ${userId} joined chat room: ${chatId}`);
      client.emit(SOCKET_EVENTS.CHAT_JOINED, { chatId: chatId.toString() });
    } catch (error) {
      this.logger.error(`Error joining chat: ${error.message}`, error.stack);
      client.emit(SOCKET_EVENTS.ERROR, {
        message: CHAT_ERRORS.FAILED_TO_JOIN_CHAT,
      });
    }
  }

  /**
   * Handle user leaving a chat room
   */
  async handleLeaveChat(
    client: AuthenticatedSocket,
    payload: LeaveChatDto,
  ): Promise<void> {
    try {
      const { chatId } = payload;
      client.leave(chatId);

      this.logger.log(`User ${client.userId} left chat room: ${chatId}`);
      client.emit(SOCKET_EVENTS.CHAT_LEFT, { chatId });
    } catch (error) {
      this.logger.error(`Error leaving chat: ${error.message}`, error.stack);
    }
  }
}
