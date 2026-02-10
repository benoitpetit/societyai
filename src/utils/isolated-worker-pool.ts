/**
 * @fileoverview Isolated Worker Pool for CPU-Intensive Agent Execution
 *
 * This module provides a worker pool implementation that executes agents
 * in isolated Worker Threads, preventing CPU-intensive tasks from blocking
 * the main event loop.
 *
 * Features:
 * - True parallel execution using Worker Threads
 * - Automatic agent serialization and deserialization
 * - Resource pooling and reuse
 * - Graceful shutdown
 */

import { Worker } from 'worker_threads';
import { Agent, TaskResult, ExecutionContext } from '../core/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Task for isolated worker execution
 */
export interface IsolatedWorkerTask {
  /** Agent configuration (serialized) */
  agent: Agent;
  /** Input prompt */
  input: string;
  /** Execution context (serialized) */
  context: ExecutionContext;
  /** Task options */
  options?: {
    taskId?: string;
    instructions?: string;
    promptTemplate?: string;
    signal?: AbortSignal;
  };
}

/**
 * Result from isolated worker
 */
export interface IsolatedWorkerResult {
  /** Task result */
  result: TaskResult;
  /** Execution duration in ms */
  duration: number;
}

/**
 * Pool for executing agents in isolated Worker Threads
 * Prevents CPU-intensive agent tasks from blocking the main event loop
 */
export class IsolatedWorkerPool {
  private maxWorkers: number;
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private queue: Array<{
    task: IsolatedWorkerTask;
    resolve: (val: IsolatedWorkerResult) => void;
    reject: (err: Error) => void;
  }> = [];
  private workerScript: string;
  private isShuttingDown = false;

  constructor(maxWorkers = 2) {
    this.maxWorkers = maxWorkers;
    // Worker script will be compiled, so look in dist
    // In dev/test mode with ts-jest, __dirname points to src/, but compiled JS is in dist/
    const possiblePaths = [
      path.join(__dirname, 'isolated-worker.js'), // When running from dist/
      path.join(__dirname, '../../dist/utils/isolated-worker.js'), // When running from src/ with ts-jest
    ];

    // Initialize with default path
    this.workerScript = possiblePaths[0];

    // Try to find the worker script
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        this.workerScript = possiblePath;
        break;
      }
    }
  }

  /**
   * Submit an agent task for isolated execution
   */
  async execute(task: IsolatedWorkerTask): Promise<IsolatedWorkerResult> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    return new Promise<IsolatedWorkerResult>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;
    if (this.isShuttingDown) return;

    // Try to use available worker
    if (this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!;
      const task = this.queue.shift()!;
      this.runTask(worker, task);
      return;
    }

    // Create new worker if under limit
    if (this.workers.length < this.maxWorkers) {
      const task = this.queue.shift()!;
      const worker = this.createWorker();
      this.workers.push(worker);
      this.runTask(worker, task);
    }
  }

  /**
   * Create a new worker
   */
  private createWorker(): Worker {
    const worker = new Worker(this.workerScript);

    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.removeWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.isShuttingDown) {
        console.error(`Worker stopped with exit code ${code}`);
      }
      this.removeWorker(worker);
    });

    return worker;
  }

  /**
   * Run a task on a worker
   */
  private runTask(
    worker: Worker,
    task: {
      task: IsolatedWorkerTask;
      resolve: (val: IsolatedWorkerResult) => void;
      reject: (err: Error) => void;
    }
  ): void {
    // Set up one-time message handler
    const messageHandler = (result: IsolatedWorkerResult): void => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);

      // Return worker to pool
      this.availableWorkers.push(worker);

      // Resolve task
      task.resolve(result);

      // Process next task
      this.processQueue();
    };

    const errorHandler = (error: Error): void => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);

      // Remove worker (don't reuse after error)
      this.removeWorker(worker);

      // Reject task
      task.reject(error);

      // Process next task
      this.processQueue();
    };

    worker.on('message', messageHandler);
    worker.on('error', errorHandler);

    // Send task to worker
    // Serialize the task (remove non-serializable fields)
    const serializedTask = {
      agent: {
        ...task.task.agent,
        model: {
          name: task.task.agent.model.name(),
          // Model will need to be reconstructed in worker
        },
        memory: undefined, // Memory not serializable
        tools: task.task.agent.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          // Executor function not serializable
        })),
      },
      input: task.task.input,
      context: {
        ...task.task.context,
        sharedData: Array.from(task.task.context.sharedData.entries()),
        taskResults: Array.from(task.task.context.taskResults.entries()),
      },
      options: task.task.options,
    };

    worker.postMessage(serializedTask);
  }

  /**
   * Remove a worker from the pool
   */
  private removeWorker(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    const availIndex = this.availableWorkers.indexOf(worker);
    if (availIndex !== -1) {
      this.availableWorkers.splice(availIndex, 1);
    }

    try {
      worker.terminate();
    } catch (e) {
      // Ignore termination errors
    }
  }

  /**
   * Shutdown the pool gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Reject all pending tasks
    for (const task of this.queue) {
      task.reject(new Error('Worker pool is shutting down'));
    }
    this.queue = [];

    // Terminate all workers
    const terminatePromises = this.workers.map((worker) => {
      return new Promise<void>((resolve) => {
        worker.once('exit', () => resolve());
        worker.terminate();
      });
    });

    await Promise.all(terminatePromises);

    this.workers = [];
    this.availableWorkers = [];
  }

  /**
   * Get pool statistics
   */
  get stats(): { total: number; available: number; busy: number; queued: number } {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
      busy: this.workers.length - this.availableWorkers.length,
      queued: this.queue.length,
    };
  }
}
