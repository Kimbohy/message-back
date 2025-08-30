import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SubscribeMessage } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

@WebSocketGateway(3002, { cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    console.log('New user connected ', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('User disconnected ', client.id);
  }

  @SubscribeMessage('newMessage')
  handleNewMessage(client: Socket, message: any) {
    console.log(message);
    client.emit('reply', 'this is a reply');
    this.server.emit('reply', 'broadcasting...');
  }
}
