import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { UserRepository } from '../../infrastructure/database/repositories';
import { LoginDto, RegisterDto, AuthResponseDto } from './dto';
import { UserResponseDto } from '../users/dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      return {
        _id: user._id!.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      };
    } catch {
      throw new BadRequestException('Authentication failed');
    }
  }

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    const { email, password, name } = registerDto;

    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const now = new Date();
      const newUser = await this.userRepository.createUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
      });

      return {
        _id: newUser._id!.toString(),
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Registration failed');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user._id,
      email: user.email,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    if (!ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      _id: user._id!.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
