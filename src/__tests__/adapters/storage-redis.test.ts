/**
 * @fileoverview Tests for RedisStorageAdapter
 *
 * Uses an in-memory mock Redis client so no real Redis is needed.
 * When TEST_REDIS is set, additional integration-style assertions can be enabled.
 */

import { RedisStorageAdapter, RedisClient } from '../../adapters/storage-redis';
import { WorkflowState } from '../../core/persistence';

// ---------------------------------------------------------------------------
// In-memory mock Redis client
// ---------------------------------------------------------------------------

function makeMockRedisClient(): RedisClient & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]) {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    },
    async setex(key: string, _seconds: number, value: string) {
      store.set(key, value);
      return 'OK';
    },
    async keys(pattern: string) {
      const prefix = pattern.replace('*', '');
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    },
    async scan(
      cursor: string,
      _matchOption: 'MATCH',
      pattern: string,
      _countOption: 'COUNT',
      _count: number
    ): Promise<[string, string[]]> {
      const prefix = pattern.replace('*', '');
      const keys = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
      // Single-pass scan — return all keys and signal done with cursor '0'
      return cursor === '0' ? ['0', keys] : ['0', []];
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(id: string): WorkflowState {
  return {
    executionId: id,
    status: 'active',
    queue: [],
    results: [],
    sharedData: [],
    iterationCounts: [],
    executionPath: [],
    messageHistory: [],
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RedisStorageAdapter', () => {
  let mockClient: ReturnType<typeof makeMockRedisClient>;
  let adapter: RedisStorageAdapter;
  const testPrefix = 'test:';

  beforeEach(() => {
    mockClient = makeMockRedisClient();
    adapter = new RedisStorageAdapter({
      client: mockClient,
      keyPrefix: testPrefix,
      ttl: 0,
    });
  });

  it('saves and loads a state', async () => {
    const state = makeState('redis-test-1');
    await adapter.save(state.executionId, state);
    const loaded = await adapter.load(state.executionId);
    expect(loaded).toBeDefined();
    expect(loaded!.executionId).toBe(state.executionId);
    expect(loaded!.status).toBe('active');
  });

  it('returns null for unknown ID', async () => {
    const result = await adapter.load('definitely-does-not-exist');
    expect(result).toBeNull();
  });

  it('deletes a state', async () => {
    const state = makeState('redis-test-2');
    await adapter.save(state.executionId, state);
    await adapter.delete(state.executionId);
    const loaded = await adapter.load(state.executionId);
    expect(loaded).toBeNull();
  });

  it('lists saved states', async () => {
    const state = makeState('redis-test-3');
    await adapter.save(state.executionId, state);
    const ids = await adapter.list();
    expect(ids).toContain(state.executionId);
  });

  it('round-trips complex state (sharedData, messageHistory)', async () => {
    const state = makeState('redis-test-4');
    state.sharedData = [
      ['key', 'value'],
      ['count', 42],
    ] as [string, unknown][];
    state.messageHistory = [
      {
        from: 'a',
        to: 'b',
        type: 'data' as const,
        content: 'hello',
        timestamp: Date.now(),
        messageId: 'msg-1',
      },
    ];
    await adapter.save(state.executionId, state);
    const loaded = await adapter.load(state.executionId);
    expect(loaded!.sharedData).toEqual(state.sharedData);
    expect(loaded!.messageHistory).toHaveLength(1);
    expect(loaded!.messageHistory[0].content).toBe('hello');
  });

  it('uses setex when TTL is configured', async () => {
    const ttlAdapter = new RedisStorageAdapter({
      client: mockClient,
      keyPrefix: testPrefix,
      ttl: 60,
    });
    const spy = jest.spyOn(mockClient, 'setex');
    await ttlAdapter.save('ttl-test', makeState('ttl-test'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('ttl-test'), 60, expect.any(String));
  });
});
