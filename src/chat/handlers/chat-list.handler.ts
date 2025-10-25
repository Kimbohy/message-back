import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { AuthenticatedSocket } from '../interfaces/socket.interface';
import { ChatService } from '../chat.service';
import { SOCKET_EVENTS, CHAT_ERRORS } from '../constants';

/**
 * ChatListHandler
 * Handles chat list related WebSocket events
 */
@Injectable()
export class ChatListHandler {
  private readonly logger = new Logger(ChatListHandler.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Handle getting the chat list for a user
   */
  async handleGetChatList(client: AuthenticatedSocket): Promise<void> {
    try {
      const userId = new ObjectId(client.userId);
      const chats = await this.chatService.getChatsForUser(userId);

      client.emit(SOCKET_EVENTS.CHAT_LIST_INITIAL, chats);
      this.logger.log(`Chat list sent to user: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error getting chat list: ${error.message}`,
        error.stack,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: CHAT_ERRORS.FAILED_TO_GET_CHAT_LIST,
      });
    }
  }
}
