import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket Exception Filter
 * Handles exceptions in WebSocket events and sends formatted error responses
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    let message = 'An error occurred';

    if (exception instanceof WsException) {
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    client.emit('error', {
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
