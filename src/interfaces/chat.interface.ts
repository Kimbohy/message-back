import { ObjectId } from 'mongodb';

export enum ChatType {
  GROUP = 'GROUP',
  PRIVATE = 'PRIVATE',
}

export interface Chat {
  _id: ObjectId;
  type: ChatType;
  name?: string;
  participants: ObjectId[];
  lastMessage?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
