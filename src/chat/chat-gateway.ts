import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { AuthenticatedSocket } from './interfaces/socket.interface';
import { SendMessageDto } from './dto/send-message.dto';
import { JoinChatDto } from './dto/join-chat.dto';
import { LeaveChatDto } from './dto/leave-chat.dto';
import { StartChatByEmailDto } from './dto/start-chat-by-email.dto';
import { SOCKET_EVENTS } from './constants';
import {
  ChatListHandler,
  ChatRoomHandler,
  MessageHandler,
  ChatCreationHandler,
} from './handlers';

/**
 * ChatGateway
 * Main WebSocket gateway - handles connections and delegates events to handlers
 * Follows single responsibility principle by delegating business logic to handlers
 */
@WebSocketGateway(3002, { cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatListHandler: ChatListHandler,
    private readonly chatRoomHandler: ChatRoomHandler,
    private readonly messageHandler: MessageHandler,
    private readonly chatCreationHandler: ChatCreationHandler,
  ) {}

  /**
   * Handle new WebSocket connection
   * Authenticates user via JWT and joins them to their personal room
   */
  handleConnection(client: AuthenticatedSocket): void {
    try {
      const token = client.handshake.headers.authorization?.replace(
        'Bearer ',
        '',
      );

      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Set authenticated user data on socket
      client.userId = userId;
      client.userEmail = payload.email;

      // Join personal room for notifications
      client.join(`user_${userId}`);

      this.logger.log(`User connected: ${userId}, Email: ${client.userEmail}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(`User disconnected: ${client.id}`);
  }

  // ==================== Event Handlers ====================
  // All business logic is delegated to specific handlers

  @SubscribeMessage(SOCKET_EVENTS.GET_CHAT_LIST)
  async handleGetChatList(client: AuthenticatedSocket): Promise<void> {
    return this.chatListHandler.handleGetChatList(client);
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_CHAT)
  async handleJoinChat(
    client: AuthenticatedSocket,
    payload: JoinChatDto,
  ): Promise<void> {
    return this.chatRoomHandler.handleJoinChat(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_CHAT)
  async handleLeaveChat(
    client: AuthenticatedSocket,
    payload: LeaveChatDto,
  ): Promise<void> {
    return this.chatRoomHandler.handleLeaveChat(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    client: AuthenticatedSocket,
    payload: SendMessageDto,
  ): Promise<void> {
    return this.messageHandler.handleSendMessage(client, payload, this.server);
  }

  @SubscribeMessage(SOCKET_EVENTS.START_CHAT_BY_EMAIL)
  async handleStartChatByEmail(
    client: AuthenticatedSocket,
    payload: StartChatByEmailDto,
  ): Promise<void> {
    return this.chatCreationHandler.handleStartChatByEmail(
      client,
      payload,
      this.server,
    );
  }
}
