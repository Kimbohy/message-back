import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId, WithId } from 'mongodb';
import { Chat, ChatModel, ChatType } from 'src/interfaces/chat.interface';

/**
 * ChatRepository
 * Handles all database operations related to chats
 * Separates data access logic from business logic
 */
@Injectable()
export class ChatRepository {
  private readonly collection = 'chats';

  constructor(@Inject('MONGO_DB') private readonly db: Db) {}

  /**
   * Create a new chat
   */
  async create(chat: ChatModel) {
    return this.db.collection<ChatModel>(this.collection).insertOne(chat);
  }

  /**
   * Find chat by ID with populated participants
   */
  async findById(chatId: ObjectId): Promise<Chat | null> {
    const result = await this.db
      .collection<ChatModel>(this.collection)
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

  /**
   * Find all chats for a user with populated data
   */
  async findByUserId(userId: ObjectId): Promise<Chat[]> {
    const data = await this.db
      .collection<ChatModel>(this.collection)
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
        { $sort: { updatedAt: -1 } },
      ])
      .toArray();

    return data as Chat[];
  }

  /**
   * Find existing private chat between two users
   */
  async findPrivateChat(
    user1Id: ObjectId,
    user2Id: ObjectId,
  ): Promise<Chat | null> {
    const existingChat = await this.db
      .collection<ChatModel>(this.collection)
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

    return existingChat as Chat | null;
  }

  /**
   * Check if a chat exists
   */
  async exists(chatId: ObjectId): Promise<boolean> {
    const chat = await this.db
      .collection<ChatModel>(this.collection)
      .findOne({ _id: chatId });
    return !!chat;
  }

  /**
   * Check if a user is in a chat
   */
  async isUserInChat(chatId: ObjectId, userId: ObjectId): Promise<boolean> {
    const chat = await this.db
      .collection<ChatModel>(this.collection)
      .findOne({ _id: chatId, participants: userId });
    return !!chat;
  }

  /**
   * Update chat's last message and timestamp
   */
  async updateLastMessage(chatId: ObjectId, messageId: ObjectId) {
    return this.db.collection<ChatModel>(this.collection).updateOne(
      { _id: chatId },
      {
        $set: {
          updatedAt: new Date(),
          lastMessage: messageId,
        },
      },
    );
  }

  /**
   * Add user to chat
   */
  async addParticipant(chatId: ObjectId, userId: ObjectId) {
    return this.db
      .collection<ChatModel>(this.collection)
      .updateOne({ _id: chatId }, { $addToSet: { participants: userId } });
  }

  /**
   * Remove user from chat
   */
  async removeParticipant(chatId: ObjectId, userId: ObjectId) {
    return this.db
      .collection<ChatModel>(this.collection)
      .updateOne({ _id: chatId }, { $pull: { participants: userId } });
  }

  /**
   * Get chat participants
   */
  async getParticipants(chatId: ObjectId): Promise<ObjectId[]> {
    const chat = await this.db
      .collection<ChatModel>(this.collection)
      .findOne({ _id: chatId });
    return chat?.participants || [];
  }
}
