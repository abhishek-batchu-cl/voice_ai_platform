import { createClient, RedisClientType } from 'redis';

export class RedisService {
  private static client: RedisClientType | null = null;
  private static isConnected = false;

  static async initialize(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('🔴 Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      console.warn('Continuing without Redis - rate limiting will be disabled');
    }
  }

  static getClient(): RedisClientType | null {
    return this.client;
  }

  static isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  static async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return await this.client.get(key);
  }

  static async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (!this.client) return;
    if (expirySeconds) {
      await this.client.setEx(key, expirySeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  static async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return await this.client.incr(key);
  }

  static async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, seconds);
  }

  static async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }
}
