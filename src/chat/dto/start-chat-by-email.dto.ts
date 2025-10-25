import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StartChatByEmailDto {
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  initialMessage?: string;
}
