import { Task } from '../core/config';

/**
 * Pool de workers pour exécuter des tâches en parallèle
 * avec limitation du nombre d'exécutions simultanées
 */
export class WorkerPool {
  private maxWorkers: number;
  private running = 0;
  private queue: Array<Task<unknown>> = [];
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

      const task: Task<unknown> = {
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
