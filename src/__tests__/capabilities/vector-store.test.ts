/**
 * Tests for VectorStoreAdapter — bridges InMemoryVectorStore ↔ VectorProvider
 */

import {
  InMemoryVectorStore,
  VectorStoreAdapter,
  EmbeddingFunction,
} from '../../capabilities/vector-store';
import { VectorProvider } from '../../capabilities/memory';

describe('VectorStoreAdapter', () => {
  let store: InMemoryVectorStore;
  let embed: EmbeddingFunction;
  let adapter: VectorStoreAdapter;

  beforeEach(() => {
    store = new InMemoryVectorStore({ dimensions: 3 });
    // Simple deterministic embedding: hash text to 3D vector
    embed = async (text: string): Promise<number[]> => {
      const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return [(hash % 10) / 10, ((hash * 7) % 10) / 10, ((hash * 13) % 10) / 10];
    };
    adapter = new VectorStoreAdapter(store, embed);
  });

  test('should implement VectorProvider interface', () => {
    // TypeScript ensures compile-time compliance, but let's verify at runtime
    const provider: VectorProvider = adapter;
    expect(typeof provider.add).toBe('function');
    expect(typeof provider.search).toBe('function');
    expect(typeof provider.delete).toBe('function');
    expect(typeof provider.clear).toBe('function');
  });

  test('add() should embed text and store vector with metadata', async () => {
    await adapter.add('doc-1', 'hello world', { source: 'test' });

    const entry = await store.get('doc-1');
    expect(entry).not.toBeNull();
    expect(entry!.vector).toHaveLength(3);
    expect(entry!.metadata).toEqual(
      expect.objectContaining({ source: 'test', text: 'hello world' })
    );
  });

  test('add() should work without metadata', async () => {
    await adapter.add('doc-2', 'no metadata');

    const entry = await store.get('doc-2');
    expect(entry).not.toBeNull();
    expect(entry!.metadata).toEqual(expect.objectContaining({ text: 'no metadata' }));
  });

  test('search() should embed query and return results with scores', async () => {
    await adapter.add('doc-1', 'hello');
    await adapter.add('doc-2', 'world');
    await adapter.add('doc-3', 'hello world');

    const results = await adapter.search('hello', 2);
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('score');
    expect(typeof results[0].score).toBe('number');
    expect(results[0].score).toBeGreaterThanOrEqual(0);
    expect(results[0].score).toBeLessThanOrEqual(1);
  });

  test('search() should respect limit', async () => {
    for (let i = 0; i < 10; i++) {
      await adapter.add(`doc-${i}`, `text-${i}`);
    }

    const results = await adapter.search('text', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test('delete() should remove entry from store', async () => {
    await adapter.add('doc-1', 'hello');
    expect(await store.get('doc-1')).not.toBeNull();

    await adapter.delete('doc-1');
    expect(await store.get('doc-1')).toBeNull();
  });

  test('clear() should remove all entries', async () => {
    await adapter.add('doc-1', 'hello');
    await adapter.add('doc-2', 'world');
    expect(store.stats().count).toBe(2);

    await adapter.clear();
    expect(store.stats().count).toBe(0);
  });

  test('should use the provided embedding function', async () => {
    let embedCallCount = 0;
    const trackedEmbed: EmbeddingFunction = async (_text) => {
      embedCallCount++;
      return [1, 0, 0]; // constant vector
    };

    const trackedAdapter = new VectorStoreAdapter(store, trackedEmbed);
    await trackedAdapter.add('id1', 'some text');
    expect(embedCallCount).toBe(1);

    await trackedAdapter.search('query', 5);
    expect(embedCallCount).toBe(2); // add + search
  });
});

// ============================================================================
// Additional InMemoryVectorStore tests for uncovered lines
// ============================================================================

describe('InMemoryVectorStore — additional coverage', () => {
  test('upsertBatch should insert multiple entries', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    await store.upsertBatch([
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0, 1] },
      { id: 'c', vector: [1, 1] },
    ]);
    expect(store.stats().count).toBe(3);
  });

  test('search with euclidean distance', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2, distance: 'euclidean' });
    await store.upsert({ id: 'close', vector: [1, 0] });
    await store.upsert({ id: 'far', vector: [10, 10] });

    const results = await store.search([1, 0], { topK: 2 });
    expect(results.length).toBe(2);
    // Close vector should have higher similarity
    expect(results[0].entry.id).toBe('close');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  test('search with dotProduct distance', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2, distance: 'dotProduct' });
    await store.upsert({ id: 'a', vector: [1, 0] });
    await store.upsert({ id: 'b', vector: [0, 1] });

    const results = await store.search([1, 0], { topK: 2 });
    expect(results.length).toBe(2);
    expect(results[0].entry.id).toBe('a'); // aligned vector should score higher
  });

  test('search should filter by metadata', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    await store.upsert({ id: 'a', vector: [1, 0], metadata: { type: 'doc' } });
    await store.upsert({ id: 'b', vector: [1, 0], metadata: { type: 'code' } });

    const results = await store.search([1, 0], { filter: { type: 'doc' } });
    expect(results.length).toBe(1);
    expect(results[0].entry.id).toBe('a');
  });

  test('search with topK=0 returns all results (no short-circuit)', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    await store.upsert({ id: 'a', vector: [1, 0] });

    const results = await store.search([1, 0], { topK: 0 });
    // Implementation does not short-circuit on topK=0
    expect(results.length).toBeGreaterThan(0);
  });

  test('FIFO eviction when maxEntries exceeded', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2, maxEntries: 2 });
    await store.upsert({ id: 'first', vector: [1, 0] });
    await store.upsert({ id: 'second', vector: [0, 1] });
    await store.upsert({ id: 'third', vector: [1, 1] });

    expect(store.stats().count).toBe(2);
    expect(await store.get('first')).toBeNull(); // evicted
    expect(await store.get('second')).not.toBeNull();
    expect(await store.get('third')).not.toBeNull();
  });

  test('upsert should update existing entry without eviction', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2, maxEntries: 2 });
    await store.upsert({ id: 'a', vector: [1, 0] });
    await store.upsert({ id: 'b', vector: [0, 1] });
    // Update existing — should NOT evict
    await store.upsert({ id: 'a', vector: [0.5, 0.5] });

    expect(store.stats().count).toBe(2);
    const updated = await store.get('a');
    expect(updated!.vector).toEqual([0.5, 0.5]);
  });

  test('upsert should reject wrong dimensions', async () => {
    const store = new InMemoryVectorStore({ dimensions: 3 });
    await expect(store.upsert({ id: 'bad', vector: [1, 2] })).rejects.toThrow('dimension mismatch');
  });

  test('search should reject wrong query dimensions', async () => {
    const store = new InMemoryVectorStore({ dimensions: 3 });
    await expect(store.search([1, 2])).rejects.toThrow('dimension mismatch');
  });

  test('get should return null for missing entry', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    expect(await store.get('nonexistent')).toBeNull();
  });

  test('delete should return false for missing entry', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    expect(await store.delete('nonexistent')).toBe(false);
  });

  test('stats should estimate memory', async () => {
    const store = new InMemoryVectorStore({ dimensions: 1536 });
    await store.upsert({ id: 'a', vector: new Array(1536).fill(0.1) });

    const stats = store.stats();
    expect(stats.count).toBe(1);
    expect(stats.dimensions).toBe(1536);
    expect(stats.memoryEstimateMB).toBeGreaterThan(0);
  });

  test('metadata filter should reject entries without metadata', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    await store.upsert({ id: 'no-meta', vector: [1, 0] }); // no metadata
    await store.upsert({ id: 'has-meta', vector: [1, 0], metadata: { type: 'doc' } });

    const results = await store.search([1, 0], { filter: { type: 'doc' } });
    expect(results.length).toBe(1);
    expect(results[0].entry.id).toBe('has-meta');
  });

  test('cosine similarity of zero vectors should return 0', async () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    await store.upsert({ id: 'zero', vector: [0, 0] });

    const results = await store.search([0, 0]);
    // Zero vectors have no direction → similarity should be 0
    expect(results[0].score).toBe(0);
  });
});
