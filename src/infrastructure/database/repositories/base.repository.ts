import { Inject, Injectable } from '@nestjs/common';
import { Collection, Db, Document, Filter, ObjectId, UpdateFilter } from 'mongodb';

@Injectable()
export abstract class BaseRepository<T extends Document> {
  protected collection: Collection<T>;

  constructor(
    @Inject('MONGO_DB') protected readonly db: Db,
    collectionName: string,
  ) {
    this.collection = this.db.collection<T>(collectionName);
  }

  async findById(id: string | ObjectId): Promise<T | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId } as Filter<T>);
  }

  async findOne(filter: Filter<T>): Promise<T | null> {
    return this.collection.findOne(filter);
  }

  async find(filter: Filter<T> = {}): Promise<T[]> {
    return this.collection.find(filter).toArray();
  }

  async create(document: Omit<T, '_id'>): Promise<T> {
    const result = await this.collection.insertOne(document as T);
    return { ...document, _id: result.insertedId } as T;
  }

  async updateById(id: string | ObjectId, update: UpdateFilter<T>): Promise<T | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.findOneAndUpdate(
      { _id: objectId } as Filter<T>,
      update,
      { returnDocument: 'after' },
    );
    return result ?? null;
  }

  async deleteById(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id: objectId } as Filter<T>);
    return result.deletedCount > 0;
  }

  async countDocuments(filter: Filter<T> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}
