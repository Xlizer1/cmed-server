import { Redis } from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Create Redis client
const redisClient = new Redis(redisConfig);

// Test Redis connection
export const testRedisConnection = async () => {
  try {
    await redisClient.ping();
    console.log('Redis connection established successfully');
    return true;
  } catch (error) {
    console.error('Error connecting to Redis:', error);
    return false;
  }
};

// Cache middleware functions
export const cacheMiddleware = {
  // Set cache with expiration time
  set: async (key: string, data: any, expireTime = 3600) => {
    try {
      await redisClient.setex(key, expireTime, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false;
    }
  },

  // Get cache by key
  get: async (key: string) => {
    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      return null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  },

  // Delete cache by key
  delete: async (key: string) => {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error deleting cache:', error);
      return false;
    }
  },

  // Delete cache by pattern (e.g., 'user:*')
  deleteByPattern: async (pattern: string) => {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Error deleting cache by pattern:', error);
      return false;
    }
  }
};

export default redisClient;