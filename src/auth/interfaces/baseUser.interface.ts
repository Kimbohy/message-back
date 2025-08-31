import { ObjectId } from 'mongodb';

export interface BaseUser {
  _id?: ObjectId | string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseUserWithoutPassword {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
