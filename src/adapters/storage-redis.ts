/**
 * @fileoverview Redis Storage Adapter for SocietyAI
 *
 * This adapter requires the 'ioredis' peer dependency to be installed.
 * Install with: npm install ioredis
 *
 * @example
 * ```ts
 * import Redis from 'ioredis';
 * import { RedisStorageAdapter } from 'societyai/adapters';
 *
 * const redis = new Redis({ host: 'localhost', port: 6379 });
 * const storage = new RedisStorageAdapter({ client: redis, keyPrefix: 'society:' });
 *
 * await society.execute(input, signal, undefined, undefined, undefined, storage);
 * ```
 */

import { StorageAdapter, WorkflowState } from '../core/persistence';
import { ProcessingFailedError } from '../core/errors';

/**
 * Redis client interface (compatible with ioredis)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  /** Incremental key scan — available in ioredis and node-redis v4+ */
  scan(
    cursor: string,
    matchOption: 'MATCH',
    pattern: string,
    countOption: 'COUNT',
    count: number
  ): Promise<[string, string[]]>;
}

/**
 * Configuration for RedisStorageAdapter
 */
export interface RedisStorageConfig {
  /** Redis client instance (ioredis) */
  client: RedisClient;
  /** Key prefix for all stored states (default: 'societyai:state:') */
  keyPrefix?: string;
  /** Default TTL in seconds (0 = no expiration) */
  ttl?: number;
}

/**
 * Redis-based storage adapter for distributed/high-performance scenarios
 *
 * Features:
 * - Atomic operations
 * - TTL support for automatic cleanup
 * - Distributed state sharing
 * - High-performance reads/writes
 *
 * @peer-dependency ioredis ^5.0.0
 */
export class RedisStorageAdapter implements StorageAdapter {
  private client: RedisClient;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(config: RedisStorageConfig) {
    this.client = config.client;
    this.keyPrefix = config.keyPrefix || 'societyai:state:';
    this.defaultTTL = config.ttl || 0; // 0 = no expiration
  }

  /**
   * Generate full Redis key
   */
  private getKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  async save(id: string, state: WorkflowState): Promise<void> {
    const key = this.getKey(id);
    const value = JSON.stringify(state);

    try {
      if (this.defaultTTL > 0) {
        await this.client.setex(key, this.defaultTTL, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to save state to Redis for ${id}: ${(error as Error).message}`
      );
    }
  }

  async load(id: string): Promise<WorkflowState | null> {
    const key = this.getKey(id);

    try {
      const value = await this.client.get(key);
      if (!value) return null;

      return JSON.parse(value) as WorkflowState;
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to load state from Redis for ${id}: ${(error as Error).message}`
      );
    }
  }

  async delete(id: string): Promise<void> {
    const key = this.getKey(id);
    await this.client.del(key);
  }

  async list(): Promise<string[]> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const prefixRegex = new RegExp(`^${this.keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      const ids: string[] = [];
      let cursor = '0';

      // Use SCAN instead of KEYS to avoid blocking the Redis server on large keyspaces
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        for (const key of keys) {
          ids.push(key.replace(prefixRegex, ''));
        }
      } while (cursor !== '0');

      return ids;
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to list states from Redis: ${(error as Error).message}`
      );
    }
  }
}
