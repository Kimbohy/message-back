import { Injectable, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { UserRepository } from '../../infrastructure/database/repositories';
import { UserResponseDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(userId: string): Promise<UserResponseDto> {
    if (!ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      _id: user._id!.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    return {
      _id: user._id!.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
