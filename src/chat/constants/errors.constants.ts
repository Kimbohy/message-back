/**
 * Error Messages
 * Centralized error messages for consistency
 */

export const CHAT_ERRORS = {
  UNAUTHORIZED: 'Unauthorized access',
  NOT_IN_CHAT: 'You are not a participant in this chat',
  FAILED_TO_GET_CHAT_LIST: 'Failed to get chat list',
  FAILED_TO_JOIN_CHAT: 'Failed to join chat',
  FAILED_TO_SEND_MESSAGE: 'Failed to send message',
  FAILED_TO_START_CHAT: 'Failed to start chat',
  USER_NOT_FOUND: 'User with this email does not exist',
  CANNOT_CHAT_WITH_SELF: 'Cannot start a chat with yourself',
  AUTHENTICATION_ERROR: 'User authentication error',
  CHAT_NOT_FOUND: 'Chat not found',
  CHAT_NOT_EXIST: 'Chat does not exist',
  USER_NOT_IN_CHAT: 'User not in chat',
} as const;

export type ChatError = (typeof CHAT_ERRORS)[keyof typeof CHAT_ERRORS];
