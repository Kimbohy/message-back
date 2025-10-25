import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { Chat, ChatModel, ChatType } from 'src/interfaces/chat.interface';
import { Message } from 'src/interfaces/message.interface';
import { CreateChatDto } from './dto/create-chat.dto';
import {
  CacheWithRedis,
  InvalidateChatCache,
} from 'src/common/decorators/cache.decorator';
import { RedisCacheService } from 'src/common/services/redis-cache.service';
import { ChatRepository, MessageRepository } from './repositories';
import { CHAT_ERRORS } from './constants';

/**
 * ChatService
 * Business logic layer for chat operations
 * Uses repositories for data access and maintains cache
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly messageRepository: MessageRepository,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Create a new chat
   */
  async createChat(createChatDto: CreateChatDto) {
    const { participants, type, name } = createChatDto;
    const chat: ChatModel = {
      _id: new ObjectId(),
      type,
      participants,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.chatRepository.create(chat);
  }

  /**
   * Get all chats for a user (cached)
   */
  @CacheWithRedis((userId: ObjectId) => `chats:${userId}`, 300)
  async getChatsForUser(userId: ObjectId): Promise<Chat[]> {
    try {
      return await this.chatRepository.findByUserId(userId);
    } catch (error) {
      this.logger.error(
        `Error getting chats for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException(CHAT_ERRORS.FAILED_TO_GET_CHAT_LIST);
    }
  }

  /**
   * Get chat by ID with populated data (cached)
   */
  @CacheWithRedis((chatId: ObjectId) => `chat:${chatId}`, 300)
  async getChatById(chatId: ObjectId): Promise<Chat | null> {
    try {
      return await this.chatRepository.findById(chatId);
    } catch (error) {
      this.logger.error(`Error getting chat ${chatId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Send a message in a chat
   */
  @InvalidateChatCache()
  async sendMessage(chatId: ObjectId, senderId: ObjectId, content: string) {
    // Verify chat exists
    const chatExists = await this.chatRepository.exists(chatId);
    if (!chatExists) {
      throw new NotFoundException(CHAT_ERRORS.CHAT_NOT_EXIST);
    }

    // Create message
    const message: Message = {
      _id: new ObjectId(),
      chatId,
      senderId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      seenBy: [senderId],
    };

    try {
      const result = await this.messageRepository.create(message);

      if (result.acknowledged) {
        // Update chat's last message
        await this.chatRepository.updateLastMessage(chatId, message._id);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw new BadRequestException(CHAT_ERRORS.FAILED_TO_SEND_MESSAGE);
    }
  }

  /**
   * Get all messages for a chat
   */
  async getMessagesForChat(chatId: ObjectId): Promise<Message[]> {
    try {
      return await this.messageRepository.findByChatId(chatId);
    } catch (error) {
      this.logger.error(
        `Error getting messages for chat ${chatId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to get messages');
    }
  }

  /**
   * Mark chat as seen by user
   */
  @InvalidateChatCache()
  async setChatSeen(chatId: ObjectId, userId: ObjectId) {
    const isInChat = await this.chatRepository.isUserInChat(chatId, userId);
    if (!isInChat) {
      throw new BadRequestException(CHAT_ERRORS.USER_NOT_IN_CHAT);
    }

    try {
      return await this.messageRepository.markAsSeen(chatId, userId);
    } catch (error) {
      this.logger.error(`Error marking chat as seen: ${error.message}`);
      throw new BadRequestException('Failed to mark chat as seen');
    }
  }

  /**
   * Check if user is in a chat
   */
  async checkUserInChat(chatId: ObjectId, userId: ObjectId): Promise<boolean> {
    return this.chatRepository.isUserInChat(chatId, userId);
  }

  /**
   * Check if chat exists
   */
  async checkChatExists(chatId: ObjectId): Promise<boolean> {
    return this.chatRepository.exists(chatId);
  }

  /**
   * Add user to chat
   */
  async addUserToChat(chatId: ObjectId, userId: ObjectId) {
    return this.chatRepository.addParticipant(chatId, userId);
  }

  /**
   * Remove user from chat
   */
  async removeUserFromChat(chatId: ObjectId, userId: ObjectId) {
    return this.chatRepository.removeParticipant(chatId, userId);
  }

  /**
   * Get chat members
   */
  async getChatMembers(chatId: ObjectId): Promise<ObjectId[]> {
    const participants = await this.chatRepository.getParticipants(chatId);
    if (!participants || participants.length === 0) {
      throw new NotFoundException(CHAT_ERRORS.CHAT_NOT_FOUND);
    }
    return participants;
  }

  /**
   * Find or create a private chat between two users
   */
  async findOrCreatePrivateChat(
    user1Id: ObjectId,
    user2Id: ObjectId,
  ): Promise<Chat> {
    try {
      // Check if chat already exists
      const existingChat = await this.chatRepository.findPrivateChat(
        user1Id,
        user2Id,
      );

      if (existingChat) {
        return existingChat;
      }

      // Create new private chat
      const chat: ChatModel = {
        _id: new ObjectId(),
        type: ChatType.PRIVATE,
        participants: [user1Id, user2Id],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.chatRepository.create(chat);

      if (result.acknowledged) {
        // Fetch populated chat
        const populatedChat = await this.chatRepository.findById(chat._id);
        if (populatedChat) {
          return populatedChat;
        }
      }

      throw new Error('Failed to create chat');
    } catch (error) {
      this.logger.error(
        `Error finding/creating private chat: ${error.message}`,
      );
      throw new BadRequestException(CHAT_ERRORS.FAILED_TO_START_CHAT);
    }
  }

  /**
   * Create chat with notification (used by HTTP endpoint)
   */
  async createChatWithNotification(
    createChatDto: CreateChatDto,
  ): Promise<Chat> {
    try {
      const result = await this.createChat(createChatDto);

      if (!result.acknowledged) {
        throw new Error('Failed to create chat');
      }

      const newChat = await this.getChatById(result.insertedId);
      if (!newChat) {
        throw new Error('Failed to fetch created chat');
      }

      return newChat;
    } catch (error) {
      this.logger.error(`Error creating chat: ${error.message}`);
      throw new BadRequestException('Failed to create chat');
    }
  }
}
