import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Chat, ChatType } from 'src/interfaces/chat.interface';
import { Message } from 'src/interfaces/message.interface';
import { CreateChatDto } from './dto/create-chat.dto';
import { StartChatByEmailDto } from './dto/start-chat-by-email.dto';
import { AuthService } from 'src/auth';
import { ChatGateway } from './chat-gateway';

@Injectable()
// todo: implement DTO validation
export class ChatService {
  constructor(
    @Inject('MONGO_DB') private readonly db: Db,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

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
    const chat = await this.findOrCreatePrivateChat(
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
          },
          updatedAt: new Date(),
        };

        this.chatGateway.server
          .to(`user_${recipientUserId.toString()}`)
          .emit('chatUpdated', chatUpdate);
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
      chat: {
        _id: chat._id.toString(),
        type: chat.type,
        participants: chat.participants.map((p) => p.toString()),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      message: 'Chat started successfully',
    };
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
