import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Db, ObjectId } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import { LoginDto, UserResponseDto } from './dto/User.dto';
import { RegisterDto } from './dto/Register.dto';
import {
  BaseUser,
  BaseUserWithoutPassword,
} from './interfaces/baseUser.interface';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @Inject('MONGO_DB') private readonly db: Db,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<BaseUserWithoutPassword | null> {
    try {
      const user = await this.db
        .collection<BaseUser>('users')
        .findOne({ email: email.toLowerCase() });

      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      const { password: _, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        _id: user._id.toString(),
      };
    } catch (error) {
      throw new BadRequestException('Authentication failed');
    }
  }

  async registerUser(data: RegisterDto): Promise<UserResponseDto> {
    console.log(data);

    try {
      // Check if user already exists
      const existingUser = await this.db
        .collection<BaseUser>('users')
        .findOne({ email: data.email.toLowerCase() });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);

      // Create user object
      const now = new Date();
      const newUser: BaseUser = {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        name: data.name.trim(),
        createdAt: now,
        updatedAt: now,
      };

      // Insert user
      const result = await this.db
        .collection<BaseUser>('users')
        .insertOne(newUser);

      // Return user without password
      return {
        _id: result.insertedId.toString(),
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

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: UserResponseDto; accessToken: string }> {
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
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      accessToken,
    };
  }

  async findUserById(id: string): Promise<BaseUserWithoutPassword | null> {
    try {
      if (!ObjectId.isValid(id)) {
        return null;
      }

      const user = await this.db
        .collection<BaseUser>('users')
        .findOne({ _id: new ObjectId(id) });

      if (!user) {
        return null;
      }

      const { password: _, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        _id: user._id.toString(),
      };
    } catch (error) {
      return null;
    }
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async findUserByEmail(
    email: string,
  ): Promise<BaseUserWithoutPassword | null> {
    try {
      const user = await this.db
        .collection<BaseUser>('users')
        .findOne({ email: email.toLowerCase() });

      if (!user) {
        return null;
      }

      const { password: _, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        _id: user._id.toString(),
      };
    } catch (error) {
      return null;
    }
  }
}
