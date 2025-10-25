import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Message } from 'src/interfaces/message.interface';

/**
 * MessageRepository
 * Handles all database operations related to messages
 * Separates data access logic from business logic
 */
@Injectable()
export class MessageRepository {
  private readonly collection = 'messages';

  constructor(@Inject('MONGO_DB') private readonly db: Db) {}

  /**
   * Create a new message
   */
  async create(message: Message) {
    return this.db.collection<Message>(this.collection).insertOne(message);
  }

  /**
   * Find all messages for a specific chat
   */
  async findByChatId(chatId: ObjectId): Promise<Message[]> {
    return this.db
      .collection<Message>(this.collection)
      .find({ chatId })
      .sort({ createdAt: 1 })
      .toArray();
  }

  /**
   * Find a message by ID
   */
  async findById(messageId: ObjectId): Promise<Message | null> {
    return this.db
      .collection<Message>(this.collection)
      .findOne({ _id: messageId });
  }

  /**
   * Mark messages as seen by a user
   */
  async markAsSeen(chatId: ObjectId, userId: ObjectId) {
    return this.db
      .collection<Message>(this.collection)
      .updateMany(
        { chatId, seenBy: { $ne: userId } },
        { $addToSet: { seenBy: userId } },
      );
  }

  /**
   * Get unread message count for a user in a chat
   */
  async getUnreadCount(chatId: ObjectId, userId: ObjectId): Promise<number> {
    return this.db
      .collection<Message>(this.collection)
      .countDocuments({ chatId, seenBy: { $ne: userId } });
  }

  /**
   * Delete all messages in a chat
   */
  async deleteByChatId(chatId: ObjectId) {
    return this.db.collection<Message>(this.collection).deleteMany({ chatId });
  }
}
