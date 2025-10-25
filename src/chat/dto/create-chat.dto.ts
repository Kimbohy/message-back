import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ObjectId } from 'mongodb';
import { ChatType } from 'src/interfaces/chat.interface';

export class CreateChatDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  participants: ObjectId[];

  @IsEnum(ChatType)
  type: ChatType;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;
}
