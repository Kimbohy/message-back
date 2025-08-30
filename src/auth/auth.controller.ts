import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { LoginDto, UserResponseDto } from './dto/User.dto';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
  ): Promise<{ message: string; user: UserResponseDto }> {
    const user = await this.authService.registerUser(registerDto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Request() req: any,
  ): Promise<{ message: string; user: UserResponseDto; accessToken: string }> {
    const result = await this.authService.login(loginDto);
    return {
      message: 'Login successful',
      ...result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any): Promise<UserResponseDto> {
    return this.authService.getProfile(req.user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<{ message: string }> {
    // With JWT, logout is handled client-side by removing the token
    // For server-side logout, you would need to maintain a blacklist
    return {
      message: 'Logout successful',
    };
  }
}
