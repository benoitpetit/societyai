/**
 * @fileoverview Middleware System for SocietyAI
 *
 * This module provides a middleware/interceptor pattern for transforming
 * requests and responses, adding cross-cutting concerns like logging,
 * caching, rate limiting, and validation.
 *
 * Design principles:
 * - Composable: Middlewares can be chained and composed
 * - Model-agnostic: Works with any AI model
 * - Zero runtime deps: Pure TypeScript implementation
 * - Non-intrusive: Doesn't modify core processing logic
 *
 * @example
 * ```typescript
 * const middlewareChain = MiddlewareChain.create()
 *   .use(Middlewares.logging())
 *   .use(Middlewares.timing())
 *   .use(Middlewares.retry({ maxAttempts: 3 }))
 *   .use(Middlewares.cache({ ttl: 60000 }))
 *   .build();
 *
 * const wrappedModel = middlewareChain.wrap(model);
 * ```
 */

import { AIModel, StepResult, WorkflowContext } from './types';
import { getLogger } from '../observability/logger';

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

/**
 * Context passed through the middleware chain
 */
export interface MiddlewareContext {
  /** The original input/prompt */
  input: unknown;
  /** The processed input (may be transformed) */
  processedInput: unknown;
  /** Metadata attached by middlewares */
  metadata: Map<string, unknown>;
  /** Start time for timing purposes */
  startTime: number;
  /** Agent ID if applicable */
  agentId?: string;
  /** Step ID if applicable */
  stepId?: string;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Result from middleware processing
 */
export interface MiddlewareResult {
  /** The output (response from model or transformed) */
  output: string;
  /** Whether to continue processing or short-circuit */
  continue: boolean;
  /** Metadata to attach to the result */
  metadata?: Record<string, unknown>;
}

/**
 * Next function to call the next middleware in the chain
 */
export type NextFunction = (ctx: MiddlewareContext) => Promise<MiddlewareResult>;

/**
 * Middleware function signature
 */
export type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: NextFunction
) => Promise<MiddlewareResult>;

/**
 * Named middleware with metadata
 */
export interface Middleware {
  /** Unique name for this middleware */
  name: string;
  /** Description of what this middleware does */
  description?: string;
  /** Priority for ordering (higher = earlier) */
  priority?: number;
  /** The middleware function */
  fn: MiddlewareFn;
}

// ============================================================================
// MIDDLEWARE CHAIN
// ============================================================================

/**
 * Composable middleware chain
 */
export class MiddlewareChain {
  private middlewares: Middleware[] = [];
  private model?: AIModel;

  /**
   * Create a new middleware chain
   */
  static create(): MiddlewareChain {
    return new MiddlewareChain();
  }

  /**
   * Add a middleware to the chain
   */
  use(middleware: Middleware | MiddlewareFn): this {
    if (typeof middleware === 'function') {
      this.middlewares.push({
        name: `middleware-${this.middlewares.length}`,
        fn: middleware,
      });
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Add a middleware at a specific position
   */
  useAt(index: number, middleware: Middleware): this {
    this.middlewares.splice(index, 0, middleware);
    return this;
  }

  /**
   * Add a middleware before another middleware by name
   */
  useBefore(name: string, middleware: Middleware): this {
    const index = this.middlewares.findIndex((m) => m.name === name);
    if (index >= 0) {
      this.middlewares.splice(index, 0, middleware);
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Add a middleware after another middleware by name
   */
  useAfter(name: string, middleware: Middleware): this {
    const index = this.middlewares.findIndex((m) => m.name === name);
    if (index >= 0) {
      this.middlewares.splice(index + 1, 0, middleware);
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Remove a middleware by name
   */
  remove(name: string): this {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
    return this;
  }

  /**
   * Set the target model
   */
  forModel(model: AIModel): this {
    this.model = model;
    return this;
  }

  /**
   * Get the list of middlewares
   */
  getMiddlewares(): readonly Middleware[] {
    return this.middlewares;
  }

  /**
   * Sort middlewares by priority
   */
  sortByPriority(): this {
    this.middlewares.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  /**
   * Build the composed middleware function
   */
  build(): ComposedMiddleware {
    return new ComposedMiddleware(this.middlewares, this.model);
  }

  /**
   * Wrap a model with the middleware chain
   */
  wrap(model: AIModel): MiddlewareWrappedModel {
    return new MiddlewareWrappedModel(model, this.middlewares);
  }
}

/**
 * Composed middleware that can be executed
 */
export class ComposedMiddleware {
  constructor(
    private middlewares: Middleware[],
    private model?: AIModel
  ) {}

  /**
   * Execute the middleware chain
   */
  async execute(input: unknown, signal?: AbortSignal): Promise<MiddlewareResult> {
    const ctx: MiddlewareContext = {
      input,
      processedInput: input,
      metadata: new Map(),
      startTime: Date.now(),
      signal,
    };

    // Build the chain from end to start
    let next: NextFunction = async (c) => {
      if (this.model) {
        const output = await this.model.process(c.processedInput, c.signal);
        return { output, continue: true };
      }
      return { output: String(c.processedInput), continue: true };
    };

    // Wrap each middleware around the next
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const currentNext = next;
      next = async (c): Promise<MiddlewareResult> => middleware.fn(c, currentNext);
    }

    return next(ctx);
  }
}

/**
 * Model wrapped with middleware
 */
export class MiddlewareWrappedModel implements AIModel {
  private chain: ComposedMiddleware;

  constructor(
    private model: AIModel,
    middlewares: Middleware[]
  ) {
    this.chain = new ComposedMiddleware(middlewares, model);
  }

  name(): string {
    return `${this.model.name()} (with middleware)`;
  }

  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    const result = await this.chain.execute(prompt, signal);
    return result.output;
  }

  supportsPromptType(promptType: string): boolean {
    return this.model.supportsPromptType(promptType);
  }
}

// ============================================================================
// BUILT-IN MIDDLEWARES
// ============================================================================

/**
 * Collection of built-in middlewares
 */
export const Middlewares = {
  /**
   * Logging middleware - logs input and output
   */
  logging: (options?: {
    prefix?: string;
    logInput?: boolean;
    logOutput?: boolean;
  }): Middleware => ({
    name: 'logging',
    description: 'Logs request/response information',
    priority: 100,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      const logger = getLogger();
      const prefix = options?.prefix ?? '';
      const logInput = options?.logInput ?? true;
      const logOutput = options?.logOutput ?? true;

      if (logInput) {
        logger.debug(`${prefix}[Input] ${JSON.stringify(ctx.input).substring(0, 200)}...`);
      }

      const result = await next(ctx);

      if (logOutput) {
        logger.debug(`${prefix}[Output] ${result.output.substring(0, 200)}...`);
      }

      return result;
    },
  }),

  /**
   * Timing middleware - measures execution time
   */
  timing: (options?: { onComplete?: (durationMs: number) => void }): Middleware => ({
    name: 'timing',
    description: 'Measures execution time',
    priority: 99,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      const start = performance.now();
      const result = await next(ctx);
      const duration = performance.now() - start;

      ctx.metadata.set('duration', duration);
      options?.onComplete?.(duration);

      return {
        ...result,
        metadata: { ...result.metadata, durationMs: duration },
      };
    },
  }),

  /**
   * Retry middleware - retries on failure
   */
  retry: (options?: {
    maxAttempts?: number;
    delay?: number;
    backoffFactor?: number;
    retryOn?: (error: Error) => boolean;
  }): Middleware => ({
    name: 'retry',
    description: 'Retries failed requests',
    priority: 90,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      const maxAttempts = options?.maxAttempts ?? 3;
      const delay = options?.delay ?? 1000;
      const backoffFactor = options?.backoffFactor ?? 2;
      const retryOn = options?.retryOn ?? ((): boolean => true);

      let lastError: Error | undefined;
      let currentDelay = delay;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await next(ctx);
        } catch (error) {
          lastError = error as Error;

          if (ctx.signal?.aborted) {
            throw error;
          }

          if (!retryOn(lastError) || attempt === maxAttempts) {
            throw error;
          }

          await new Promise((resolve) => setTimeout(resolve, currentDelay));
          currentDelay *= backoffFactor;
        }
      }

      throw lastError;
    },
  }),

  /**
   * Cache middleware - caches responses
   */
  cache: (options?: {
    ttl?: number;
    keyGenerator?: (input: unknown) => string;
    storage?: Map<string, { value: string; expires: number }>;
  }): Middleware => {
    const storage = options?.storage ?? new Map<string, { value: string; expires: number }>();
    const ttl = options?.ttl ?? 60000;
    const keyGenerator = options?.keyGenerator ?? ((input): string => JSON.stringify(input));

    return {
      name: 'cache',
      description: 'Caches responses',
      priority: 80,
      fn: async (ctx, next): Promise<MiddlewareResult> => {
        const key = keyGenerator(ctx.input);
        const cached = storage.get(key);

        if (cached && cached.expires > Date.now()) {
          ctx.metadata.set('cacheHit', true);
          return { output: cached.value, continue: false, metadata: { cached: true } };
        }

        const result = await next(ctx);

        storage.set(key, {
          value: result.output,
          expires: Date.now() + ttl,
        });

        ctx.metadata.set('cacheHit', false);
        return result;
      },
    };
  },

  /**
   * Rate limiting middleware - limits request rate
   */
  rateLimit: (options: {
    maxRequests: number;
    windowMs: number;
    onLimitReached?: () => void;
  }): Middleware => {
    const requests: number[] = [];

    return {
      name: 'rateLimit',
      description: 'Limits request rate',
      priority: 95,
      fn: async (ctx, next): Promise<MiddlewareResult> => {
        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Remove old requests
        while (requests.length > 0 && requests[0] < windowStart) {
          requests.shift();
        }

        if (requests.length >= options.maxRequests) {
          options.onLimitReached?.();
          throw new Error(
            `Rate limit exceeded: ${options.maxRequests} requests per ${options.windowMs}ms`
          );
        }

        requests.push(now);
        return next(ctx);
      },
    };
  },

  /**
   * Timeout middleware - enforces a timeout
   */
  timeout: (ms: number): Middleware => ({
    name: 'timeout',
    description: `Enforces a ${ms}ms timeout`,
    priority: 98,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ms);

      // Combine with existing signal
      if (ctx.signal) {
        ctx.signal.addEventListener('abort', () => controller.abort());
      }

      const modifiedCtx = { ...ctx, signal: controller.signal };

      try {
        const result = await next(modifiedCtx);
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Request timed out after ${ms}ms`);
        }
        throw error;
      }
    },
  }),

  /**
   * Transform input middleware
   */
  transformInput: (transformer: (input: unknown) => unknown): Middleware => ({
    name: 'transformInput',
    description: 'Transforms input before processing',
    priority: 70,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      ctx.processedInput = transformer(ctx.input);
      return next(ctx);
    },
  }),

  /**
   * Transform output middleware
   */
  transformOutput: (transformer: (output: string) => string): Middleware => ({
    name: 'transformOutput',
    description: 'Transforms output after processing',
    priority: 10,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      const result = await next(ctx);
      return {
        ...result,
        output: transformer(result.output),
      };
    },
  }),

  /**
   * Validation middleware - validates input and output
   */
  validation: (options: {
    validateInput?: (input: unknown) => boolean | string;
    validateOutput?: (output: string) => boolean | string;
  }): Middleware => ({
    name: 'validation',
    description: 'Validates input and output',
    priority: 85,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      // Validate input
      if (options.validateInput) {
        const inputResult = options.validateInput(ctx.input);
        if (inputResult !== true) {
          const message = typeof inputResult === 'string' ? inputResult : 'Input validation failed';
          throw new Error(message);
        }
      }

      const result = await next(ctx);

      // Validate output
      if (options.validateOutput) {
        const outputResult = options.validateOutput(result.output);
        if (outputResult !== true) {
          const message =
            typeof outputResult === 'string' ? outputResult : 'Output validation failed';
          throw new Error(message);
        }
      }

      return result;
    },
  }),

  /**
   * Fallback middleware - provides a fallback on error
   */
  fallback: (fallbackValue: string | ((error: Error) => string)): Middleware => ({
    name: 'fallback',
    description: 'Provides a fallback on error',
    priority: 5,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      try {
        return await next(ctx);
      } catch (error) {
        const output =
          typeof fallbackValue === 'function' ? fallbackValue(error as Error) : fallbackValue;
        return {
          output,
          continue: false,
          metadata: { fallback: true, error: (error as Error).message },
        };
      }
    },
  }),

  /**
   * Metrics middleware - collects metrics
   */
  metrics: (collector: MetricsCollector): Middleware => ({
    name: 'metrics',
    description: 'Collects execution metrics',
    priority: 100,
    fn: async (ctx, next): Promise<MiddlewareResult> => {
      collector.incrementCounter('requests_total');
      const start = performance.now();

      try {
        const result = await next(ctx);
        collector.recordHistogram('request_duration_ms', performance.now() - start);
        collector.incrementCounter('requests_success');
        return result;
      } catch (error) {
        collector.recordHistogram('request_duration_ms', performance.now() - start);
        collector.incrementCounter('requests_failed');
        throw error;
      }
    },
  }),

  /**
   * Circuit breaker middleware - prevents cascading failures
   */
  circuitBreaker: (options: {
    threshold: number;
    timeout: number;
    onOpen?: () => void;
    onClose?: () => void;
    onHalfOpen?: () => void;
  }): Middleware => {
    let failures = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';
    let nextAttempt = 0;

    return {
      name: 'circuitBreaker',
      description: 'Circuit breaker pattern implementation',
      priority: 92,
      fn: async (ctx, next): Promise<MiddlewareResult> => {
        const now = Date.now();

        if (state === 'open') {
          if (now < nextAttempt) {
            throw new Error('Circuit breaker is open');
          }
          state = 'half-open';
          options.onHalfOpen?.();
        }

        try {
          const result = await next(ctx);

          if (state === 'half-open') {
            state = 'closed';
            failures = 0;
            options.onClose?.();
          }

          return result;
        } catch (error) {
          failures++;

          if (failures >= options.threshold) {
            state = 'open';
            nextAttempt = now + options.timeout;
            options.onOpen?.();
          }

          throw error;
        }
      },
    };
  },

  /**
   * Dedupe middleware - prevents duplicate concurrent requests
   */
  dedupe: (): Middleware => {
    const pending = new Map<string, Promise<MiddlewareResult>>();

    return {
      name: 'dedupe',
      description: 'Deduplicates concurrent identical requests',
      priority: 88,
      fn: async (ctx, next): Promise<MiddlewareResult> => {
        const key = JSON.stringify(ctx.input);

        const existing = pending.get(key);
        if (existing) {
          return existing;
        }

        const promise = next(ctx);
        pending.set(key, promise);

        try {
          return await promise;
        } finally {
          pending.delete(key);
        }
      },
    };
  },
} as const;

// ============================================================================
// METRICS COLLECTOR INTERFACE
// ============================================================================

/**
 * Interface for metrics collection
 */
export interface MetricsCollector {
  incrementCounter(name: string, value?: number): void;
  recordHistogram(name: string, value: number): void;
  recordGauge(name: string, value: number): void;
}

/**
 * Simple in-memory metrics collector
 */
export class InMemoryMetricsCollector implements MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  incrementCounter(name: string, value: number = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
  }

  recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) ?? [];
    values.push(value);
    this.histograms.set(name, values);
  }

  recordGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getHistogram(name: string): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } {
    const values = this.histograms.get(name) ?? [];
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  getAll(): {
    counters: Record<string, number>;
    histograms: Record<string, number[]>;
    gauges: Record<string, number>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(this.histograms),
      gauges: Object.fromEntries(this.gauges),
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

// ============================================================================
// STEP MIDDLEWARE (for workflow steps)
// ============================================================================

/**
 * Context for step middleware
 */
export interface StepMiddlewareContext {
  stepId: string;
  stepName: string;
  agentIds: string[];
  input: string;
  workflowContext: WorkflowContext;
  metadata: Map<string, unknown>;
}

/**
 * Step middleware function
 */
export type StepMiddlewareFn = (
  ctx: StepMiddlewareContext,
  next: () => Promise<StepResult[]>
) => Promise<StepResult[]>;

/**
 * Named step middleware
 */
export interface StepMiddleware {
  name: string;
  description?: string;
  fn: StepMiddlewareFn;
}

/**
 * Built-in step middlewares
 */
export const StepMiddlewares = {
  /**
   * Log step execution
   */
  logging: (): StepMiddleware => ({
    name: 'stepLogging',
    fn: async (ctx, next): Promise<StepResult[]> => {
      const logger = getLogger();
      logger.info(`Starting step: ${ctx.stepName} (${ctx.stepId})`);
      const results = await next();
      logger.info(`Completed step: ${ctx.stepName} with ${results.length} results`);
      return results;
    },
  }),

  /**
   * Time step execution
   */
  timing: (onComplete?: (stepId: string, durationMs: number) => void): StepMiddleware => ({
    name: 'stepTiming',
    fn: async (ctx, next): Promise<StepResult[]> => {
      const start = performance.now();
      const results = await next();
      const duration = performance.now() - start;
      ctx.metadata.set('stepDuration', duration);
      onComplete?.(ctx.stepId, duration);
      return results;
    },
  }),

  /**
   * Filter results based on criteria
   */
  filterResults: (predicate: (result: StepResult) => boolean): StepMiddleware => ({
    name: 'filterResults',
    fn: async (_ctx, next): Promise<StepResult[]> => {
      const results = await next();
      return results.filter(predicate);
    },
  }),

  /**
   * Enrich results with additional metadata
   */
  enrichResults: (
    enricher: (result: StepResult, ctx: StepMiddlewareContext) => StepResult
  ): StepMiddleware => ({
    name: 'enrichResults',
    fn: async (ctx, next): Promise<StepResult[]> => {
      const results = await next();
      return results.map((r) => enricher(r, ctx));
    },
  }),
} as const;
