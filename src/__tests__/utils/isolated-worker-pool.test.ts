/**
 * Tests for Isolated Worker Pool
 */

import { IsolatedWorkerPool } from '../../utils/isolated-worker-pool';
import { Agent, ExecutionContext } from '../../core/types';

describe('IsolatedWorkerPool', () => {
  let pool: IsolatedWorkerPool;

  beforeEach(() => {
    pool = new IsolatedWorkerPool(2);
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('Initialization', () => {
    it('should create a pool with correct max workers', () => {
      expect(pool.stats.total).toBe(0);
      expect(pool.stats.available).toBe(0);
      expect(pool.stats.busy).toBe(0);
      expect(pool.stats.queued).toBe(0);
    });

    it('should allow custom max workers', () => {
      const customPool = new IsolatedWorkerPool(5);
      expect(customPool).toBeDefined();
      customPool.shutdown();
    });
  });

  describe('Task Execution', () => {
    it('should execute a simple task', async () => {
      const mockAgent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: {
          id: 'test-role',
          name: 'Test Role',
          systemPrompt: 'You are a test agent',
        },
        model: {
          name: () => 'test-model',
          process: async () => 'test output',
          supportsPromptType: () => true,
        },
      };

      const mockContext: ExecutionContext = {
        input: 'test input',
        sharedData: new Map(),
        taskResults: new Map(),
        messageHistory: [],
        metadata: {},
      };

      const result = await pool.execute({
        agent: mockAgent,
        input: 'test input',
        context: mockContext,
        options: {
          taskId: 'test-task',
        },
      });

      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.result.taskId).toBe('test-task');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple concurrent tasks', async () => {
      const mockAgent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: {
          id: 'test-role',
          name: 'Test Role',
          systemPrompt: 'You are a test agent',
        },
        model: {
          name: () => 'test-model',
          process: async () => 'test output',
          supportsPromptType: () => true,
        },
      };

      const mockContext: ExecutionContext = {
        input: 'test input',
        sharedData: new Map(),
        taskResults: new Map(),
        messageHistory: [],
        metadata: {},
      };

      const promises = Array.from({ length: 5 }, (_, i) =>
        pool.execute({
          agent: mockAgent,
          input: `test input ${i}`,
          context: mockContext,
          options: {
            taskId: `test-task-${i}`,
          },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.result.taskId).toBe(`test-task-${i}`);
      });
    });
  });

  describe('Pool Management', () => {
    it('should respect max workers limit', async () => {
      const pool = new IsolatedWorkerPool(2);

      const mockAgent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: {
          id: 'test-role',
          name: 'Test Role',
          systemPrompt: 'You are a test agent',
        },
        model: {
          name: () => 'test-model',
          process: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return 'test output';
          },
          supportsPromptType: () => true,
        },
      };

      const mockContext: ExecutionContext = {
        input: 'test input',
        sharedData: new Map(),
        taskResults: new Map(),
        messageHistory: [],
        metadata: {},
      };

      // Start 4 tasks (more than max workers)
      const promises = Array.from({ length: 4 }, (_, i) =>
        pool.execute({
          agent: mockAgent,
          input: `test input ${i}`,
          context: mockContext,
        })
      );

      // Give workers time to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have at most 2 busy workers
      expect(pool.stats.busy).toBeLessThanOrEqual(2);
      expect(pool.stats.queued).toBeGreaterThan(0);

      await Promise.all(promises);
      await pool.shutdown();
    });

    it('should provide accurate stats', async () => {
      expect(pool.stats.total).toBe(0);
      expect(pool.stats.available).toBe(0);

      const mockAgent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: {
          id: 'test-role',
          name: 'Test Role',
          systemPrompt: 'You are a test agent',
        },
        model: {
          name: () => 'test-model',
          process: async () => 'test output',
          supportsPromptType: () => true,
        },
      };

      const mockContext: ExecutionContext = {
        input: 'test input',
        sharedData: new Map(),
        taskResults: new Map(),
        messageHistory: [],
        metadata: {},
      };

      const promise = pool.execute({
        agent: mockAgent,
        input: 'test input',
        context: mockContext,
      });

      await promise;

      // After execution, worker should be available
      expect(pool.stats.total).toBeGreaterThan(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await pool.shutdown();

      expect(pool.stats.total).toBe(0);
      expect(pool.stats.available).toBe(0);
    });

    it('should reject tasks after shutdown', async () => {
      await pool.shutdown();

      const mockAgent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: {
          id: 'test-role',
          name: 'Test Role',
          systemPrompt: 'You are a test agent',
        },
        model: {
          name: () => 'test-model',
          process: async () => 'test output',
          supportsPromptType: () => true,
        },
      };

      const mockContext: ExecutionContext = {
        input: 'test input',
        sharedData: new Map(),
        taskResults: new Map(),
        messageHistory: [],
        metadata: {},
      };

      await expect(
        pool.execute({
          agent: mockAgent,
          input: 'test input',
          context: mockContext,
        })
      ).rejects.toThrow('Worker pool is shutting down');
    });
  });
});
