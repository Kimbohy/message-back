import { ObjectId } from 'mongodb';

export interface Message {
  _id: ObjectId;
  chatId: ObjectId;
  senderId: ObjectId;
  content: string;
  seenBy: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
