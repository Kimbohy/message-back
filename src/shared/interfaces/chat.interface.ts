import { ObjectId } from 'mongodb';
import { UserWithoutPassword } from './user.interface';
import { Message } from './message.interface';
import { ChatType } from '../types/chat.types';

export interface ChatModel {
  _id: ObjectId;
  type: ChatType;
  name?: string;
  participants: ObjectId[];
  lastMessage?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chat {
  _id: ObjectId;
  type: ChatType;
  name?: string;
  participants: UserWithoutPassword[];
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}
