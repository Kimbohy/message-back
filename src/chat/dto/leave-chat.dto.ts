import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class LeaveChatDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  chatId: string;
}
