/**
 * @fileoverview Adapters Module - Simplified integrations for SocietyAI
 *
 * This module provides factory functions and adapters for common AI providers,
 * storage systems, and other external services. These adapters are designed
 * to work seamlessly with isolated worker threads and provide a better DX.
 *
 * @example
 * ```typescript
 * import { Society } from 'societyai';
 * import { ModelAdapters } from 'societyai/adapters';
 *
 * const society = Society.create()
 *   .addAgent(agent => agent
 *     .withId('processor')
 *     .withModel(ModelAdapters.openai({ apiKey: process.env.OPENAI_API_KEY }))
 *     .withExecutionMode('isolated')
 *   );
 * ```
 */

// Model Adapters - Simplified AI provider configurations
export {
  ModelAdapters,
  SerializableModelConfig,
  ModelAdapter,
  isSerializableModelConfig,
  createModelFromConfig,
} from './model-adapters';

// Storage Adapters (requires peer dependencies)
export { RedisStorageAdapter, RedisClient, RedisStorageConfig } from './storage-redis';
export { PostgresStorageAdapter, PostgresPool, PostgresStorageConfig } from './storage-postgres';
