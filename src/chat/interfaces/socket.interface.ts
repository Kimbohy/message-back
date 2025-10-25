import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
}
