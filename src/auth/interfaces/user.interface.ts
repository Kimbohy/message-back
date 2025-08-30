import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId | string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithoutPassword {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
