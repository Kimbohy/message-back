import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class JoinChatDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  chatId: string;
}
