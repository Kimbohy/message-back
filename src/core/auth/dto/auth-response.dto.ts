import { UserResponseDto } from '../../users/dto';

export class AuthResponseDto {
  user: UserResponseDto;
  accessToken: string;
}
