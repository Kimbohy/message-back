/**
 * WebSocket Events
 * Centralized constants for all socket events to ensure consistency
 */

export const SOCKET_EVENTS = {
  // Client -> Server events
  GET_CHAT_LIST: 'getChatList',
  JOIN_CHAT: 'joinChat',
  LEAVE_CHAT: 'leaveChat',
  SEND_MESSAGE: 'sendMessage',
  START_CHAT_BY_EMAIL: 'startChatByEmail',

  // Server -> Client events
  CHAT_LIST_INITIAL: 'chatListInitial',
  CHAT_JOINED: 'chatJoined',
  CHAT_LEFT: 'chatLeft',
  MESSAGE: 'message',
  CHAT_UPDATED: 'chatUpdated',
  CHAT_CREATED: 'chatCreated',
  ERROR: 'error',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
