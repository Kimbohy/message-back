import { ObjectId } from 'mongodb';

export interface Message {
  _id: ObjectId;
  chatId: ObjectId;
  senderId: ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  seenBy: ObjectId[];
}
