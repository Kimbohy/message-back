import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get env(): string {
    return this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  get port(): number {
    return this.configService.get<number>('PORT') ?? 3001;
  }

  get jwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return secret;
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
  }

  get corsOrigin(): string {
    return this.configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  }

  get mongoUri(): string {
    const uri = this.configService.get<string>('MONGO_URI');
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    return uri;
  }

  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST') ?? 'localhost';
  }

  get redisPort(): number {
    return this.configService.get<number>('REDIS_PORT') ?? 6379;
  }

  get websocketPort(): number {
    return this.configService.get<number>('WEBSOCKET_PORT') ?? 3002;
  }
}
