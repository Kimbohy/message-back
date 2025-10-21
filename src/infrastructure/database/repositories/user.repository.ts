import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { BaseRepository } from './base.repository';
import { BaseUser } from '../../../shared/interfaces';

@Injectable()
export class UserRepository extends BaseRepository<BaseUser> {
  constructor(@Inject('MONGO_DB') db: Db) {
    super(db, 'users');
  }

  async findByEmail(email: string): Promise<BaseUser | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  async createUser(userData: Omit<BaseUser, '_id'>): Promise<BaseUser> {
    return this.create(userData);
  }

  async updateUser(userId: string | ObjectId, userData: Partial<BaseUser>): Promise<BaseUser | null> {
    return this.updateById(userId, { $set: userData });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }
}
