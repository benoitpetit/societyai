/**
 * @fileoverview Storage Adapters Export Index
 *
 * Optional storage adapters for SocietyAI persistence.
 * These require peer dependencies to be installed.
 */

// Redis Adapter (requires: ioredis)
export { RedisStorageAdapter, RedisClient, RedisStorageConfig } from './storage-redis';

// PostgreSQL Adapter (requires: pg)
export { PostgresStorageAdapter, PostgresPool, PostgresStorageConfig } from './storage-postgres';
