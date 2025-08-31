import { Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Chat, ChatType } from 'src/interfaces/chat.interface';
import { Message } from 'src/interfaces/message.interface';
import { CreateChatDto } from './dto/create-chat.dto';

@Injectable()
// todo: implement DTO validation
export class ChatService {
  constructor(@Inject('MONGO_DB') private readonly db: Db) {}

  createChat(createChatDto: CreateChatDto) {
    const { participants, type, name } = createChatDto;
    const chat: Chat = {
      _id: new ObjectId(),
      type,
      participants,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.db.collection<Chat>('chats').insertOne(chat);
  }

  getChatsForUser(userId: ObjectId) {
    return this.db
      .collection<Chat>('chats')
      .find({ participants: userId })
      .toArray();
  }

  getChatById(chatId: ObjectId) {
    return this.db.collection<Chat>('chats').findOne({ _id: chatId });
  }

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
    };
    const result = await this.db.collection('messages').insertOne(message);
    if (result.acknowledged) {
      this.db
        .collection<Chat>('chats')
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
      .collection<Chat>('chats')
      .updateOne({ _id: chatId }, { $addToSet: { participants: userId } });
  }

  removeUserFromChat(chatId: ObjectId, userId: ObjectId) {
    return this.db
      .collection<Chat>('chats')
      .updateOne({ _id: chatId }, { $pull: { participants: userId } });
  }

  checkUserInChat(chatId: ObjectId, userId: ObjectId): Promise<boolean> {
    return this.db
      .collection<Chat>('chats')
      .findOne({ _id: chatId, participants: userId })
      .then((chat) => !!chat);
  }

  checkChatExists(chatId: ObjectId): Promise<boolean> {
    return this.db
      .collection<Chat>('chats')
      .findOne({ _id: chatId })
      .then((chat) => !!chat);
  }

  async findOrCreatePrivateChat(
    user1Id: ObjectId,
    user2Id: ObjectId,
  ): Promise<Chat> {
    // Check if a private chat already exists between these users
    const existingChat = await this.db.collection<Chat>('chats').findOne({
      type: ChatType.PRIVATE,
      participants: { $all: [user1Id, user2Id], $size: 2 },
    });

    if (existingChat) {
      return existingChat;
    }

    // Create new private chat
    const chat: Chat = {
      _id: new ObjectId(),
      type: ChatType.PRIVATE,
      participants: [user1Id, user2Id],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.collection<Chat>('chats').insertOne(chat);

    if (result.acknowledged) {
      return chat;
    }

    throw new Error('Failed to create chat');
  }
}
