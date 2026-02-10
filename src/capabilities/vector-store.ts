/**
 * @fileoverview Basic In-Memory Vector Store for SocietyAI
 *
 * A simple, zero-dependency vector database implementation for rapid prototyping.
 * Uses cosine similarity for semantic search.
 *
 * ⚠️ NOT FOR PRODUCTION: Use dedicated vector DBs (Pinecone, Weaviate, pgvector) for scale.
 *
 * @example
 * ```ts
 * import { InMemoryVectorStore, VectorStoreAdapter } from 'societyai/capabilities';
 *
 * const store = new InMemoryVectorStore({
 *   dimensions: 1536, // OpenAI ada-002 embedding size
 *   distance: 'cosine'
 * });
 *
 * // Store embeddings
 * await store.upsert({
 *   id: 'doc-1',
 *   vector: [0.1, 0.2, ...], // 1536-dimensional vector
 *   metadata: { text: 'Original text', source: 'manual' }
 * });
 *
 * // Search
 * const results = await store.search(queryVector, { topK: 5, threshold: 0.7 });
 *
 * // Wrap as VectorProvider (for use with MemorySystem)
 * const provider = new VectorStoreAdapter(store, async (text) => {
 *   return await embeddings.embed(text); // your embedding function
 * });
 * ```
 */

import { VectorProvider } from './memory';

/**
 * Vector entry in the store
 */
export interface VectorEntry {
  /** Unique identifier */
  id: string;
  /** Embedding vector */
  vector: number[];
  /** Associated metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Number of results to return */
  topK?: number;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Metadata filters */
  filter?: Record<string, unknown>;
}

/**
 * Search result
 */
export interface SearchResult {
  /** Vector entry */
  entry: VectorEntry;
  /** Similarity score (0-1, higher is better) */
  score: number;
}

/**
 * Distance metric type
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dotProduct';

/**
 * Configuration for InMemoryVectorStore
 */
export interface VectorStoreConfig {
  /** Expected vector dimensions */
  dimensions: number;
  /** Distance metric (default: 'cosine') */
  distance?: DistanceMetric;
  /** Maximum entries (FIFO eviction) */
  maxEntries?: number;
}

/**
 * In-Memory Vector Store
 *
 * Simple vector database for prototyping and testing.
 * Performs linear scan (O(n)) - suitable for <10K vectors.
 *
 * Features:
 * - Cosine, Euclidean, Dot Product similarities
 * - Metadata filtering
 * - FIFO eviction policy
 * - Zero external dependencies
 *
 * Limitations:
 * - No persistence (RAM only)
 * - No indexing (linear search)
 * - Single-threaded
 * - Memory-bound (~4KB per 1536-dim vector)
 */
export class InMemoryVectorStore {
  private entries: Map<string, VectorEntry>;
  private dimensions: number;
  private metric: DistanceMetric;
  private maxEntries: number;

  constructor(config: VectorStoreConfig) {
    this.entries = new Map();
    this.dimensions = config.dimensions;
    this.metric = config.distance || 'cosine';
    this.maxEntries = config.maxEntries || 10000;
  }

  /**
   * Insert or update a vector
   */
  async upsert(entry: VectorEntry): Promise<void> {
    // Validate dimensions
    if (entry.vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimensions}, got ${entry.vector.length}`
      );
    }

    // Evict oldest if at capacity
    if (this.entries.size >= this.maxEntries && !this.entries.has(entry.id)) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(entry.id, {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
    });
  }

  /**
   * Batch upsert
   */
  async upsertBatch(entries: VectorEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.upsert(entry);
    }
  }

  /**
   * Search for similar vectors
   */
  async search(queryVector: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    // Validate query dimensions
    if (queryVector.length !== this.dimensions) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.dimensions}, got ${queryVector.length}`
      );
    }

    const topK = options.topK || 10;
    const threshold = options.threshold || 0;
    const filter = options.filter;
    // Handle edge case: topK = 0
    if (topK <= 0) {
      return [];
    }
    // Linear scan with filtering
    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      // Apply metadata filters
      if (filter && !this.matchesFilter(entry.metadata, filter)) {
        continue;
      }

      const score = this.computeSimilarity(queryVector, entry.vector);

      if (score >= threshold) {
        results.push({ entry, score });
      }
    }

    // Sort by score (descending) and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Get vector by ID
   */
  async get(id: string): Promise<VectorEntry | null> {
    return this.entries.get(id) || null;
  }

  /**
   * Delete vector by ID
   */
  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  /**
   * Clear all vectors
   */
  async clear(): Promise<void> {
    this.entries.clear();
  }

  /**
   * Get store statistics
   */
  stats(): {
    count: number;
    dimensions: number;
    metric: DistanceMetric;
    maxEntries: number;
    memoryEstimateMB: number;
  } {
    const bytesPerEntry = this.dimensions * 8 + 100; // 8 bytes per float64 + metadata overhead
    const memoryEstimateMB = (this.entries.size * bytesPerEntry) / (1024 * 1024);

    return {
      count: this.entries.size,
      dimensions: this.dimensions,
      metric: this.metric,
      maxEntries: this.maxEntries,
      memoryEstimateMB: Math.round(memoryEstimateMB * 100) / 100,
    };
  }

  // --- Private Methods ---

  /**
   * Compute similarity between two vectors
   */
  private computeSimilarity(a: number[], b: number[]): number {
    switch (this.metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return this.euclideanSimilarity(a, b);
      case 'dotProduct':
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  /**
   * Cosine similarity (0 to 1, higher is better)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    // Convert from [-1, 1] to [0, 1] range
    return (dotProduct / denominator + 1) / 2;
  }

  /**
   * Euclidean distance converted to similarity (0 to 1, higher is better)
   */
  private euclideanSimilarity(a: number[], b: number[]): number {
    let sumSquares = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSquares += diff * diff;
    }
    const distance = Math.sqrt(sumSquares);
    // Convert distance to similarity (inverse)
    return 1 / (1 + distance);
  }

  /**
   * Dot product (normalized to 0-1 range)
   */
  private dotProduct(a: number[], b: number[]): number {
    let product = 0;
    for (let i = 0; i < a.length; i++) {
      product += a[i] * b[i];
    }
    // Normalize to [0, 1] assuming vectors are pre-normalized
    return Math.max(0, Math.min(1, (product + 1) / 2));
  }

  /**
   * Check if metadata matches filter
   */
  private matchesFilter(
    metadata: Record<string, unknown> | undefined,
    filter: Record<string, unknown>
  ): boolean {
    if (!metadata) return false;

    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

// ============================================================================
// VECTOR STORE ADAPTER — Bridges InMemoryVectorStore ↔ VectorProvider
// ============================================================================

/**
 * Embedding function type — converts text to a vector
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/**
 * Adapter that wraps an InMemoryVectorStore to implement the VectorProvider interface.
 *
 * VectorProvider works with text strings (used by MemorySystem), while
 * InMemoryVectorStore works with raw number[] vectors. This adapter bridges
 * the gap by using an embedding function to convert text → vectors.
 *
 * @example
 * ```ts
 * const store = new InMemoryVectorStore({ dimensions: 1536 });
 * const adapter = new VectorStoreAdapter(store, async (text) => {
 *   return await myEmbeddingModel.embed(text);
 * });
 *
 * // Now usable as VectorProvider in MemoryBuilder
 * const memory = MemoryBuilder.create()
 *   .withLongTermMemory({ provider: adapter })
 *   .build();
 * ```
 */
export class VectorStoreAdapter implements VectorProvider {
  constructor(
    private readonly store: InMemoryVectorStore,
    private readonly embed: EmbeddingFunction
  ) {}

  /**
   * Add a text entry — embeds the text and stores the vector
   */
  async add(id: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    const vector = await this.embed(text);
    await this.store.upsert({
      id,
      vector,
      metadata: { ...metadata, text },
    });
  }

  /**
   * Search for similar texts — embeds the query and performs vector search
   */
  async search(query: string, limit: number): Promise<Array<{ id: string; score: number }>> {
    const queryVector = await this.embed(query);
    const results = await this.store.search(queryVector, { topK: limit });
    return results.map((r) => ({ id: r.entry.id, score: r.score }));
  }

  /**
   * Delete an entry by ID
   */
  async delete(id: string): Promise<void> {
    await this.store.delete(id);
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.store.clear();
  }
}
