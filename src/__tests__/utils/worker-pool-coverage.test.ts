/**
 * Coverage tests for utils/worker-pool.ts — CpuWorkerPool
 *
 * CpuWorkerPool uses Node.js worker_threads.  We mock the Worker class
 * so no real threads are spawned.
 */

import { CpuWorkerPool } from '../../utils/worker-pool';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mock worker_threads
// ---------------------------------------------------------------------------

/**
 * Minimal Worker mock: an EventEmitter with postMessage and terminate.
 */
class MockWorker extends EventEmitter {
  static instances: MockWorker[] = [];

  postMessage = jest.fn();
  terminate = jest.fn().mockResolvedValue(undefined);

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  /** Helper: simulate a successful response to the last postMessage */
  replyWith(result: unknown): void {
    this.emit('message', result);
  }

  /** Helper: simulate an error during processing */
  replyWithError(err: Error): void {
    this.emit('error', err);
  }

  /** Helper: simulate worker exiting unexpectedly */
  replyWithExit(code: number): void {
    this.emit('exit', code);
  }
}

jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => new MockWorker()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLatestWorker(): MockWorker {
  return MockWorker.instances[MockWorker.instances.length - 1];
}

beforeEach(() => {
  MockWorker.instances = [];
  // Reset the Worker constructor mock so each CpuWorkerPool gets fresh workers
  const { Worker } = jest.requireMock('worker_threads') as { Worker: jest.Mock };
  Worker.mockImplementation(() => new MockWorker());
});

// ---------------------------------------------------------------------------
// CpuWorkerPool tests
// ---------------------------------------------------------------------------

describe('CpuWorkerPool — construction', () => {
  it('creates maxWorkers workers on construction', () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 2);
    expect(MockWorker.instances).toHaveLength(2);
    // Clean up
    void pool.terminate();
  });

  it('defaults to 2 workers when maxWorkers is 0 or negative', () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 0);
    expect(MockWorker.instances).toHaveLength(2);
    void pool.terminate();
  });
});

describe('CpuWorkerPool — submit()', () => {
  it('resolves with the worker response', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 1);
    const worker = getLatestWorker();

    const promise = pool.submit<string, string>('task-data');

    // Worker sends back its result
    worker.replyWith('result-value');

    await expect(promise).resolves.toBe('result-value');
    await pool.terminate();
  });

  it('rejects when worker emits error', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 1);
    const worker = getLatestWorker();

    const promise = pool.submit<string, string>('task-data');

    worker.replyWithError(new Error('worker error'));

    await expect(promise).rejects.toThrow('worker error');
    await pool.terminate();
  });

  it('queues tasks when all workers are busy', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 1);
    const worker = MockWorker.instances[0];

    // Submit two tasks to a pool with only 1 worker
    const p1 = pool.submit<string, string>('data1');
    const p2 = pool.submit<string, string>('data2');

    // Reply to first task
    worker.replyWith('result1');
    await p1;

    // Reply to second task (worker reused)
    worker.replyWith('result2');
    const r2 = await p2;

    expect(r2).toBe('result2');
    await pool.terminate();
  });

  it('processes multiple tasks across multiple workers', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 2);
    const [w1, w2] = MockWorker.instances;

    const p1 = pool.submit<string, string>('data1');
    const p2 = pool.submit<string, string>('data2');

    w1.replyWith('r1');
    w2.replyWith('r2');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('r1');
    expect(r2).toBe('r2');
    await pool.terminate();
  });
});

describe('CpuWorkerPool — worker crash (exit event)', () => {
  it('rejects the task and replaces the worker when exit fires mid-task', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 1);
    const crashedWorker = MockWorker.instances[0];

    const promise = pool.submit<string, string>('task');

    // Simulate a crash (exit while the slot is busy)
    crashedWorker.replyWithExit(1);

    await expect(promise).rejects.toThrow('Worker exited unexpectedly with code 1');

    // The pool should have created a replacement worker
    expect(MockWorker.instances.length).toBeGreaterThan(1);

    await pool.terminate();
  });
});

describe('CpuWorkerPool — terminate()', () => {
  it('terminates all workers and clears queues', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 2);
    const workers = [...MockWorker.instances];

    await pool.terminate();

    for (const w of workers) {
      expect(w.terminate).toHaveBeenCalledTimes(1);
    }
  });

  it('after terminate, new submits hang (no workers to process)', async () => {
    const pool = new CpuWorkerPool('/fake/worker.js', 1);
    await pool.terminate();

    // submit returns a promise that will never resolve since there are no workers
    // We just verify it doesn't throw synchronously
    let threw = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      pool.submit('data');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
