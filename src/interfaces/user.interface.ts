import { BaseUser } from 'src/auth/interfaces/baseUser.interface';

export interface User extends BaseUser {}
export interface UserWithoutPassword extends Omit<BaseUser, 'password'> {}
