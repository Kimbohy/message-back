import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ObjectId } from 'mongodb';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
