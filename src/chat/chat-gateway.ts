import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedSocket } from './interfaces/socket.interface';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JoinChatDto } from './dto/join-chat.dto';
import { LeaveChatDto } from './dto/leave-chat.dto';
import { ObjectId } from 'mongodb';

@WebSocketGateway(3002, { cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly JwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}
  @WebSocketServer() server: Server;

  handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.headers.authorization?.replace(
        'Bearer ',
        '',
      );

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.JwtService.verify(token);
      console.log(payload.sub);

      const userId = payload.sub;

      client.userId = userId;
      client.userEmail = payload.email;

      // Join personal room for notifications
      client.join(`user_${userId}`);

      console.log(`User connected: ${userId}, Email: ${client.userEmail}`);
    } catch (error) {
      console.error('Error occurred during WebSocket connection:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    console.log('User disconnected ', client.id);
  }

  // Send complete chat list on connection
  @SubscribeMessage('getChatList')
  async handleGetChatList(client: AuthenticatedSocket) {
    try {
      const userId = new ObjectId(client.userId);
      const chats = await this.chatService.getChatsForUser(userId);

      client.emit('chatListInitial', chats);
      console.log(`Chat list sent to user: ${userId}`);
    } catch (error) {
      console.error('Error getting chat list:', error);
      client.emit('error', { message: 'Failed to get chat list' });
    }
  }

  // Join specific chat to receive real-time messages
  @SubscribeMessage('joinChat')
  async handleJoinChat(client: AuthenticatedSocket, payload: JoinChatDto) {
    try {
      const userId = new ObjectId(client.userId);
      const chatId = new ObjectId(payload.chatId);

      if (!(await this.chatService.checkUserInChat(chatId, userId))) {
        client.emit('error', {
          message: 'You are not a participant in this chat',
        });
        return;
      }

      client.join(chatId.toString());
      console.log(`User ${userId} joined chat room: ${chatId}`);

      client.emit('chatJoined', { chatId: chatId.toString() });
    } catch (error) {
      console.error('Error joining chat:', error);
      client.emit('error', { message: 'Failed to join chat' });
    }
  }

  // Leave specific chat
  @SubscribeMessage('leaveChat')
  async handleLeaveChat(client: AuthenticatedSocket, payload: LeaveChatDto) {
    try {
      const chatId = payload.chatId;
      client.leave(chatId);
      console.log(`User ${client.userId} left chat room: ${chatId}`);

      client.emit('chatLeft', { chatId });
    } catch (error) {
      console.error('Error leaving chat:', error);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleNewMessage(client: AuthenticatedSocket, payload: SendMessageDto) {
    try {
      const senderId = new ObjectId(client.userId);
      const chatId = new ObjectId(payload.chatId);

      if (!(await this.chatService.checkUserInChat(chatId, senderId))) {
        client.emit('error', {
          message: 'You are not a participant in this chat',
        });
        return;
      }

      const result = await this.chatService.sendMessage(
        chatId,
        senderId,
        payload.content,
      );

      if (result.acknowledged) {
        const messageToSend = {
          _id: result.insertedId.toString(),
          chatId: chatId.toString(),
          senderId: senderId.toString(),
          senderEmail: client.userEmail,
          content: payload.content,
          createdAt: new Date(),
        };

        // Send complete message to users in the room (opened chat)
        this.server.to(chatId.toString()).emit('message', messageToSend);

        // Send lightweight update to other participants (closed chats)
        const chatUpdate = {
          chatId: chatId.toString(),
          lastMessage: {
            content: payload.content,
            senderEmail: client.userEmail,
            senderId: senderId.toString(),
            createdAt: new Date(),
          },
          updatedAt: new Date(),
        };

        // Get chat participants
        const chat = await this.chatService.getChatById(chatId);
        if (chat) {
          chat.participants.forEach((participantId) => {
            // Don't send to sender
            if (!participantId.equals(senderId)) {
              this.server
                .to(`user_${participantId.toString()}`)
                .emit('chatUpdated', chatUpdate);
            }
          });
        }

        console.log(`Message sent to chat ${chatId} by user ${senderId}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('error', {
        message: 'Failed to send message',
      });
    }
  }
}
