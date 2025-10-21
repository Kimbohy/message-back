import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { BaseRepository } from './base.repository';
import { Chat, ChatModel } from '../../../shared/interfaces';
import { ChatType } from '../../../shared/types/chat.types';

@Injectable()
export class ChatRepository extends BaseRepository<ChatModel> {
  constructor(@Inject('MONGO_DB') db: Db) {
    super(db, 'chats');
  }

  async findChatsForUser(userId: ObjectId): Promise<Chat[]> {
    const result = await this.collection
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

    return result as Chat[];
  }

  async findChatById(chatId: ObjectId): Promise<Chat | null> {
    const result = await this.collection
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

  async findPrivateChat(user1Id: ObjectId, user2Id: ObjectId): Promise<Chat | null> {
    const result = await this.collection
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

    return result as Chat | null;
  }

  async createChat(chatData: Omit<ChatModel, '_id'>): Promise<ChatModel> {
    return this.create(chatData);
  }

  async updateLastMessage(chatId: ObjectId, messageId: ObjectId): Promise<void> {
    await this.updateById(chatId, {
      $set: { lastMessage: messageId, updatedAt: new Date() },
    });
  }

  async addParticipant(chatId: ObjectId, userId: ObjectId): Promise<void> {
    await this.updateById(chatId, {
      $addToSet: { participants: userId },
    });
  }

  async removeParticipant(chatId: ObjectId, userId: ObjectId): Promise<void> {
    await this.updateById(chatId, {
      $pull: { participants: userId },
    });
  }

  async isUserInChat(chatId: ObjectId, userId: ObjectId): Promise<boolean> {
    const chat = await this.findOne({
      _id: chatId,
      participants: userId,
    });
    return chat !== null;
  }
}
