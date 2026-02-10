import { WorkerTask } from '../core/config';
import { Worker } from 'worker_threads';

/**
 * Pool de workers pour exécuter des tâches en parallèle (IO-Bound)
 * avec limitation du nombre d'exécutions simultanées
 */
export class WorkerPool {
  private maxWorkers: number;
  private running = 0;
  private queue: Array<WorkerTask<unknown>> = [];
  private stopped = false;
  private signal?: AbortSignal;

  constructor(maxWorkers = 5, signal?: AbortSignal) {
    this.maxWorkers = maxWorkers > 0 ? maxWorkers : 5;
    this.signal = signal;

    // Gérer l'annulation
    if (this.signal) {
      this.signal.addEventListener('abort', () => {
        this.stop();
      });
    }
  }

  /**
   * Soumet une tâche au pool
   */
  async submit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.stopped) {
      throw new Error('Worker pool has been stopped');
    }

    if (this.signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    return new Promise<T>((resolve, reject) => {
      // Envelopper pour gérer la résolution/rejet
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
          this.processNext();
        }
      };

      const task: WorkerTask<unknown> = {
        fn: wrappedFn,
      };

      this.queue.push(task);
      this.processNext();
    });
  }

  /**
   * Traite la prochaine tâche dans la queue
   */
  private processNext(): void {
    if (this.stopped || this.signal?.aborted) {
      return;
    }

    while (this.running < this.maxWorkers && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        // Les erreurs sont gérées dans wrappedFn et rejetées dans la Promise submit()
        // On ajoute un catch vide pour éviter les unhandled rejections
        void task.fn().catch(() => {
          // Erreur déjà gérée dans wrappedFn et propagée via reject()
        });
      }
    }
  }

  /**
   * Attend que toutes les tâches soient terminées
   */
  async waitAll(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (this.signal?.aborted) {
        throw new Error('Operation cancelled');
      }
    }
  }

  /**
   * Arrête le pool et rejette toutes les tâches en attente
   */
  stop(): void {
    this.stopped = true;
    this.queue = [];
  }

  /**
   * Retourne le nombre de tâches en cours et en attente
   */
  get stats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

/**
 * Pool de threads pour tâches CPU-Intensive (Validation, Parsing)
 * Utilise les Worker Threads Node.js
 */
export class CpuWorkerPool {
  private workerScript: string;
  private maxWorkers: number;
  private workers: Worker[] = [];
  private queue: Array<{
    data: unknown;
    resolve: (val: unknown) => void;
    reject: (err: unknown) => void;
  }> = [];
  private activeWorkers = 0;

  constructor(workerScriptPath: string, maxWorkers = 2) {
    this.workerScript = workerScriptPath;
    this.maxWorkers = maxWorkers;
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
    if (this.activeWorkers >= this.maxWorkers) return;

    const task = this.queue.shift();
    if (!task) return;

    this.activeWorkers++;

    const worker = new Worker(this.workerScript, {
      workerData: task.data,
    });

    this.workers.push(worker);

    worker.on('message', (result) => {
      task.resolve(result);
      worker.terminate();
      this.activeWorkers--;
      this.processNext();
    });

    worker.on('error', (err) => {
      task.reject(err);
      worker.terminate();
      this.activeWorkers--;
      this.processNext();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        task.reject(new Error(`Worker stopped with exit code ${code}`));
        this.activeWorkers--;
        this.processNext();
      }
    });
  }
}
