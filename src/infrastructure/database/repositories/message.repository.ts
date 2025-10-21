import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { BaseRepository } from './base.repository';
import { Message } from '../../../shared/interfaces';

@Injectable()
export class MessageRepository extends BaseRepository<Message> {
  constructor(@Inject('MONGO_DB') db: Db) {
    super(db, 'messages');
  }

  async findMessagesByChatId(chatId: ObjectId, limit = 50, skip = 0): Promise<Message[]> {
    return this.collection
      .find({ chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async createMessage(messageData: Omit<Message, '_id'>): Promise<Message> {
    return this.create(messageData);
  }

  async markMessagesAsSeen(chatId: ObjectId, userId: ObjectId): Promise<number> {
    const result = await this.collection.updateMany(
      { chatId, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } },
    );
    return result.modifiedCount;
  }

  async getUnreadCount(chatId: ObjectId, userId: ObjectId): Promise<number> {
    return this.countDocuments({
      chatId,
      seenBy: { $ne: userId },
    });
  }
}
