# Chat Module Architecture

## Overview

This chat module follows clean architecture principles with clear separation of concerns, making it maintainable, testable, and scalable.

## Directory Structure

```
src/chat/
├── constants/              # Centralized constants and enums
│   ├── events.constants.ts # WebSocket event names
│   ├── errors.constants.ts # Error messages
│   └── index.ts
├── dto/                    # Data Transfer Objects
│   ├── create-chat.dto.ts
│   ├── join-chat.dto.ts
│   ├── leave-chat.dto.ts
│   ├── send-message.dto.ts
│   └── start-chat-by-email.dto.ts
├── filters/                # Exception filters
│   ├── ws-exception.filter.ts
│   └── index.ts
├── handlers/               # WebSocket event handlers
│   ├── chat-creation.handler.ts
│   ├── chat-list.handler.ts
│   ├── chat-room.handler.ts
│   ├── message.handler.ts
│   └── index.ts
├── interfaces/             # TypeScript interfaces
│   └── socket.interface.ts
├── repositories/           # Data access layer
│   ├── chat.repository.ts
│   ├── message.repository.ts
│   └── index.ts
├── chat-gateway.ts         # WebSocket gateway (thin layer)
├── chat.controller.ts      # HTTP REST controller
├── chat.service.ts         # Business logic
└── chat.module.ts          # Module definition
```

## Architecture Layers

### 1. **Gateway Layer** (`chat-gateway.ts`)

- **Responsibility**: Handle WebSocket connections/disconnections and route events
- **Does**:
  - JWT authentication on connection
  - Delegate events to appropriate handlers
  - Manage socket rooms
- **Does NOT**:
  - Contain business logic
  - Access database directly
  - Handle complex operations

### 2. **Handler Layer** (`handlers/`)

Each handler focuses on a specific domain of events:

- **ChatListHandler**: Get chat lists
- **ChatRoomHandler**: Join/leave chat rooms
- **MessageHandler**: Send and broadcast messages
- **ChatCreationHandler**: Create new chats

**Benefits**:

- Single Responsibility Principle
- Easy to test individual handlers
- Easy to add new event types
- Clear code organization

### 3. **Service Layer** (`chat.service.ts`)

- **Responsibility**: Business logic and orchestration
- **Does**:
  - Validate business rules
  - Orchestrate repository calls
  - Handle caching logic
  - Transform data as needed
- **Does NOT**:
  - Know about WebSocket or HTTP
  - Build database queries
  - Handle request/response directly

### 4. **Repository Layer** (`repositories/`)

- **Responsibility**: Data access and database operations
- **Does**:
  - Build and execute database queries
  - Handle data persistence
  - Abstract database implementation
- **Benefits**:
  - Easy to test with mocks
  - Easy to switch databases
  - Centralized query logic
  - Reusable across services

### 5. **Controller Layer** (`chat.controller.ts`)

- **Responsibility**: HTTP REST endpoints
- **Does**:
  - Handle HTTP requests
  - Validate input
  - Call service methods
  - Return responses
- **Separation**: HTTP and WebSocket are completely separated

## Key Design Patterns

### Repository Pattern

Separates data access logic from business logic:

```typescript
// Instead of:
this.db.collection('chats').find(...)

// We use:
this.chatRepository.findByUserId(userId)
```

### Handler Pattern

Separates event handling into focused classes:

```typescript
// Instead of: All logic in gateway
@SubscribeMessage('sendMessage')
handleMessage() { /* 100 lines of logic */ }

// We use: Delegate to handler
@SubscribeMessage(SOCKET_EVENTS.SEND_MESSAGE)
handleSendMessage(client, payload) {
  return this.messageHandler.handleSendMessage(client, payload, this.server);
}
```

### Constants Pattern

Centralized constants prevent typos and make refactoring easy:

```typescript
// Instead of: 'sendMessage' (magic strings)
// We use:
SOCKET_EVENTS.SEND_MESSAGE;
CHAT_ERRORS.NOT_IN_CHAT;
```

## Benefits of This Architecture

### 1. **Maintainability**

- Each file has a single, clear responsibility
- Easy to locate and fix bugs
- Changes are isolated to specific layers

### 2. **Testability**

- Each layer can be tested independently
- Easy to mock dependencies
- Clear interfaces between layers

### 3. **Scalability**

- Easy to add new features without touching existing code
- Can split into microservices if needed
- Repository pattern allows easy database changes

### 4. **Readability**

- Clear naming conventions
- Organized file structure
- Comprehensive documentation
- Self-documenting code with TypeScript

### 5. **Type Safety**

- Strong TypeScript typing throughout
- Interfaces for all data structures
- Compile-time error detection

## Adding New Features

### Adding a New WebSocket Event

1. Add event name to `constants/events.constants.ts`:

```typescript
export const SOCKET_EVENTS = {
  // ...
  NEW_EVENT: 'newEvent',
};
```

2. Create handler method in appropriate handler (or new handler):

```typescript
async handleNewEvent(client: AuthenticatedSocket, payload: NewEventDto) {
  // Implementation
}
```

3. Add event listener in gateway:

```typescript
@SubscribeMessage(SOCKET_EVENTS.NEW_EVENT)
handleNewEvent(client, payload) {
  return this.appropriateHandler.handleNewEvent(client, payload);
}
```

### Adding a New Repository Method

1. Add method to repository:

```typescript
async findByCustomCriteria(criteria: any) {
  return this.db.collection(this.collection).find(criteria).toArray();
}
```

2. Use in service:

```typescript
async getCustomData(criteria: any) {
  return this.chatRepository.findByCustomCriteria(criteria);
}
```

## Best Practices

1. **Always use constants** instead of magic strings
2. **Keep handlers focused** - one responsibility per handler
3. **Use repositories** for all database operations
4. **Add logging** at appropriate levels
5. **Handle errors** gracefully with proper messages
6. **Document** complex business logic
7. **Use TypeScript types** everywhere
8. **Test** each layer independently

## Testing Strategy

- **Unit Tests**: Test services and handlers with mocked repositories
- **Integration Tests**: Test repositories with test database
- **E2E Tests**: Test entire flow through gateway

## Future Improvements

- [ ] Add event-driven architecture with NestJS EventEmitter
- [ ] Implement rate limiting for WebSocket events
- [ ] Add comprehensive error tracking
- [ ] Implement message queuing for high load
- [ ] Add analytics and monitoring
- [ ] Implement automated testing suite
