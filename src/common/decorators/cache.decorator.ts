import { ObjectId } from 'mongodb';
import { RedisCacheService } from '../services/redis-cache.service';

/**
 * Caches the result of a method call in Redis.
 * @param keyFactory A function that generates the cache key based on method arguments.
 * @param ttl The time-to-live for the cache entry (in seconds).
 * @returns A method decorator.
 */
export function CacheWithRedis(
  keyFactory?: (...args: any[]) => string,
  ttl?: number,
) {
  return function (
    target: any,
    propertyKey: string, // The name of the method being decorated
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const redisCache: RedisCacheService = this.redisCache;

      const cacheKey =
        keyFactory?.(...args) ?? `${propertyKey}:${JSON.stringify(args)}`;

      const cached = await redisCache.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      await redisCache.set(cacheKey, result, ttl);
      return result;
    };
  };
}

/**
 * Invalidates the cache for the specified keys.
 * @param keyFactories An array of functions that generate cache keys based on method arguments.
 * @returns A method decorator.
 */
export function InvalidateCache(
  keyFactories: ((...args: any[]) => string | string[])[],
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const redisCache: RedisCacheService = this.redisCache;

      const result = await originalMethod.apply(this, args);

      for (const factory of keyFactories) {
        const keys = factory(...args);
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          await redisCache.del(key);
        }
      }
      return result;
    };
    return descriptor;
  };
}

/**
 * Invalidates the chat cache for a specific chat ID.
 * @param chatIdIndex The index of the chat ID in the method arguments.
 * @returns A method decorator.
 */
export function InvalidateChatCache(chatIdIndex: number = 0) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const redisCache: RedisCacheService = this.redisCache;

      const result = await originalMethod.apply(this, args);

      const chatId = args[chatIdIndex] as ObjectId;

      // Invalidate the specific chat cache
      await redisCache.del(`chat:${chatId}`);

      // Get chat members and invalidate their chats list cache
      const members = await this.getChatMembers(chatId);
      for (const userId of members) {
        await redisCache.del(`chats:${userId}`);
      }

      return result;
    };
    return descriptor;
  };
}
