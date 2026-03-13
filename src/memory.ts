/**
 * @fileoverview Memory Management API
 *
 * Multi-level memory system for agents with persistence support.
 *
 * @example
 * ```typescript
 * import { MemoryBuilder, MemorySystem } from 'societyai/memory';
 * import { FileStorageAdapter } from 'societyai';
 *
 * const memory = MemoryBuilder.create()
 *   .withShortTermMemory({ maxMessages: 50 })
 *   .withLongTermMemory({ maxEntries: 1000 })
 *   .withPersistence({
 *     adapter: new FileStorageAdapter('./memory'),
 *     autoSaveInterval: 60000
 *   })
 *   .build();
 *
 * await memory.add('Important fact', { type: 'fact', importance: 0.9 });
 * const context = await memory.retrieve('query');
 * ```
 */

// Memory Systems
export {
  MemorySystem,
  MemoryBuilder,
  ShortTermMemory,
  LongTermMemory,
  EntityMemory,
} from './capabilities/memory';

// Memory Types
export type {
  MemoryEntry,
  MemoryQuery,
  MemoryRetrievalResult,
  VectorProvider,
  Entity,
  ShortTermMemoryConfig,
  LongTermMemoryConfig,
  MemoryPersistenceConfig,
} from './capabilities/memory';

// Vector Store
export { InMemoryVectorStore, VectorStoreAdapter } from './capabilities/vector-store';

export type {
  VectorEntry,
  VectorStoreConfig,
  SearchOptions,
  SearchResult,
  DistanceMetric,
  EmbeddingFunction,
} from './capabilities/vector-store';
