import { ObjectId } from 'mongodb';
import { UserWithoutPassword } from './user.interface';
import { Message } from './message.interface';

export enum ChatType {
  GROUP = 'GROUP',
  PRIVATE = 'PRIVATE',
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

export interface ChatModel {
  _id: ObjectId;
  type: ChatType;
  name?: string;
  participants: ObjectId[];
  lastMessage?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
