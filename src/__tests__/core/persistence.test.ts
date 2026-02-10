import { FileStorageAdapter, WorkflowState } from '../../core/persistence';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FileStorageAdapter', () => {
  const TEST_DIR = path.join(__dirname, '.tmp-persistence-test');
  let adapter: FileStorageAdapter;

  beforeEach(async () => {
    // Ensure clean state
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
    adapter = new FileStorageAdapter({ baseDir: TEST_DIR });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('should save and load state correctly', async () => {
    const state: WorkflowState = {
      executionId: 'exec-1',
      status: 'paused',
      queue: ['node-1'],
      results: [
        ['node-0', { agentId: 'a1', taskId: 't1', output: 'res', success: true, timestamp: 123 }],
      ],
      sharedData: [['key', 'value']],
      iterationCounts: [],
      executionPath: ['node-0'],
      messageHistory: [],
      timestamp: Date.now(),
    };

    await adapter.save('exec-1', state);

    const loaded = await adapter.load('exec-1');
    expect(loaded).toBeDefined();
    expect(loaded?.executionId).toBe('exec-1');
    expect(loaded?.status).toBe('paused');
    expect(loaded?.results).toHaveLength(1);
    expect(loaded?.sharedData).toHaveLength(1);
    expect(loaded?.sharedData[0]).toEqual(['key', 'value']);
  });

  test('should return null for non-existent state', async () => {
    const loaded = await adapter.load('non-existent');
    expect(loaded).toBeNull();
  });

  test('should delete state', async () => {
    const state: WorkflowState = {
      executionId: 'exec-del',
      status: 'active',
      queue: [],
      results: [],
      sharedData: [],
      iterationCounts: [],
      executionPath: [],
      messageHistory: [],
      timestamp: Date.now(),
    };

    await adapter.save('exec-del', state);
    await adapter.delete('exec-del');

    const loaded = await adapter.load('exec-del');
    expect(loaded).toBeNull();
  });

  test('should list saved executions', async () => {
    const state1 = { ...mockState(), executionId: 'exec-A' };
    const state2 = { ...mockState(), executionId: 'exec-B' };

    await adapter.save('exec-A', state1);
    await adapter.save('exec-B', state2);

    const list = await adapter.list();
    expect(list).toHaveLength(2);
    expect(list).toContain('exec-A');
    expect(list).toContain('exec-B');
  });
});

function mockState(): WorkflowState {
  return {
    executionId: 'test',
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
