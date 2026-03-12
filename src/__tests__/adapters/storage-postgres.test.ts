/**
 * @fileoverview Tests for PostgresStorageAdapter
 *
 * Uses an in-memory mock PostgreSQL pool so no real database is needed.
 */

import { PostgresStorageAdapter, PostgresPool } from '../../adapters/storage-postgres';
import { WorkflowState } from '../../core/persistence';

// ---------------------------------------------------------------------------
// In-memory mock PostgreSQL pool
// ---------------------------------------------------------------------------

function makeMockPool(): PostgresPool & {
  _states: Map<string, { state: unknown; status: string }>;
} {
  const states = new Map<string, { state: unknown; status: string }>();

  return {
    _states: states,

    async query(text: string, values?: unknown[]) {
      const sql = text.trim().replace(/\s+/g, ' ').toLowerCase();

      // CREATE TABLE — no-op
      if (sql.startsWith('create table') || sql.startsWith('\n      create table')) {
        return { rows: [], rowCount: 0 };
      }

      // INSERT … ON CONFLICT
      if (sql.includes('insert into') && sql.includes('on conflict')) {
        const [id, stateJson, status] = values as [string, string, string];
        const stateObj = JSON.parse(stateJson);
        states.set(id, { state: stateObj, status });
        return { rows: [], rowCount: 1 };
      }

      // SELECT state FROM … WHERE id = $1
      if (sql.includes('select state from') && values) {
        const [id] = values as [string];
        const row = states.get(id);
        if (!row) return { rows: [], rowCount: 0 };
        return { rows: [{ state: row.state }], rowCount: 1 };
      }

      // DELETE FROM … WHERE id = $1
      if (sql.includes('delete from') && values && values.length === 1) {
        const [id] = values as [string];
        states.delete(id);
        return { rows: [], rowCount: 1 };
      }

      // SELECT id FROM … WHERE status = $1
      if (sql.includes('select id from') && values && values.length === 1) {
        const [status] = values as [string];
        const rows = Array.from(states.entries())
          .filter(([, v]) => v.status === status)
          .map(([id]) => ({ id }));
        return { rows, rowCount: rows.length };
      }

      // SELECT id FROM … (no WHERE — list all)
      if (sql.includes('select id from')) {
        const rows = Array.from(states.keys()).map((id) => ({ id }));
        return { rows, rowCount: rows.length };
      }

      // DELETE old rows (cleanup)
      if (sql.includes('delete from') && sql.includes('interval')) {
        // Simulate removing completed/failed entries
        let removed = 0;
        for (const [id, row] of states) {
          if (row.status === 'completed' || row.status === 'failed') {
            states.delete(id);
            removed++;
          }
        }
        return { rows: [], rowCount: removed };
      }

      return { rows: [], rowCount: 0 };
    },

    async end() {},
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(id: string, status: WorkflowState['status'] = 'active'): WorkflowState {
  return {
    executionId: id,
    status,
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

describe('PostgresStorageAdapter', () => {
  let mockPool: ReturnType<typeof makeMockPool>;
  let adapter: PostgresStorageAdapter;

  beforeEach(async () => {
    mockPool = makeMockPool();
    adapter = new PostgresStorageAdapter({
      pool: mockPool,
      tableName: 'test_states',
      schemaName: 'public',
    });
    await adapter.initialize();
  });

  it('saves and loads a state', async () => {
    const state = makeState('pg-test-1');
    await adapter.save(state.executionId, state);
    const loaded = await adapter.load(state.executionId);
    expect(loaded).toBeDefined();
    expect(loaded!.executionId).toBe(state.executionId);
  });

  it('returns null for unknown ID', async () => {
    const result = await adapter.load('does-not-exist-pg');
    expect(result).toBeNull();
  });

  it('deletes a state', async () => {
    const state = makeState('pg-test-2');
    await adapter.save(state.executionId, state);
    await adapter.delete(state.executionId);
    const loaded = await adapter.load(state.executionId);
    expect(loaded).toBeNull();
  });

  it('lists saved states', async () => {
    const state = makeState('pg-test-3');
    await adapter.save(state.executionId, state);
    const ids = await adapter.list();
    expect(ids).toContain(state.executionId);
  });

  it('listByStatus returns only matching states', async () => {
    const activeState = makeState('pg-test-active', 'active');
    const completedState = makeState('pg-test-completed', 'completed');
    await adapter.save(activeState.executionId, activeState);
    await adapter.save(completedState.executionId, completedState);

    const activeIds = await adapter.listByStatus('active');
    const completedIds = await adapter.listByStatus('completed');

    expect(activeIds).toContain('pg-test-active');
    expect(completedIds).toContain('pg-test-completed');
    expect(activeIds).not.toContain('pg-test-completed');
  });

  it('round-trips complex state', async () => {
    const state = makeState('pg-test-roundtrip');
    state.sharedData = [['key', 'value']] as [string, unknown][];
    state.messageHistory = [
      {
        from: 'a',
        to: 'b',
        type: 'data' as const,
        content: 'ping',
        timestamp: Date.now(),
        messageId: 'msg-1',
      },
    ];
    await adapter.save(state.executionId, state);
    const loaded = await adapter.load(state.executionId);
    expect(loaded!.messageHistory).toHaveLength(1);
    expect(loaded!.sharedData).toHaveLength(1);
  });

  it('cleanup removes completed and failed states', async () => {
    await adapter.save('pg-active', makeState('pg-active', 'active'));
    await adapter.save('pg-done', makeState('pg-done', 'completed'));
    const removed = await adapter.cleanup(0);
    expect(removed).toBeGreaterThanOrEqual(1);
    const ids = await adapter.list();
    expect(ids).toContain('pg-active');
  });
});
