/**
 * @fileoverview Persistence System for SocietyAI
 *
 * Provides interfaces and implementations for saving and loading execution state.
 * Supports Zero Dependency architecture using native file system operations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskResult, Message } from './types';
import { ProcessingFailedError } from './errors';

/**
 * Snapshot of the workflow state at a specific point in time
 */
export interface WorkflowState {
  /** Unique ID of the execution */
  executionId: string;
  /** Current status of the workflow */
  status: 'active' | 'paused' | 'completed' | 'failed';
  /** Original input passed to execute() — persisted so resume() can restore it (#4) */
  input?: string;
  /** IDs of nodes currently in the execution queue */
  queue: string[];
  /** Results of completed tasks (Map serialized as array of entries) */
  results: Array<[string, TaskResult]>;
  /** Shared context data (Map serialized as array of entries) */
  sharedData: Array<[string, unknown]>;
  /** Iteration counts for loops (Map serialized as array of entries) */
  iterationCounts: Array<[string, number]>;
  /** Full execution history/path */
  executionPath: string[];
  /** Message history for collaborative nodes */
  messageHistory: Message[];
  /** Timestamp of the snapshot */
  timestamp: number;
  /** If paused, the ID of the node waiting for input */
  waitingForNodeId?: string;
  /** IDs of nodes in the Dead Letter Queue (failed permanently) */
  deadLetterQueue?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for storage adapters
 */
export interface StorageAdapter {
  /** Save state */
  save(id: string, state: WorkflowState): Promise<void>;
  /** Load state */
  load(id: string): Promise<WorkflowState | null>;
  /** Delete state */
  delete(id: string): Promise<void>;
  /** List all saved executions */
  list(): Promise<string[]>;
}

/**
 * Configuration for FileStorageAdapter
 */
export interface FileStorageConfig {
  baseDir: string;
}

/**
 * File-based storage adapter (Zero Dependency)
 */
export class FileStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(config: FileStorageConfig = { baseDir: './.societyai/storage' }) {
    this.baseDir = config.baseDir;
  }

  /**
   * Initialize storage directory
   */
  private async init(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get file path for an execution ID
   */
  private getFilePath(id: string): string {
    // Sanitize ID to prevent directory traversal
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.baseDir, `${safeId}.json`);
  }

  async save(id: string, state: WorkflowState): Promise<void> {
    await this.init();
    const filePath = this.getFilePath(id);
    const tempPath = `${filePath}.tmp`;

    try {
      const data = JSON.stringify(state, null, 2);
      // Atomic write: write to temp then rename
      await fs.writeFile(tempPath, data, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to save state for ${id}: ${(error as Error).message}`
      );
    }
  }

  async load(id: string): Promise<WorkflowState | null> {
    const filePath = this.getFilePath(id);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as WorkflowState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new ProcessingFailedError(
        `Failed to load state for ${id}: ${(error as Error).message}`
      );
    }
  }

  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async list(): Promise<string[]> {
    await this.init();
    try {
      const files = await fs.readdir(this.baseDir);
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
}

/**
 * Helper to serialize Map to Array of entries
 */
export function mapToArray<K, V>(map: Map<K, V>): Array<[K, V]> {
  return Array.from(map.entries());
}

/**
 * Helper to deserialize Array of entries to Map
 */
export function arrayToMap<K, V>(arr: Array<[K, V]>): Map<K, V> {
  return new Map(arr);
}
