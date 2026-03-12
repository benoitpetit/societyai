/**
 * @fileoverview PostgreSQL Storage Adapter for SocietyAI
 *
 * This adapter requires the 'pg' peer dependency to be installed.
 * Install with: npm install pg
 *
 * @example
 * ```ts
 * import { Pool } from 'pg';
 * import { PostgresStorageAdapter } from 'societyai/adapters';
 *
 * const pool = new Pool({ connectionString: 'postgresql://...' });
 * const storage = new PostgresStorageAdapter({ pool, tableName: 'workflow_states' });
 *
 * // Initialize schema
 * await storage.initialize();
 *
 * await society.execute(input, signal, undefined, undefined, undefined, storage);
 * ```
 */

import { StorageAdapter, WorkflowState } from '../core/persistence';
import { ProcessingFailedError } from '../core/errors';

/**
 * PostgreSQL Pool interface (compatible with pg)
 */
export interface PostgresPool {
  query(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }>;
  end(): Promise<void>;
}

/**
 * Configuration for PostgresStorageAdapter
 */
export interface PostgresStorageConfig {
  /** PostgreSQL connection pool */
  pool: PostgresPool;
  /** Table name for storing states (default: 'societyai_states') */
  tableName?: string;
  /** Schema name (default: 'public') */
  schemaName?: string;
}

/**
 * PostgreSQL-based storage adapter for transactional/reliable persistence
 *
 * Features:
 * - ACID guarantees
 * - Relational queries
 * - Metadata indexing
 * - Audit trail support
 *
 * Table Schema:
 * - id (TEXT PRIMARY KEY): Execution ID
 * - state (JSONB): Full workflow state
 * - status (TEXT): Current status (indexed)
 * - created_at (TIMESTAMP): Creation time
 * - updated_at (TIMESTAMP): Last update time
 *
 * @peer-dependency pg ^8.0.0
 */
export class PostgresStorageAdapter implements StorageAdapter {
  private pool: PostgresPool;
  private schema: string;
  private tableName: string;
  private fullTableName: string;

  constructor(config: PostgresStorageConfig) {
    this.pool = config.pool;
    this.schema = config.schemaName || 'public';
    this.tableName = config.tableName || 'societyai_states';
    // Quoted identifiers prevent SQL injection for schema/table names
    this.fullTableName = `"${this.schema}"."${this.tableName}"`;
  }

  /**
   * Initialize database schema
   * Creates the table and indexes if they don't exist
   */
  async initialize(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.fullTableName} (
        id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_${this.tableName}_status"
        ON ${this.fullTableName}(status);

      CREATE INDEX IF NOT EXISTS "idx_${this.tableName}_updated_at"
        ON ${this.fullTableName}(updated_at DESC);
    `;

    try {
      await this.pool.query(createTableSQL);
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to initialize PostgreSQL schema: ${(error as Error).message}`
      );
    }
  }

  async save(id: string, state: WorkflowState): Promise<void> {
    const sql = `
      INSERT INTO ${this.fullTableName} (id, state, status, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        state = EXCLUDED.state,
        status = EXCLUDED.status,
        updated_at = NOW()
    `;

    try {
      await this.pool.query(sql, [id, JSON.stringify(state), state.status]);
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to save state to PostgreSQL for ${id}: ${(error as Error).message}`
      );
    }
  }

  async load(id: string): Promise<WorkflowState | null> {
    const sql = `SELECT state FROM ${this.fullTableName} WHERE id = $1`;

    try {
      const result = await this.pool.query(sql, [id]);
      if (result.rows.length === 0) return null;

      return result.rows[0].state as WorkflowState;
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to load state from PostgreSQL for ${id}: ${(error as Error).message}`
      );
    }
  }

  async delete(id: string): Promise<void> {
    const sql = `DELETE FROM ${this.fullTableName} WHERE id = $1`;

    try {
      await this.pool.query(sql, [id]);
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to delete state from PostgreSQL for ${id}: ${(error as Error).message}`
      );
    }
  }

  async list(): Promise<string[]> {
    const sql = `SELECT id FROM ${this.fullTableName} ORDER BY updated_at DESC`;

    try {
      const result = await this.pool.query(sql);
      return result.rows.map((row) => row.id as string);
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to list states from PostgreSQL: ${(error as Error).message}`
      );
    }
  }

  /**
   * Advanced: Query states by status
   */
  async listByStatus(status: string): Promise<string[]> {
    const sql = `SELECT id FROM ${this.fullTableName} WHERE status = $1 ORDER BY updated_at DESC`;

    try {
      const result = await this.pool.query(sql, [status]);
      return result.rows.map((row) => row.id as string);
    } catch (error) {
      throw new ProcessingFailedError(
        `Failed to query states by status: ${(error as Error).message}`
      );
    }
  }

  /**
   * Advanced: Clean up old completed/failed states
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    // Use parameterized query to avoid SQL injection for the days value
    const sql = `
      DELETE FROM ${this.fullTableName}
      WHERE status IN ('completed', 'failed')
        AND updated_at < NOW() - INTERVAL '1 day' * $1
    `;

    try {
      const result = await this.pool.query(sql, [olderThanDays]);
      return result.rowCount;
    } catch (error) {
      throw new ProcessingFailedError(`Failed to cleanup old states: ${(error as Error).message}`);
    }
  }
}
