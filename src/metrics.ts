/**
 * @fileoverview Advanced Metrics and Observability System
 *
 * This module provides comprehensive tracking and monitoring capabilities
 * for SocietyAI workflows.
 *
 * Features:
 * - Token usage tracking per agent/workflow
 * - Execution time metrics
 * - Cost estimation
 * - OpenTelemetry-compatible trace export
 * - Custom metrics collectors
 * - Performance profiling
 *
 * @example
 * ```typescript
 * const tracker = MetricsTracker.create()
 *   .withTokenTracking()
 *   .withCostTracking({ model: 'gpt-4', inputCost: 0.03, outputCost: 0.06 })
 *   .build();
 *
 * tracker.startWorkflow('analysis-workflow');
 * // ... execute workflow
 * const metrics = tracker.endWorkflow('analysis-workflow');
 * console.log(metrics.totalTokens, metrics.estimatedCost);
 * ```
 */

import { getLogger } from './logger';

// ============================================================================
// METRICS TYPES
// ============================================================================

/**
 * Token usage metrics
 */
export interface TokenMetrics {
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Model name */
  model?: string;
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Success status */
  success: boolean;
  /** Error if failed */
  error?: Error;
}

/**
 * Cost metrics
 */
export interface CostMetrics {
  /** Estimated input cost */
  inputCost: number;
  /** Estimated output cost */
  outputCost: number;
  /** Total estimated cost */
  totalCost: number;
  /** Currency */
  currency: string;
}

/**
 * Complete metrics snapshot
 */
export interface MetricsSnapshot {
  /** Workflow/agent ID */
  id: string;
  /** Execution metrics */
  execution: ExecutionMetrics;
  /** Token metrics */
  tokens?: TokenMetrics;
  /** Cost metrics */
  cost?: CostMetrics;
  /** Custom metrics */
  custom?: Record<string, number>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated metrics for a workflow
 */
export interface AggregatedMetrics {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Total duration */
  totalDuration: number;
  /** Average duration */
  averageDuration: number;
  /** Total tokens */
  totalTokens?: number;
  /** Total cost */
  totalCost?: number;
  /** Per-agent breakdown */
  byAgent?: Record<string, MetricsSnapshot[]>;
}

/**
 * Cost configuration
 */
export interface CostConfig {
  /** Model name */
  model: string;
  /** Cost per 1K input tokens */
  inputCostPer1K: number;
  /** Cost per 1K output tokens */
  outputCostPer1K: number;
  /** Currency */
  currency?: string;
}

// ============================================================================
// METRICS TRACKER
// ============================================================================

/**
 * Comprehensive metrics tracking system
 */
export class MetricsTracker {
  private snapshots: Map<string, MetricsSnapshot> = new Map();
  private history: MetricsSnapshot[] = [];
  private costConfigs: Map<string, CostConfig> = new Map();
  private logger = getLogger();
  private trackTokens: boolean = false;
  private trackCost: boolean = false;

  constructor(
    options: {
      trackTokens?: boolean;
      trackCost?: boolean;
    } = {}
  ) {
    this.trackTokens = options.trackTokens ?? false;
    this.trackCost = options.trackCost ?? false;
  }

  /**
   * Start tracking a workflow/agent
   */
  start(id: string, metadata?: Record<string, unknown>): void {
    const snapshot: MetricsSnapshot = {
      id,
      execution: {
        startTime: Date.now(),
        success: false,
      },
      metadata,
    };

    this.snapshots.set(id, snapshot);
    this.logger.debug(`Started tracking: ${id}`);
  }

  /**
   * End tracking with success
   */
  end(id: string, options?: { tokens?: TokenMetrics; custom?: Record<string, number> }): MetricsSnapshot {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      throw new Error(`No tracking found for: ${id}`);
    }

    snapshot.execution.endTime = Date.now();
    snapshot.execution.duration = snapshot.execution.endTime - snapshot.execution.startTime;
    snapshot.execution.success = true;

    if (options?.tokens && this.trackTokens) {
      snapshot.tokens = options.tokens;

      if (this.trackCost && options.tokens.model) {
        const costConfig = this.costConfigs.get(options.tokens.model);
        if (costConfig) {
          snapshot.cost = this.calculateCost(options.tokens, costConfig);
        }
      }
    }

    if (options?.custom) {
      snapshot.custom = options.custom;
    }

    this.history.push(snapshot);
    this.snapshots.delete(id);

    this.logger.debug(`Ended tracking: ${id} (${snapshot.execution.duration}ms)`);
    return snapshot;
  }

  /**
   * End tracking with error
   */
  fail(id: string, error: Error): MetricsSnapshot {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      throw new Error(`No tracking found for: ${id}`);
    }

    snapshot.execution.endTime = Date.now();
    snapshot.execution.duration = snapshot.execution.endTime - snapshot.execution.startTime;
    snapshot.execution.success = false;
    snapshot.execution.error = error;

    this.history.push(snapshot);
    this.snapshots.delete(id);

    this.logger.debug(`Failed tracking: ${id} (${error.message})`);
    return snapshot;
  }

  /**
   * Add cost configuration for a model
   */
  addCostConfig(config: CostConfig): void {
    this.costConfigs.set(config.model, config);
    this.logger.debug(`Added cost config for: ${config.model}`);
  }

  /**
   * Calculate cost from token metrics
   */
  private calculateCost(tokens: TokenMetrics, config: CostConfig): CostMetrics {
    const inputCost = (tokens.inputTokens / 1000) * config.inputCostPer1K;
    const outputCost = (tokens.outputTokens / 1000) * config.outputCostPer1K;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: config.currency ?? 'USD',
    };
  }

  /**
   * Get current snapshot
   */
  getCurrent(id: string): MetricsSnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get history
   */
  getHistory(filter?: { id?: string; success?: boolean }): MetricsSnapshot[] {
    if (!filter) return this.history;

    return this.history.filter((snapshot) => {
      if (filter.id && snapshot.id !== filter.id) return false;
      if (filter.success !== undefined && snapshot.execution.success !== filter.success) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get aggregated metrics
   */
  getAggregated(filter?: { id?: string }): AggregatedMetrics {
    const snapshots = this.getHistory(filter);

    const successful = snapshots.filter((s) => s.execution.success);
    const failed = snapshots.filter((s) => !s.execution.success);

    const totalDuration = snapshots.reduce(
      (sum, s) => sum + (s.execution.duration ?? 0),
      0
    );

    const totalTokens = snapshots.reduce(
      (sum, s) => sum + (s.tokens?.totalTokens ?? 0),
      0
    );

    const totalCost = snapshots.reduce(
      (sum, s) => sum + (s.cost?.totalCost ?? 0),
      0
    );

    // Group by agent
    const byAgent: Record<string, MetricsSnapshot[]> = {};
    for (const snapshot of snapshots) {
      if (!byAgent[snapshot.id]) {
        byAgent[snapshot.id] = [];
      }
      byAgent[snapshot.id].push(snapshot);
    }

    return {
      totalExecutions: snapshots.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      totalDuration,
      averageDuration: snapshots.length > 0 ? totalDuration / snapshots.length : 0,
      totalTokens: totalTokens > 0 ? totalTokens : undefined,
      totalCost: totalCost > 0 ? totalCost : undefined,
      byAgent,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.logger.debug('Cleared metrics history');
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    return JSON.stringify({
      current: Array.from(this.snapshots.values()),
      history: this.history,
      aggregated: this.getAggregated(),
    }, null, 2);
  }

  /**
   * Export as OpenTelemetry-compatible format
   */
  exportOTel(): OTelTrace[] {
    return this.history.map((snapshot) => ({
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: snapshot.id,
      kind: 'INTERNAL',
      startTimeUnixNano: snapshot.execution.startTime * 1_000_000,
      endTimeUnixNano: (snapshot.execution.endTime ?? Date.now()) * 1_000_000,
      attributes: {
        'societyai.success': snapshot.execution.success,
        'societyai.duration_ms': snapshot.execution.duration,
        'societyai.tokens.input': snapshot.tokens?.inputTokens,
        'societyai.tokens.output': snapshot.tokens?.outputTokens,
        'societyai.tokens.total': snapshot.tokens?.totalTokens,
        'societyai.cost.total': snapshot.cost?.totalCost,
        'societyai.cost.currency': snapshot.cost?.currency,
        ...snapshot.custom,
      },
      status: {
        code: snapshot.execution.success ? 'OK' : 'ERROR',
        message: snapshot.execution.error?.message,
      },
    }));
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

/**
 * OpenTelemetry trace format
 */
export interface OTelTrace {
  traceId: string;
  spanId: string;
  name: string;
  kind: string;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  attributes: Record<string, unknown>;
  status: {
    code: string;
    message?: string;
  };
}

// ============================================================================
// METRICS BUILDER
// ============================================================================

/**
 * Builder for creating metrics trackers
 */
export class MetricsBuilder {
  private trackTokens: boolean = false;
  private trackCost: boolean = false;
  private costConfigs: CostConfig[] = [];

  static create(): MetricsBuilder {
    return new MetricsBuilder();
  }

  /**
   * Enable token tracking
   */
  withTokenTracking(): this {
    this.trackTokens = true;
    return this;
  }

  /**
   * Enable cost tracking
   */
  withCostTracking(config: CostConfig): this {
    this.trackCost = true;
    this.costConfigs.push(config);
    return this;
  }

  /**
   * Build the tracker
   */
  build(): MetricsTracker {
    const tracker = new MetricsTracker({
      trackTokens: this.trackTokens,
      trackCost: this.trackCost,
    });

    for (const config of this.costConfigs) {
      tracker.addCostConfig(config);
    }

    return tracker;
  }
}

// ============================================================================
// TOKEN COUNTER
// ============================================================================

/**
 * Simple token counter (approximate)
 */
export class TokenCounter {
  /**
   * Estimate token count for text
   * This is a rough approximation: ~4 characters per token
   */
  static estimate(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Count tokens for prompt and response
   */
  static count(prompt: string, response: string): TokenMetrics {
    const inputTokens = this.estimate(prompt);
    const outputTokens = this.estimate(response);

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }
}

// ============================================================================
// PERFORMANCE PROFILER
// ============================================================================

/**
 * Performance profiling utility
 */
export class PerformanceProfiler {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    if (!start) {
      throw new Error(`Start mark not found: ${startMark}`);
    }

    const end = endMark ? this.marks.get(endMark) : Date.now();
    if (!end) {
      throw new Error(`End mark not found: ${endMark}`);
    }

    const duration = end - start;
    this.measures.set(name, duration);
    return duration;
  }

  /**
   * Get all measures
   */
  getMeasures(): Record<string, number> {
    return Object.fromEntries(this.measures);
  }

  /**
   * Clear all marks and measures
   */
  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
}

// ============================================================================
// COMMON COST CONFIGS
// ============================================================================

/**
 * Pre-configured cost configs for common models
 */
export const CommonCostConfigs = {
  'gpt-4': {
    model: 'gpt-4',
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06,
    currency: 'USD',
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    currency: 'USD',
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    inputCostPer1K: 0.0015,
    outputCostPer1K: 0.002,
    currency: 'USD',
  },
  'claude-3-opus': {
    model: 'claude-3-opus',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    currency: 'USD',
  },
  'claude-3-sonnet': {
    model: 'claude-3-sonnet',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    currency: 'USD',
  },
};
