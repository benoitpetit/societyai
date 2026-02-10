/**
 * @fileoverview Memory System for Agents
 *
 * This module provides a multi-level memory system for intelligent context management.
 *
 * Memory levels:
 * - ShortTermMemory: Recent conversation history with automatic summarization
 * - LongTermMemory: Persistent facts and knowledge (RAG-compatible)
 * - EntityMemory: Facts about specific entities (people, places, things)
 * - WorkingMemory: Temporary scratch space for current task
 *
 * Features:
 * - Automatic context window management
 * - Semantic search capabilities
 * - Memory consolidation
 * - Importance scoring
 * - Time-based decay
 *
 * @example
 * ```typescript
 * const memory = MemoryBuilder.create()
 *   .withShortTermMemory({ maxMessages: 20, summarizeAfter: 50 })
 *   .withLongTermMemory({ provider: vectorDB })
 *   .withEntityMemory()
 *   .build();
 *
 * // Add memories
 * await memory.add('User asked about TypeScript', { importance: 0.8 });
 *
 * // Retrieve relevant context
 * const context = await memory.retrieve('TypeScript features', { limit: 5 });
 * ```
 */

import { getLogger } from '../observability/logger';

// ============================================================================
// MEMORY TYPES
// ============================================================================

/**
 * Memory entry
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: string;
  /** Memory content */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Importance score (0-1) */
  importance?: number;
  /** Associated metadata */
  metadata?: Record<string, unknown>;
  /** Memory type */
  type?: 'conversation' | 'fact' | 'entity' | 'task' | 'observation';
  /** Related entity IDs */
  entities?: string[];
}

/**
 * Memory query
 */
export interface MemoryQuery {
  /** Query text */
  query: string;
  /** Maximum results to return */
  limit?: number;
  /** Minimum importance score */
  minImportance?: number;
  /** Time range filter */
  timeRange?: { start?: number; end?: number };
  /** Filter by type */
  types?: string[];
  /** Filter by entities */
  entities?: string[];
}

/**
 * Memory retrieval result
 */
export interface MemoryRetrievalResult {
  /** Retrieved memories */
  memories: MemoryEntry[];
  /** Relevance scores (optional) */
  scores?: number[];
  /** Total memories in storage */
  total: number;
}

/**
 * Vector provider interface for semantic search
 */
export interface VectorProvider {
  /** Add a text with embedding */
  add(id: string, text: string, metadata?: Record<string, unknown>): Promise<void>;
  /** Search for similar texts */
  search(query: string, limit: number): Promise<Array<{ id: string; score: number }>>;
  /** Delete an entry */
  delete(id: string): Promise<void>;
  /** Clear all entries */
  clear(): Promise<void>;
}

// ============================================================================
// SHORT TERM MEMORY
// ============================================================================

/**
 * Short-term memory configuration
 */
export interface ShortTermMemoryConfig {
  /** Maximum messages to keep */
  maxMessages?: number;
  /** Trigger summarization after N messages */
  summarizeAfter?: number;
  /** Importance decay rate per hour */
  decayRate?: number;
  /** Maximum size in bytes */
  byteSizeLimit?: number;
}

/**
 * Short-term memory implementation
 */
export class ShortTermMemory {
  private memories: MemoryEntry[] = [];
  private summarizedContent: string[] = [];
  private logger = getLogger();
  private config: Required<ShortTermMemoryConfig>;

  constructor(config: ShortTermMemoryConfig = {}) {
    this.config = {
      maxMessages: config.maxMessages ?? 50,
      summarizeAfter: config.summarizeAfter ?? 100,
      decayRate: config.decayRate ?? 0.1,
      // Default limit 10MB
      byteSizeLimit: config.byteSizeLimit ?? 10 * 1024 * 1024,
    };
  }

  /**
   * Add a memory entry
   */
  add(content: string, metadata?: Record<string, unknown>): void {
    // Check size limit before adding to avoid OOM with massive payload
    const contentSize = content.length * 2; // rough estimate
    if (contentSize > this.config.byteSizeLimit) {
      this.logger.info(`Memory entry too large (${contentSize} bytes), truncated.`);
      content = content.substring(0, this.config.byteSizeLimit / 2) + '...[truncated]';
    }

    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      content,
      timestamp: Date.now(),
      importance: (metadata?.importance as number) ?? 0.5,
      metadata,
      type: (metadata?.type as MemoryEntry['type']) ?? 'conversation',
    };

    this.memories.push(entry);
    this.logger.debug(`Added short-term memory: ${entry.id}`);

    // Check total memory usage
    this.enforceByteSizeLimit();

    // Check if summarization is needed
    if (this.memories.length > this.config.summarizeAfter) {
      this.summarize();
    }
  }

  /**
   * Enforce byte size limit
   */
  private enforceByteSizeLimit(): void {
    let currentSize = this.estimateSize();
    while (currentSize > this.config.byteSizeLimit && this.memories.length > 0) {
      // Remove oldest
      const removed = this.memories.shift();
      if (removed) {
        currentSize -= removed.content.length * 2;
      }
    }
    if (currentSize > this.config.byteSizeLimit) {
      // Clean summaries if still too big
      this.summarizedContent = [];
    }
  }

  private estimateSize(): number {
    return (
      this.memories.reduce((acc, m) => acc + m.content.length * 2, 0) +
      this.summarizedContent.reduce((acc, s) => acc + s.length * 2, 0)
    );
  }

  /**
   * Get recent memories
   */
  getRecent(limit?: number): MemoryEntry[] {
    const count = limit ?? this.config.maxMessages;
    return this.memories.slice(-count);
  }

  /**
   * Get all memories including summaries
   */
  getAll(): { memories: MemoryEntry[]; summaries: string[] } {
    return {
      memories: this.memories,
      summaries: this.summarizedContent,
    };
  }

  /**
   * Search memories
   */
  search(query: MemoryQuery): MemoryRetrievalResult {
    let filtered = this.memories;

    // Apply time range filter
    if (query.timeRange) {
      filtered = filtered.filter((m) => {
        if (query.timeRange!.start && m.timestamp < query.timeRange!.start) {
          return false;
        }
        if (query.timeRange!.end && m.timestamp > query.timeRange!.end) {
          return false;
        }
        return true;
      });
    }

    // Apply importance filter
    if (query.minImportance !== undefined) {
      filtered = filtered.filter((m) => (m.importance ?? 0) >= query.minImportance!);
    }

    // Apply type filter
    if (query.types) {
      filtered = filtered.filter((m) => query.types!.includes(m.type ?? ''));
    }

    // Simple text search (in production, use semantic search)
    const queryLower = query.query.toLowerCase();
    const scored = filtered
      .map((m) => ({
        memory: m,
        score: m.content.toLowerCase().includes(queryLower) ? 1 : 0,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const limit = query.limit ?? 10;
    const results = scored.slice(0, limit);

    return {
      memories: results.map((r) => r.memory),
      scores: results.map((r) => r.score),
      total: this.memories.length,
    };
  }

  /**
   * Summarize old memories
   */
  private summarize(): void {
    // Take first half of memories for summarization
    const toSummarize = this.memories.slice(0, Math.floor(this.memories.length / 2));

    // Create a simple summary (in production, use AI to summarize)
    const summary = toSummarize
      .map((m) => m.content)
      .join('\n')
      .substring(0, 500);

    this.summarizedContent.push(`[Summary]: ${summary}...`);

    // Remove summarized memories
    this.memories = this.memories.slice(Math.floor(this.memories.length / 2));

    this.logger.debug(`Summarized ${toSummarize.length} memories`);
  }

  /**
   * Apply importance decay
   */
  applyDecay(): void {
    const now = Date.now();
    for (const memory of this.memories) {
      const ageHours = (now - memory.timestamp) / (1000 * 60 * 60);
      const decay = Math.exp(-this.config.decayRate * ageHours);
      memory.importance = (memory.importance ?? 0.5) * decay;
    }
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories = [];
    this.summarizedContent = [];
    this.logger.debug('Cleared short-term memory');
  }
}

// ============================================================================
// LONG TERM MEMORY
// ============================================================================

/**
 * Long-term memory configuration
 */
export interface LongTermMemoryConfig {
  /** Vector provider for semantic search */
  provider?: VectorProvider;
  /** Maximum entries to store */
  maxEntries?: number;
}

/**
 * Long-term memory implementation with semantic search
 */
export class LongTermMemory {
  private memories: Map<string, MemoryEntry> = new Map();
  private provider?: VectorProvider;
  private logger = getLogger();
  private maxEntries: number;

  constructor(config: LongTermMemoryConfig = {}) {
    this.provider = config.provider;
    this.maxEntries = config.maxEntries ?? 1000;
  }

  /**
   * Add a memory entry
   */
  async add(content: string, metadata?: Record<string, unknown>): Promise<string> {
    const entry: MemoryEntry = {
      id: `ltm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      content,
      timestamp: Date.now(),
      importance: (metadata?.importance as number) ?? 0.5,
      metadata,
      type: 'fact',
    };

    this.memories.set(entry.id, entry);

    // Add to vector store if available
    if (this.provider) {
      await this.provider.add(entry.id, content, metadata);
    }

    this.logger.debug(`Added long-term memory: ${entry.id}`);

    // Prune if too many entries
    if (this.memories.size > this.maxEntries) {
      await this.prune();
    }

    return entry.id;
  }

  /**
   * Retrieve memories by query
   */
  async retrieve(query: MemoryQuery): Promise<MemoryRetrievalResult> {
    if (this.provider) {
      // Use semantic search
      const results = await this.provider.search(query.query, query.limit ?? 10);

      const memories = results
        .map((r) => this.memories.get(r.id))
        .filter((m): m is MemoryEntry => m !== undefined);

      return {
        memories,
        scores: results.map((r) => r.score),
        total: this.memories.size,
      };
    } else {
      // Fallback to simple text search
      const queryLower = query.query.toLowerCase();
      const filtered = Array.from(this.memories.values())
        .filter((m) => m.content.toLowerCase().includes(queryLower))
        .slice(0, query.limit ?? 10);

      return {
        memories: filtered,
        total: this.memories.size,
      };
    }
  }

  /**
   * Get memory by ID
   */
  get(id: string): MemoryEntry | undefined {
    return this.memories.get(id);
  }

  /**
   * Delete memory by ID
   */
  async delete(id: string): Promise<void> {
    this.memories.delete(id);
    if (this.provider) {
      await this.provider.delete(id);
    }
    this.logger.debug(`Deleted long-term memory: ${id}`);
  }

  /**
   * Prune least important memories
   */
  private async prune(): Promise<void> {
    const entries = Array.from(this.memories.values());
    entries.sort((a, b) => (a.importance ?? 0) - (b.importance ?? 0));

    const toPrune = entries.slice(0, Math.floor(entries.length * 0.2));
    for (const entry of toPrune) {
      await this.delete(entry.id);
    }

    this.logger.debug(`Pruned ${toPrune.length} memories`);
  }

  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    this.memories.clear();
    if (this.provider) {
      await this.provider.clear();
    }
    this.logger.debug('Cleared long-term memory');
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const memory of this.memories.values()) {
      const type = memory.type ?? 'unknown';
      byType[type] = (byType[type] ?? 0) + 1;
    }
    return { total: this.memories.size, byType };
  }
}

// ============================================================================
// ENTITY MEMORY
// ============================================================================

/**
 * Entity in memory
 */
export interface Entity {
  /** Unique identifier */
  id: string;
  /** Entity name */
  name: string;
  /** Entity type */
  type: string;
  /** Facts about the entity */
  facts: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Last updated */
  lastUpdated: number;
}

/**
 * Entity memory implementation
 */
export class EntityMemory {
  private entities: Map<string, Entity> = new Map();
  private logger = getLogger();

  /**
   * Add or update an entity
   */
  upsert(name: string, type: string, facts: string[], metadata?: Record<string, unknown>): string {
    const id = this.generateId(name, type);
    const existing = this.entities.get(id);

    if (existing) {
      // Merge facts (avoid duplicates)
      const existingFacts = new Set(existing.facts);
      for (const fact of facts) {
        existingFacts.add(fact);
      }
      existing.facts = Array.from(existingFacts);
      existing.lastUpdated = Date.now();
      existing.metadata = { ...existing.metadata, ...metadata };
      this.logger.debug(`Updated entity: ${id}`);
    } else {
      const entity: Entity = {
        id,
        name,
        type,
        facts,
        metadata,
        lastUpdated: Date.now(),
      };
      this.entities.set(id, entity);
      this.logger.debug(`Created entity: ${id}`);
    }

    return id;
  }

  /**
   * Get entity by ID or name
   */
  get(idOrName: string, type?: string): Entity | undefined {
    // Try as ID first
    let entity = this.entities.get(idOrName);
    if (entity) return entity;

    // Try as name
    if (type) {
      const id = this.generateId(idOrName, type);
      entity = this.entities.get(id);
    }

    return entity;
  }

  /**
   * Search entities
   */
  search(query: string, type?: string): Entity[] {
    const queryLower = query.toLowerCase();
    return Array.from(this.entities.values()).filter((entity) => {
      if (type && entity.type !== type) return false;
      return (
        entity.name.toLowerCase().includes(queryLower) ||
        entity.facts.some((f) => f.toLowerCase().includes(queryLower))
      );
    });
  }

  /**
   * Get all entities of a type
   */
  getByType(type: string): Entity[] {
    return Array.from(this.entities.values()).filter((e) => e.type === type);
  }

  /**
   * Delete entity
   */
  delete(id: string): void {
    this.entities.delete(id);
    this.logger.debug(`Deleted entity: ${id}`);
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.logger.debug('Cleared entity memory');
  }

  /**
   * Generate entity ID
   */
  private generateId(name: string, type: string): string {
    return `${type}_${name.toLowerCase().replace(/\s+/g, '_')}`;
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const entity of this.entities.values()) {
      byType[entity.type] = (byType[entity.type] ?? 0) + 1;
    }
    return { total: this.entities.size, byType };
  }
}

// ============================================================================
// UNIFIED MEMORY SYSTEM
// ============================================================================

/**
 * Unified memory system combining all memory types
 */
export class MemorySystem {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private entities: EntityMemory;
  private logger = getLogger();

  constructor(shortTermConfig?: ShortTermMemoryConfig, longTermConfig?: LongTermMemoryConfig) {
    this.shortTerm = new ShortTermMemory(shortTermConfig);
    this.longTerm = new LongTermMemory(longTermConfig);
    this.entities = new EntityMemory();
  }

  /**
   * Add a memory (automatically routed to appropriate store)
   */
  async add(
    content: string,
    options?: {
      type?: 'conversation' | 'fact' | 'entity';
      importance?: number;
      entityName?: string;
      entityType?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const type = options?.type ?? 'conversation';

    switch (type) {
      case 'conversation':
        this.shortTerm.add(content, { ...options?.metadata, importance: options?.importance });
        break;
      case 'fact':
        await this.longTerm.add(content, { ...options?.metadata, importance: options?.importance });
        break;
      case 'entity':
        if (options?.entityName && options?.entityType) {
          this.entities.upsert(
            options.entityName,
            options.entityType,
            [content],
            options?.metadata
          );
        }
        break;
    }
  }

  /**
   * Retrieve relevant memories for a query
   */
  async retrieve(
    query: string,
    options?: {
      includeShortTerm?: boolean;
      includeLongTerm?: boolean;
      includeEntities?: boolean;
      limit?: number;
    }
  ): Promise<string> {
    const parts: string[] = [];

    // Short-term memory
    if (options?.includeShortTerm !== false) {
      const recent = this.shortTerm.getRecent(options?.limit ?? 10);
      if (recent.length > 0) {
        parts.push('## Recent Context\n' + recent.map((m) => m.content).join('\n'));
      }
    }

    // Long-term memory
    if (options?.includeLongTerm !== false) {
      const ltmResult = await this.longTerm.retrieve({
        query,
        limit: options?.limit ?? 5,
      });
      if (ltmResult.memories.length > 0) {
        parts.push('## Relevant Facts\n' + ltmResult.memories.map((m) => m.content).join('\n'));
      }
    }

    // Entity memory
    if (options?.includeEntities !== false) {
      const entities = this.entities.search(query);
      if (entities.length > 0) {
        parts.push(
          '## Related Entities\n' +
            entities.map((e) => `${e.name} (${e.type}): ${e.facts.join(', ')}`).join('\n')
        );
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Get individual memory systems
   */
  getShortTerm(): ShortTermMemory {
    return this.shortTerm;
  }

  getLongTerm(): LongTermMemory {
    return this.longTerm;
  }

  getEntities(): EntityMemory {
    return this.entities;
  }

  /**
   * Clear all memories
   */
  async clearAll(): Promise<void> {
    this.shortTerm.clear();
    await this.longTerm.clear();
    this.entities.clear();
    this.logger.info('Cleared all memory systems');
  }

  /**
   * Get statistics
   */
  getStats(): {
    shortTerm: { messages: number };
    longTerm: { total: number; byType: Record<string, number> };
    entities: { total: number; byType: Record<string, number> };
  } {
    return {
      shortTerm: { messages: this.shortTerm.getAll().memories.length },
      longTerm: this.longTerm.getStats(),
      entities: this.entities.getStats(),
    };
  }
}

// ============================================================================
// MEMORY BUILDER
// ============================================================================

/**
 * Builder for creating memory systems
 */
export class MemoryBuilder {
  private shortTermConfig?: ShortTermMemoryConfig;
  private longTermConfig?: LongTermMemoryConfig;

  static create(): MemoryBuilder {
    return new MemoryBuilder();
  }

  withShortTermMemory(config: ShortTermMemoryConfig): this {
    this.shortTermConfig = config;
    return this;
  }

  withLongTermMemory(config: LongTermMemoryConfig): this {
    this.longTermConfig = config;
    return this;
  }

  build(): MemorySystem {
    return new MemorySystem(this.shortTermConfig, this.longTermConfig);
  }
}
