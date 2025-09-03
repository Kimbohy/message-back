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
import { StartChatByEmailDto } from './dto/start-chat-by-email.dto';
import { ObjectId } from 'mongodb';
import { AuthService } from 'src/auth/auth.service';
import { Inject, forwardRef } from '@nestjs/common';

@WebSocketGateway(3002, { cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly JwtService: JwtService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
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
      await this.chatService.setChatSeen(chatId, userId);
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

  @SubscribeMessage('startChatByEmail')
  async handleStartChatByEmail(
    client: AuthenticatedSocket,
    payload: StartChatByEmailDto,
  ) {
    try {
      const currentUserId = new ObjectId(client.userId);
      const { recipientEmail, initialMessage } = payload;

      // Check if user email is available
      if (!client.userEmail) {
        client.emit('error', {
          message: 'User authentication error',
        });
        return;
      }

      // Check if trying to start chat with themselves
      if (recipientEmail.toLowerCase() === client.userEmail.toLowerCase()) {
        client.emit('error', {
          message: 'Cannot start a chat with yourself',
        });
        return;
      }

      // Find the recipient user by email
      const recipientUser =
        await this.authService.findUserByEmail(recipientEmail);

      if (!recipientUser) {
        client.emit('error', {
          message: 'User with this email does not exist',
        });
        return;
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
            senderEmail: client.userEmail,
            content: initialMessage.trim(),
            createdAt: new Date(),
          };

          // Send message to chat room
          this.server.to(chat._id.toString()).emit('message', messageToSend);

          // Send chat update to recipient
          const chatUpdate = {
            chatId: chat._id.toString(),
            lastMessage: {
              content: initialMessage.trim(),
              senderEmail: client.userEmail,
              senderId: currentUserId.toString(),
              createdAt: new Date(),
            },
            updatedAt: new Date(),
          };

          this.server
            .to(`user_${recipientUserId.toString()}`)
            .emit('chatUpdated', chatUpdate);
        }
      }

      // Notify both users about the new/found chat
      client.emit('chatStarted', {
        success: true,
        chat: {
          _id: chat._id.toString(),
          type: chat.type,
          participants: chat.participants.map((p) => p.toString()),
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });

      this.server
        .to(`user_${recipientUserId.toString()}`)
        .emit('chatCreated', chat);

      console.log(
        `Chat started between ${client.userEmail} and ${recipientEmail}`,
      );
    } catch (error) {
      console.error('Error starting chat by email:', error);
      client.emit('error', {
        message: 'Failed to start chat',
      });
    }
  }
}
