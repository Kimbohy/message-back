import { ObjectId } from 'mongodb';
import { RedisCacheService } from '../../infrastructure/cache';

/**
 * Caches the result of a method call in Redis.
 * The class must have a 'cacheService' property of type RedisCacheService.
 */
export function CacheWithRedis(
  keyFactory?: (...args: unknown[]) => string,
  ttl?: number,
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: { cacheService: RedisCacheService }, ...args: unknown[]) {
      const cacheService = this.cacheService;

      if (!cacheService) {
        throw new Error('CacheService not found. Ensure the class has a cacheService property.');
      }

      const cacheKey = keyFactory?.(...args) ?? `${propertyKey}:${JSON.stringify(args)}`;

      const cached = await cacheService.get<unknown>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      await cacheService.set(cacheKey, result, ttl);
      return result;
    };

    return descriptor;
  };
}

/**
 * Invalidates cache for specific keys after method execution.
 * The class must have a 'cacheService' property of type RedisCacheService.
 */
export function InvalidateCache(
  keyFactories: ((...args: unknown[]) => string | string[])[],
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: { cacheService: RedisCacheService }, ...args: unknown[]) {
      const cacheService = this.cacheService;

      if (!cacheService) {
        throw new Error('CacheService not found. Ensure the class has a cacheService property.');
      }

      const result = await originalMethod.apply(this, args);

      for (const factory of keyFactories) {
        const keys = factory(...args);
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          await cacheService.del(key);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Invalidates chat cache after method execution.
 * The class must have a 'cacheService' and 'chatRepository' properties.
 */
export function InvalidateChatCache(chatIdIndex = 0) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (
      this: { cacheService: RedisCacheService; getChatMembers: (chatId: ObjectId) => Promise<ObjectId[]> },
      ...args: unknown[]
    ) {
      const cacheService = this.cacheService;

      if (!cacheService) {
        throw new Error('CacheService not found. Ensure the class has a cacheService property.');
      }

      const result = await originalMethod.apply(this, args);

      const chatId = args[chatIdIndex] as ObjectId;

      // Invalidate the specific chat cache
      await cacheService.del(`chat:${chatId.toString()}`);

      // Get chat members and invalidate their chats list cache
      if (this.getChatMembers) {
        const members = await this.getChatMembers(chatId);
        for (const userId of members) {
          await cacheService.del(`chats:${userId.toString()}`);
        }
      }

      return result;
    };

    return descriptor;
  };
}
