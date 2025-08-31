import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get env(): string {
    return (
      this.configService.get<string>('NODE_ENV', {
        infer: true,
      }) ?? 'development'
    );
  }

  get port(): number {
    return (
      this.configService.get<number>('PORT', {
        infer: true,
      }) ?? 3001
    );
  }

  get jwtSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET', {
        infer: true,
      }) ?? 'super-secret-key'
    );
  }

  get jwtExpiresIn(): string {
    return (
      this.configService.get<string>('JWT_EXPIRES_IN', {
        infer: true,
      }) ?? '7d'
    );
  }

  get corsOrigin(): string {
    return (
      this.configService.get<string>('CORS_ORIGIN', {
        infer: true,
      }) ?? 'http://localhost:3000'
    );
  }

  get mongoUri(): string {
    return (
      this.configService.get<string>('MONGO_URI', {
        infer: true,
      }) ?? 'mongodb://localhost:27018/whatsapp_db'
    );
  }
}
