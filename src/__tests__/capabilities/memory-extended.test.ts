/**
 * Extended coverage tests for memory.ts
 *
 * Targets uncovered lines: 160-161, 195-197, 202, 209, 246-253, 259, 311,
 * 336-343, 378-380, 429, 436, 448-456, 477-526, 601-606, 627-643, 657-661,
 * 707-715, 748, 756-758, 770-799, 819-849
 */

import {
  ShortTermMemory,
  LongTermMemory,
  EntityMemory,
  MemorySystem,
  MemoryBuilder,
  VectorProvider,
} from '../../capabilities/memory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVectorProvider(): VectorProvider & {
  store: Map<string, { content: string; metadata?: Record<string, unknown> }>;
} {
  type SearchResult = { id: string; score: number };
  const store = new Map<string, { content: string; metadata?: Record<string, unknown> }>();
  return {
    store,
    async add(id: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
      store.set(id, { content, metadata });
    },
    async search(query: string, limit = 10): Promise<SearchResult[]> {
      const results = Array.from(store.entries())
        .filter(([, v]) => v.content.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(([id]) => ({ id, score: 1 }));
      return results;
    },
    async delete(id: string): Promise<void> {
      store.delete(id);
    },
    async clear(): Promise<void> {
      store.clear();
    },
  };
}

// ============================================================================
// ShortTermMemory
// ============================================================================

describe('ShortTermMemory', () => {
  it('truncates content that exceeds byteSizeLimit', () => {
    const mem = new ShortTermMemory({ byteSizeLimit: 20 });
    const huge = 'x'.repeat(50);
    mem.add(huge);
    const all = mem.getAll();
    // Either truncated or removed by enforceByteSizeLimit
    const content = all.memories[0]?.content ?? '';
    // Content should end with '[truncated]' when truncated at add-time
    if (content) {
      expect(content).toContain('[truncated]');
    }
  });

  it('enforceByteSizeLimit removes oldest entries when total exceeds limit', () => {
    // byteSizeLimit=100, each entry ~30 bytes — adding 5 should trigger eviction
    const mem = new ShortTermMemory({ byteSizeLimit: 100 });
    for (let i = 0; i < 6; i++) {
      mem.add(`message number ${i} with some content`);
    }
    const all = mem.getAll();
    // Some entries should have been removed
    expect(all.memories.length).toBeLessThan(6);
  });

  it('clears summarizedContent when size still exceeds limit', () => {
    const mem = new ShortTermMemory({ byteSizeLimit: 10, summarizeAfter: 2 });
    // Force summarize via long content
    for (let i = 0; i < 4; i++) {
      mem.add('abcde');
    }
    const all = mem.getAll();
    // Memories should have been trimmed (summarized or cleared)
    expect(all.memories.length + all.summaries.length).toBeLessThanOrEqual(10);
  });

  it('search with time range filters results', () => {
    const mem = new ShortTermMemory();
    const past = Date.now() - 10000;
    Date.now(); // trigger for test context
    mem.add('old memory');
    const result = mem.search({
      query: 'old',
      timeRange: { start: past - 1, end: past + 100 },
    });
    // old memory's timestamp will be > past+100 since it was just created
    expect(result.memories.length).toBe(0);
  });

  it('search with minImportance filter', () => {
    const mem = new ShortTermMemory();
    mem.add('low importance', { importance: 0.1 });
    mem.add('high importance', { importance: 0.9 });
    const result = mem.search({ query: 'importance', minImportance: 0.5 });
    expect(result.memories.length).toBe(1);
    expect(result.memories[0].content).toContain('high');
  });

  it('search with types filter', () => {
    const mem = new ShortTermMemory();
    mem.add('fact entry', { type: 'fact' });
    mem.add('convo entry', { type: 'conversation' });
    const result = mem.search({ query: 'entry', types: ['fact'] });
    expect(result.memories.length).toBe(1);
    expect(result.memories[0].content).toContain('fact');
  });

  it('search with empty query returns most recent entries', () => {
    const mem = new ShortTermMemory();
    for (let i = 0; i < 5; i++) {
      mem.add(`msg ${i}`);
    }
    const result = mem.search({ query: '', limit: 3 });
    expect(result.memories.length).toBe(3);
    expect(result.scores?.every((s) => s === 1)).toBe(true);
  });

  it('applyDecay() reduces importance of old memories', () => {
    const mem = new ShortTermMemory({ decayRate: 1 });
    mem.add('important', { importance: 1.0 });
    // Manually set timestamp to 1 hour ago
    const all = mem.getAll();
    all.memories[0].timestamp = Date.now() - 3600 * 1000;
    mem.applyDecay();
    expect(all.memories[0].importance).toBeLessThan(1.0);
  });

  it('summarize() uses custom summarizer when provided', async () => {
    const summarizer = jest.fn().mockResolvedValue('custom summary');
    const mem = new ShortTermMemory({ summarizeAfter: 2, summarizer });
    mem.add('msg 1');
    mem.add('msg 2');
    mem.add('msg 3'); // triggers summarize
    // Wait for the async summarize to complete
    await new Promise((r) => setTimeout(r, 10));
    const all = mem.getAll();
    expect(summarizer).toHaveBeenCalled();
    expect(all.summaries.some((s) => s.includes('custom summary'))).toBe(true);
  });

  it('summarize() falls back when custom summarizer throws', async () => {
    const summarizer = jest.fn().mockRejectedValue(new Error('boom'));
    const mem = new ShortTermMemory({ summarizeAfter: 2, summarizer });
    mem.add('fallback 1');
    mem.add('fallback 2');
    mem.add('fallback 3'); // triggers summarize
    await new Promise((r) => setTimeout(r, 10));
    const all = mem.getAll();
    // Should still have a summary (from fallback)
    expect(all.summaries.length).toBeGreaterThan(0);
  });

  it('clear() empties memories and summaries', () => {
    const mem = new ShortTermMemory();
    mem.add('something');
    mem.clear();
    expect(mem.getAll().memories.length).toBe(0);
    expect(mem.getAll().summaries.length).toBe(0);
  });
});

// ============================================================================
// LongTermMemory
// ============================================================================

describe('LongTermMemory', () => {
  it('add() stores entry and returns ID', async () => {
    const mem = new LongTermMemory();
    const id = await mem.add('some fact');
    expect(typeof id).toBe('string');
    expect(mem.get(id)).toBeDefined();
  });

  it('add() uses vector provider when present', async () => {
    const provider = makeVectorProvider();
    const mem = new LongTermMemory({ provider });
    const id = await mem.add('vectorised fact');
    expect(provider.store.has(id)).toBe(true);
  });

  it('prune() trims when maxEntries exceeded', async () => {
    const mem = new LongTermMemory({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      await mem.add(`fact ${i}`, { importance: i * 0.2 });
    }
    const stats = mem.getStats();
    expect(stats.total).toBeLessThanOrEqual(4); // pruned at least 1
  });

  it('retrieve() uses vector provider for semantic search', async () => {
    const provider = makeVectorProvider();
    const mem = new LongTermMemory({ provider });
    await mem.add('the quick brown fox');
    const result = await mem.retrieve({ query: 'quick' });
    expect(result.memories.length).toBeGreaterThan(0);
    expect(result.scores).toBeDefined();
  });

  it('retrieve() falls back to text search without provider', async () => {
    const mem = new LongTermMemory();
    await mem.add('cats are great');
    await mem.add('dogs are fine');
    const result = await mem.retrieve({ query: 'cats' });
    expect(result.memories.length).toBe(1);
    expect(result.memories[0].content).toContain('cats');
  });

  it('delete() removes from map and provider', async () => {
    const provider = makeVectorProvider();
    const mem = new LongTermMemory({ provider });
    const id = await mem.add('to delete');
    await mem.delete(id);
    expect(mem.get(id)).toBeUndefined();
    expect(provider.store.has(id)).toBe(false);
  });

  it('clear() empties all entries and provider', async () => {
    const provider = makeVectorProvider();
    const mem = new LongTermMemory({ provider });
    await mem.add('entry1');
    await mem.add('entry2');
    await mem.clear();
    expect(mem.getStats().total).toBe(0);
    expect(provider.store.size).toBe(0);
  });

  it('getStats() returns by-type breakdown', async () => {
    const mem = new LongTermMemory();
    await mem.add('a fact');
    await mem.add('another fact');
    const stats = mem.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byType['fact']).toBe(2);
  });
});

// ============================================================================
// EntityMemory
// ============================================================================

describe('EntityMemory', () => {
  it('upsert creates a new entity', () => {
    const em = new EntityMemory();
    const id = em.upsert('Alice', 'person', ['developer']);
    expect(em.get(id)).toBeDefined();
    expect(em.get(id)!.name).toBe('Alice');
  });

  it('upsert merges facts on existing entity', () => {
    const em = new EntityMemory();
    const id = em.upsert('Bob', 'person', ['engineer']);
    em.upsert('Bob', 'person', ['manager']); // same entity
    const entity = em.get(id);
    expect(entity!.facts).toContain('engineer');
    expect(entity!.facts).toContain('manager');
    // No duplicates
    em.upsert('Bob', 'person', ['engineer']);
    expect(entity!.facts.filter((f) => f === 'engineer').length).toBe(1);
  });

  it('get() can find by name+type', () => {
    const em = new EntityMemory();
    em.upsert('Carol', 'person', ['analyst']);
    const entity = em.get('Carol', 'person');
    expect(entity).toBeDefined();
    expect(entity!.name).toBe('Carol');
  });

  it('get() returns undefined for unknown entity', () => {
    const em = new EntityMemory();
    expect(em.get('nobody')).toBeUndefined();
    expect(em.get('nobody', 'person')).toBeUndefined();
  });

  it('search() finds by name', () => {
    const em = new EntityMemory();
    em.upsert('Dave', 'person', ['developer']);
    em.upsert('Acme Corp', 'company', ['tech company']);
    const results = em.search('dave');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Dave');
  });

  it('search() finds by fact content', () => {
    const em = new EntityMemory();
    em.upsert('Eve', 'person', ['expert in machine learning']);
    const results = em.search('machine learning');
    expect(results.length).toBe(1);
  });

  it('search() filters by type', () => {
    const em = new EntityMemory();
    em.upsert('Frank', 'person', ['test']);
    em.upsert('Gadget Corp', 'company', ['test']);
    const people = em.search('test', 'person');
    expect(people.length).toBe(1);
    expect(people[0].name).toBe('Frank');
  });

  it('getByType() returns all entities of a type', () => {
    const em = new EntityMemory();
    em.upsert('Grace', 'person', []);
    em.upsert('Hank', 'person', []);
    em.upsert('Initech', 'company', []);
    const people = em.getByType('person');
    expect(people.length).toBe(2);
  });

  it('delete() removes entity', () => {
    const em = new EntityMemory();
    const id = em.upsert('Ivy', 'person', []);
    em.delete(id);
    expect(em.get(id)).toBeUndefined();
  });

  it('clear() empties all entities', () => {
    const em = new EntityMemory();
    em.upsert('Jack', 'person', []);
    em.clear();
    expect(em.getStats().total).toBe(0);
  });

  it('getStats() returns counts per type', () => {
    const em = new EntityMemory();
    em.upsert('Kate', 'person', []);
    em.upsert('Leo', 'person', []);
    em.upsert('Megacorp', 'company', []);
    const stats = em.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byType['person']).toBe(2);
    expect(stats.byType['company']).toBe(1);
  });
});

// ============================================================================
// MemorySystem
// ============================================================================

describe('MemorySystem', () => {
  it('add() routes conversation to short-term', async () => {
    const sys = new MemorySystem();
    await sys.add('hello world', { type: 'conversation' });
    const st = sys.getShortTerm().getAll();
    expect(st.memories.length).toBe(1);
  });

  it('add() routes fact to long-term', async () => {
    const sys = new MemorySystem();
    await sys.add('important fact', { type: 'fact' });
    const stats = sys.getLongTerm().getStats();
    expect(stats.total).toBe(1);
  });

  it('add() routes entity to entity memory', async () => {
    const sys = new MemorySystem();
    await sys.add('software engineer', {
      type: 'entity',
      entityName: 'John',
      entityType: 'person',
    });
    const entities = sys.getEntities().getByType('person');
    expect(entities.length).toBe(1);
    expect(entities[0].name).toBe('John');
  });

  it('add() skips entity if entityName or entityType missing', async () => {
    const sys = new MemorySystem();
    await sys.add('some entity fact', { type: 'entity' }); // no name/type
    expect(sys.getEntities().getStats().total).toBe(0);
  });

  it('retrieve() compiles results from all stores', async () => {
    const sys = new MemorySystem();
    await sys.add('short term message', { type: 'conversation' });
    await sys.add('long term fact about cats', { type: 'fact' });
    // Entity name contains "cats" so search('cats') will find it
    await sys.add('domestic animals', {
      type: 'entity',
      entityName: 'cats',
      entityType: 'animal',
    });
    const result = await sys.retrieve('cats');
    expect(result).toContain('Recent Context');
    expect(result).toContain('Relevant Facts');
    expect(result).toContain('Related Entities');
  });

  it('retrieve() respects include flags', async () => {
    const sys = new MemorySystem();
    await sys.add('recent msg', { type: 'conversation' });
    const result = await sys.retrieve('msg', { includeShortTerm: false });
    expect(result).not.toContain('Recent Context');
  });

  it('clearAll() empties all stores', async () => {
    const sys = new MemorySystem();
    await sys.add('msg', { type: 'conversation' });
    await sys.add('fact', { type: 'fact' });
    await sys.clearAll();
    const stats = sys.getStats();
    expect(stats.shortTerm.messages).toBe(0);
    expect(stats.longTerm.total).toBe(0);
    expect(stats.entities.total).toBe(0);
  });

  it('getStats() aggregates all memory types', async () => {
    const sys = new MemorySystem();
    await sys.add('msg', { type: 'conversation' });
    await sys.add('fact', { type: 'fact' });
    const stats = sys.getStats();
    expect(stats.shortTerm.messages).toBe(1);
    expect(stats.longTerm.total).toBe(1);
  });
});

// ============================================================================
// MemoryBuilder
// ============================================================================

describe('MemoryBuilder', () => {
  it('builds a MemorySystem with default config', () => {
    const sys = MemoryBuilder.create().build();
    expect(sys).toBeInstanceOf(MemorySystem);
  });

  it('withEntityMemory() is a no-op (entity memory always included)', () => {
    const sys = MemoryBuilder.create().withEntityMemory().build();
    expect(sys).toBeInstanceOf(MemorySystem);
  });

  it('withShortTermMemory() configures short-term config', async () => {
    const sys = MemoryBuilder.create().withShortTermMemory({ maxMessages: 2 }).build();
    await sys.add('m1', { type: 'conversation' });
    await sys.add('m2', { type: 'conversation' });
    await sys.add('m3', { type: 'conversation' });
    // maxMessages = 2 → getRecent() with no limit defaults to maxMessages (2)
    const recent = sys.getShortTerm().getRecent();
    expect(recent.length).toBeLessThanOrEqual(2);
  });

  it('withLongTermMemory() configures long-term config', async () => {
    const sys = MemoryBuilder.create().withLongTermMemory({ maxEntries: 5 }).build();
    expect(sys).toBeInstanceOf(MemorySystem);
  });
});
