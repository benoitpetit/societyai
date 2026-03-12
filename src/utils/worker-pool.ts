import { WorkerTask } from '../core/config';
import { Worker } from 'worker_threads';

/**
 * Async concurrency limiter for IO-bound tasks.
 *
 * Runs at most `maxConcurrency` tasks simultaneously; additional tasks are
 * queued and dispatched as slots become free.
 *
 * Previously named `WorkerPool` (kept as a deprecated alias below).
 */
export class ConcurrencyLimiter {
  private maxWorkers: number;
  private running = 0;
  private queue: Array<WorkerTask<unknown>> = [];
  private stopped = false;
  private signal?: AbortSignal;
  /** Tracks all in-flight task promises so waitAll() can await them properly. */
  private activePromises = new Set<Promise<unknown>>();

  constructor(maxWorkers = 5, signal?: AbortSignal) {
    this.maxWorkers = maxWorkers > 0 ? maxWorkers : 5;
    this.signal = signal;

    // Handle cancellation
    if (this.signal) {
      this.signal.addEventListener('abort', () => {
        this.stop();
      });
    }
  }

  /**
   * Submit a task to the limiter
   */
  async submit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.stopped) {
      throw new Error('Worker pool has been stopped');
    }

    if (this.signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    const promise = new Promise<T>((resolve, reject) => {
      // Wrap fn to handle resolution/rejection and decrement running count
      const wrappedFn = async (): Promise<unknown> => {
        try {
          const result = await fn();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        } finally {
          this.running--;
          this.activePromises.delete(promise);
          this.processNext();
        }
      };

      const task: WorkerTask<unknown> = {
        fn: wrappedFn,
      };

      this.queue.push(task);
      this.processNext();
    });

    this.activePromises.add(promise);
    return promise;
  }

  /**
   * Process the next task in the queue
   */
  private processNext(): void {
    if (this.stopped || this.signal?.aborted) {
      return;
    }

    while (this.running < this.maxWorkers && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        // Errors are handled in wrappedFn and propagated via reject()
        void task.fn().catch(() => {
          // Error already handled in wrappedFn and propagated via reject()
        });
      }
    }
  }

  /**
   * Wait for all currently submitted tasks to complete.
   * Uses Promise.allSettled to avoid short-circuiting on failures.
   *
   * If the pool was constructed with an AbortSignal and that signal fires
   * before all tasks finish, this method rejects with `new Error('cancelled')`.
   */
  async waitAll(): Promise<void> {
    // Build an abort-rejection promise that races against the work so that
    // aborting the signal causes waitAll() to reject immediately.
    const abortPromise = this.signal
      ? new Promise<never>((_resolve, reject) => {
          if (this.signal!.aborted) {
            reject(new Error('cancelled'));
            return;
          }
          this.signal!.addEventListener('abort', () => reject(new Error('cancelled')), {
            once: true,
          });
        })
      : null;

    // Drain the queue by waiting for each wave of active tasks.
    // New tasks may be enqueued as running tasks complete, so we loop until
    // both the queue and the active set are empty.
    while (this.activePromises.size > 0 || this.queue.length > 0) {
      if (this.activePromises.size > 0) {
        const wave = Promise.allSettled([...this.activePromises]);
        await (abortPromise ? Promise.race([wave, abortPromise]) : wave);
      } else {
        // Queue has items but none are running yet — yield to let processNext() fire.
        await (abortPromise ? Promise.race([Promise.resolve(), abortPromise]) : Promise.resolve());
      }
    }
  }

  /**
   * Stop the limiter and drain all queued tasks
   */
  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.activePromises.clear();
  }

  /**
   * Return the number of running and queued tasks
   */
  get stats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

/**
 * @deprecated Use {@link ConcurrencyLimiter} instead.
 */
export const WorkerPool = ConcurrencyLimiter;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type WorkerPool = ConcurrencyLimiter;

// ============================================================================
// CPU WORKER POOL
// ============================================================================

interface IdleWorker {
  worker: Worker;
  busy: boolean;
}

interface PendingTask {
  data: unknown;
  resolve: (val: unknown) => void;
  reject: (err: unknown) => void;
}

/**
 * Thread pool for CPU-intensive tasks (validation, parsing).
 * Uses Node.js Worker Threads and **reuses workers** across tasks to avoid
 * the per-task startup cost.
 *
 * Each worker must follow the request/reply message protocol:
 *   - Main → Worker: `workerData` is sent via `worker.postMessage(data)`
 *   - Worker → Main: the worker sends back a single message with the result
 *
 * Workers are pre-warmed up to `maxWorkers` on construction and kept alive
 * until `terminate()` is called.
 */
export class CpuWorkerPool {
  private workerScript: string;
  private maxWorkers: number;
  private idleWorkers: IdleWorker[] = [];
  private queue: PendingTask[] = [];

  constructor(workerScriptPath: string, maxWorkers = 2) {
    this.workerScript = workerScriptPath;
    this.maxWorkers = maxWorkers > 0 ? maxWorkers : 2;
    // Pre-warm the pool
    for (let i = 0; i < this.maxWorkers; i++) {
      this.idleWorkers.push({ worker: this.createWorker(), busy: false });
    }
  }

  private createWorker(): Worker {
    return new Worker(this.workerScript);
  }

  async submit<T, R>(data: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({
        data,
        resolve: resolve as (val: unknown) => void,
        reject: reject as (err: unknown) => void,
      });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.queue.length === 0) return;

    const slot = this.idleWorkers.find((w) => !w.busy);
    if (!slot) return; // All workers busy; task stays in queue

    const task = this.queue.shift();
    if (!task) return;

    slot.busy = true;

    // One-shot listeners for this task
    const onMessage = (result: unknown): void => {
      cleanup();
      slot.busy = false;
      task.resolve(result);
      this.processNext();
    };

    const onError = (err: Error): void => {
      cleanup();
      slot.busy = false;
      task.reject(err);
      this.processNext();
    };

    const onExit = (code: number): void => {
      if (slot.busy) {
        // Worker crashed mid-task — replace it and reject the task
        cleanup();
        slot.worker = this.createWorker();
        slot.busy = false;
        task.reject(new Error(`Worker exited unexpectedly with code ${code}`));
        this.processNext();
      }
    };

    const cleanup = (): void => {
      slot.worker.off('message', onMessage);
      slot.worker.off('error', onError);
      slot.worker.off('exit', onExit);
    };

    slot.worker.on('message', onMessage);
    slot.worker.on('error', onError);
    slot.worker.on('exit', onExit);

    slot.worker.postMessage(task.data);
  }

  /**
   * Terminate all workers in the pool.
   * Call this when the pool is no longer needed to release resources.
   */
  async terminate(): Promise<void> {
    await Promise.all(this.idleWorkers.map((slot) => slot.worker.terminate()));
    this.idleWorkers = [];
    this.queue = [];
  }
}
