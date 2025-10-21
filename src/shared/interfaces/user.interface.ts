import { ObjectId } from 'mongodb';

export interface BaseUser {
  _id?: ObjectId;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithoutPassword extends Omit<BaseUser, 'password'> {
  _id: string;
}
