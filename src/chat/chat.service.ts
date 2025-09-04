import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Chat, ChatModel, ChatType } from 'src/interfaces/chat.interface';
import { Message } from 'src/interfaces/message.interface';
import { CreateChatDto } from './dto/create-chat.dto';
import { StartChatByEmailDto } from './dto/start-chat-by-email.dto';
import { AuthService } from 'src/auth';
import { ChatGateway } from './chat-gateway';
import {
  CacheWithRedis,
  InvalidateChatCache,
} from 'src/common/decorators/cache.decorator';
import { RedisCacheService } from 'src/common/services/redis-cache.service';

@Injectable()
// todo: implement DTO validation
export class ChatService {
  private redisCache: RedisCacheService;

  constructor(
    @Inject('MONGO_DB') private readonly db: Db,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    redisCacheService: RedisCacheService,
  ) {
    this.redisCache = redisCacheService;
  }

  createChat(createChatDto: CreateChatDto) {
    const { participants, type, name } = createChatDto;
    const chat: ChatModel = {
      _id: new ObjectId(),
      type,
      participants,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.db.collection<ChatModel>('chats').insertOne(chat);
  }

  @CacheWithRedis((userId: ObjectId) => `chats:${userId}`, 300)
  async getChatsForUser(userId: ObjectId) {
    // await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay
    const data = this.db
      .collection<ChatModel>('chats')
      .aggregate([
        { $match: { participants: userId } },
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participants',
          },
        },
        // Populate the lastMessage object (if present), and populate its sender
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMessage',
          },
        },
        { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
        // Remove password fields from joined user documents (participants and lastMessage.sender)
        {
          $project: {
            'participants.password': 0,
            'lastMessage.chatId': 0,
          },
        },
      ])
      .toArray();
    return data as Promise<Chat[]>;
  }

  @CacheWithRedis((chatId: ObjectId) => `chat:${chatId}`, 300)
  async getChatById(chatId: ObjectId): Promise<Chat | null> {
    const result = await this.db
      .collection<ChatModel>('chats')
      .aggregate([
        { $match: { _id: chatId } },
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participants',
          },
        },
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMessage',
          },
        },
        { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            'participants.password': 0,
            'lastMessage.chatId': 0,
          },
        },
      ])
      .next();
    return result as Chat | null;
  }

  @InvalidateChatCache()
  async sendMessage(chatId: ObjectId, senderId: ObjectId, content: string) {
    const chatExists = await this.checkChatExists(chatId);
    if (!chatExists) {
      throw new Error('Chat does not exist');
    }

    const message: Message = {
      _id: new ObjectId(),
      chatId,
      senderId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      seenBy: [senderId],
    };
    const result = await this.db.collection('messages').insertOne(message);
    if (result.acknowledged) {
      this.db
        .collection<ChatModel>('chats')
        .updateOne(
          { _id: chatId },
          { $set: { updatedAt: new Date(), lastMessage: message._id } },
        );
    }
    return result;
  }

  getMessagesForChat(chatId: ObjectId) {
    return this.db.collection<Message>('messages').find({ chatId }).toArray();
  }

  addUserToChat(chatId: ObjectId, userId: ObjectId) {
    return this.db
      .collection<ChatModel>('chats')
      .updateOne({ _id: chatId }, { $addToSet: { participants: userId } });
  }

  removeUserFromChat(chatId: ObjectId, userId: ObjectId) {
    return this.db
      .collection<ChatModel>('chats')
      .updateOne({ _id: chatId }, { $pull: { participants: userId } });
  }

  @InvalidateChatCache()
  async setChatSeen(chatId: ObjectId, userId: ObjectId) {
    const isInChat = await this.checkUserInChat(chatId, userId);
    if (!isInChat) throw new BadRequestException('User not in chat');

    return this.db.collection<Message>('messages').updateMany(
      { chatId, seenBy: { $ne: userId } }, // Update all unseen messages in the chat
      { $addToSet: { seenBy: userId } }, // Add userId to seenBy array
    );
  }

  checkUserInChat(chatId: ObjectId, userId: ObjectId): Promise<boolean> {
    return this.db
      .collection<ChatModel>('chats')
      .findOne({ _id: chatId, participants: userId })
      .then((chat) => !!chat);
  }

  checkChatExists(chatId: ObjectId): Promise<boolean> {
    return this.db
      .collection<Chat>('chats')
      .findOne({ _id: chatId })
      .then((chat) => !!chat);
  }

  async startByEmail(req: any, startChatDto: StartChatByEmailDto) {
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
    let chat = await this.findOrCreatePrivateChat(
      currentUserId,
      recipientUserId,
    );

    // If there's an initial message, send it
    if (initialMessage && initialMessage.trim()) {
      const messageResult = await this.sendMessage(
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
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        };

        this.chatGateway.server
          .to(`user_${recipientUserId.toString()}`)
          .emit('chatUpdated', chatUpdate);
      }

      // Refetch chat to get updated lastMessage
      const updatedChat = await this.getChatById(chat._id);
      if (updatedChat) {
        chat = updatedChat;
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
      chat: chat,
      message: 'Chat started successfully',
    };
  }

  async findOrCreatePrivateChat(
    user1Id: ObjectId,
    user2Id: ObjectId,
  ): Promise<Chat> {
    // Check if a private chat already exists between these users
    const existingChat = await this.db
      .collection<ChatModel>('chats')
      .aggregate([
        {
          $match: {
            type: ChatType.PRIVATE,
            participants: { $all: [user1Id, user2Id], $size: 2 },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participants',
          },
        },
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMessage',
          },
        },
        { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            'participants.password': 0,
            'lastMessage.chatId': 0,
          },
        },
      ])
      .next();

    if (existingChat) {
      return existingChat as Chat;
    }

    // Create new private chat
    const chat: ChatModel = {
      _id: new ObjectId(),
      type: ChatType.PRIVATE,
      participants: [user1Id, user2Id],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.collection<ChatModel>('chats').insertOne(chat);

    if (result.acknowledged) {
      // Fetch the newly created chat with populated participants
      const populatedChat = await this.db
        .collection<ChatModel>('chats')
        .aggregate([
          { $match: { _id: chat._id } },
          {
            $lookup: {
              from: 'users',
              localField: 'participants',
              foreignField: '_id',
              as: 'participants',
            },
          },
          {
            $lookup: {
              from: 'messages',
              localField: 'lastMessage',
              foreignField: '_id',
              as: 'lastMessage',
            },
          },
          {
            $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true },
          },
          {
            $project: {
              'participants.password': 0,
              'lastMessage.chatId': 0,
            },
          },
        ])
        .next();
      return populatedChat as Chat;
    }

    throw new Error('Failed to create chat');
  }

  async getChatMembers(chatId: ObjectId): Promise<ObjectId[]> {
    const chat = await this.db
      .collection<ChatModel>('chats')
      .findOne({ _id: chatId });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    return chat.participants;
  }
}
