import { WorkerPool } from '../utils/worker-pool';

describe('WorkerPool', () => {
  // Mock console pour éviter les logs dans la sortie des tests
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
  it('should execute tasks in parallel', async () => {
    const pool = new WorkerPool(3);
    const results: number[] = [];

    const tasks = [1, 2, 3, 4, 5].map((n): (() => Promise<number>) => async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(n);
      return n;
    });

    await Promise.all(tasks.map((task) => pool.submit(task)));

    expect(results).toHaveLength(5);
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should limit concurrent executions', async () => {
    const pool = new WorkerPool(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async (): Promise<void> => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 50));
      concurrent--;
    };

    await Promise.all([pool.submit(task), pool.submit(task), pool.submit(task), pool.submit(task)]);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should handle task errors', async () => {
    const pool = new WorkerPool(2);

    const errorTask = async (): Promise<string> => {
      throw new Error('Task failed');
    };

    await expect(pool.submit(errorTask)).rejects.toThrow('Task failed');
  });

  it('should stop accepting new tasks after stop', async () => {
    const pool = new WorkerPool(2);

    const task = async (): Promise<string> => {
      return 'success';
    };

    pool.stop();

    await expect(pool.submit(task)).rejects.toThrow('Worker pool has been stopped');
  });

  it('should provide stats', () => {
    const pool = new WorkerPool(3);

    expect(pool.stats).toEqual({
      running: 0,
      queued: 0,
    });
  });
});
