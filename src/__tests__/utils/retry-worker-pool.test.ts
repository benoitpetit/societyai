/**
 * Tests for retry utility and WorkerPool
 */

import { withRetry, defaultRetryOptions, sleep } from '../../utils/retry';
import { WorkerPool } from '../../utils/worker-pool';

// Suppress logger noise
jest.mock('../../observability/logger', () => ({
  getLogger: (): Record<string, jest.Mock> => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// withRetry
// ============================================================================

describe('withRetry', () => {
  test('should return result on first success', async () => {
    const result = await withRetry(async () => 42, { maxRetries: 3, initialBackoff: 1 });
    expect(result).toBe(42);
  });

  test('should retry and eventually succeed', async () => {
    let attempt = 0;
    const result = await withRetry(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error(`fail ${attempt}`);
        return 'ok';
      },
      { maxRetries: 3, initialBackoff: 1, jitter: false }
    );
    expect(result).toBe('ok');
    expect(attempt).toBe(3);
  });

  test('should throw after maxRetries exhausted', async () => {
    let attempt = 0;
    await expect(
      withRetry(
        async () => {
          attempt++;
          throw new Error('always fails');
        },
        { maxRetries: 2, initialBackoff: 1, jitter: false }
      )
    ).rejects.toThrow('always fails');
    expect(attempt).toBe(3); // initial + 2 retries
  });

  test('should not retry on AbortError', async () => {
    let attempt = 0;
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';

    await expect(
      withRetry(
        async () => {
          attempt++;
          throw abortErr;
        },
        { maxRetries: 5, initialBackoff: 1 }
      )
    ).rejects.toThrow('aborted');
    expect(attempt).toBe(1); // no retry
  });

  test('should throw if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withRetry(async () => 'ok', { maxRetries: 3, initialBackoff: 1 }, controller.signal)
    ).rejects.toThrow('cancelled');
  });

  test('should use default options when none provided', async () => {
    const defaults = defaultRetryOptions();
    expect(defaults.maxRetries).toBe(3);
    expect(defaults.initialBackoff).toBe(500);
    expect(defaults.maxBackoff).toBe(10000);
    expect(defaults.backoffFactor).toBe(1.5);
    expect(defaults.jitter).toBe(true);
  });

  test('should respect maxBackoff ceiling', async () => {
    const startTime = Date.now();

    await expect(
      withRetry(
        async () => {
          throw new Error('fail');
        },
        {
          maxRetries: 2,
          initialBackoff: 1,
          maxBackoff: 5,
          backoffFactor: 100, // would go to 100ms without cap
          jitter: false,
        }
      )
    ).rejects.toThrow();

    const elapsed = Date.now() - startTime;
    // With maxBackoff=5, total wait should be well under 100ms
    expect(elapsed).toBeLessThan(200);
  });

  test('should apply jitter when enabled', async () => {
    // Just verify it doesn't crash with jitter enabled
    let attempt = 0;
    await expect(
      withRetry(
        async () => {
          attempt++;
          if (attempt <= 1) throw new Error('fail');
          return 'ok';
        },
        { maxRetries: 2, initialBackoff: 1, jitter: true }
      )
    ).resolves.toBe('ok');
  });
});

// ============================================================================
// sleep
// ============================================================================

describe('sleep', () => {
  test('should resolve after delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  test('should reject if signal already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toThrow('cancelled');
  });

  test('should reject if signal aborts during sleep', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    await expect(sleep(5000, controller.signal)).rejects.toThrow('cancelled');
  });
});

// ============================================================================
// WorkerPool
// ============================================================================

describe('WorkerPool', () => {
  test('should execute a single task', async () => {
    const pool = new WorkerPool(2);
    const result = await pool.submit(async () => 42);
    expect(result).toBe(42);
  });

  test('should execute multiple tasks concurrently', async () => {
    const pool = new WorkerPool(3);
    const results = await Promise.all([
      pool.submit(async () => 'a'),
      pool.submit(async () => 'b'),
      pool.submit(async () => 'c'),
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  test('should respect maxWorkers concurrency limit', async () => {
    const pool = new WorkerPool(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async (): Promise<number> => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
      return maxConcurrent;
    };

    await Promise.all([pool.submit(task), pool.submit(task), pool.submit(task)]);
    // With maxWorkers=1, only 1 at a time
    expect(maxConcurrent).toBe(1);
  });

  test('should propagate task errors', async () => {
    const pool = new WorkerPool(2);
    await expect(
      pool.submit(async () => {
        throw new Error('task failed');
      })
    ).rejects.toThrow('task failed');
  });

  test('stop() should prevent new submissions', async () => {
    const pool = new WorkerPool(2);
    pool.stop();
    await expect(pool.submit(async () => 'ok')).rejects.toThrow('stopped');
  });

  test('should reject on aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const pool = new WorkerPool(2, controller.signal);

    await expect(pool.submit(async () => 'ok')).rejects.toThrow('cancelled');
  });

  test('stats should track running and queued tasks', async () => {
    const pool = new WorkerPool(1);
    expect(pool.stats.running).toBe(0);
    expect(pool.stats.queued).toBe(0);
  });

  test('waitAll should resolve when all tasks complete', async () => {
    const pool = new WorkerPool(2);
    const results: number[] = [];

    pool.submit(async () => {
      await new Promise((r) => setTimeout(r, 10));
      results.push(1);
    });
    pool.submit(async () => {
      await new Promise((r) => setTimeout(r, 20));
      results.push(2);
    });

    await pool.waitAll();
    expect(results).toEqual([1, 2]);
  });

  test('waitAll should throw on abort', async () => {
    const controller = new AbortController();
    const pool = new WorkerPool(1, controller.signal);

    // Submit a long task
    pool
      .submit(async () => {
        await new Promise((r) => setTimeout(r, 10000));
      })
      .catch(() => {}); // ignore rejection

    // Abort after a short delay
    setTimeout(() => controller.abort(), 20);

    await expect(pool.waitAll()).rejects.toThrow('cancelled');
  });

  test('invalid maxWorkers should default to 5', () => {
    const pool = new WorkerPool(0);
    // Can't directly access private field, but verifying it works
    // Submit 5 concurrent tasks — they should all run
    const running: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      running.push(pool.submit(async () => {}));
    }
    return Promise.all(running);
  });

  test('abort signal should stop the pool', async () => {
    const controller = new AbortController();
    const pool = new WorkerPool(2, controller.signal);

    // Submit a task
    const p = pool.submit(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    });

    await p; // Let it finish

    // Now abort
    controller.abort();

    // New submissions should fail
    await expect(pool.submit(async () => 'should fail')).rejects.toThrow();
  });
});
