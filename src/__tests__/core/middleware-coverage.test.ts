/**
 * @fileoverview Coverage tests for Middlewares built-ins, ComposedMiddleware,
 * MiddlewareWrappedModel, InMemoryMetricsCollector, StepMiddlewares, and
 * MiddlewareChain helpers not covered by core/middleware.test.ts.
 */

import {
  Middlewares,
  MiddlewareChain,
  ComposedMiddleware,
  InMemoryMetricsCollector,
  StepMiddlewares,
  MiddlewareContext,
  NextFunction,
  Middleware,
} from '../../core/middleware';
import { AIModel } from '../../core/types';

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------
jest.mock('../../observability/logger', () => ({
  getLogger: (): {
    info: jest.Mock;
    debug: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  } => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(input: unknown = 'test'): MiddlewareContext {
  return {
    input,
    processedInput: input,
    metadata: new Map(),
    startTime: Date.now(),
  };
}

const identityNext: NextFunction = async (ctx) => ({
  output: String(ctx.processedInput),
  continue: true,
});

const errorNext: NextFunction = async () => {
  throw new Error('downstream error');
};

const mockModel: AIModel = {
  name: () => 'test-model',
  process: async (input: unknown) => `PROC:${input}`,
  supportsPromptType: () => true,
};

// ---------------------------------------------------------------------------
// Middlewares.logging
// ---------------------------------------------------------------------------
describe('Middlewares.logging', () => {
  it('passes through and returns downstream result', async () => {
    const mw = Middlewares.logging();
    const result = await mw.fn(makeCtx('hello'), identityNext);
    expect(result.output).toBe('hello');
  });

  it('respects logInput/logOutput flags', async () => {
    const mw = Middlewares.logging({ logInput: false, logOutput: false });
    const result = await mw.fn(makeCtx('x'), identityNext);
    expect(result.output).toBe('x');
  });
});

// ---------------------------------------------------------------------------
// Middlewares.timing
// ---------------------------------------------------------------------------
describe('Middlewares.timing', () => {
  it('sets duration metadata and calls onComplete', async () => {
    let recorded = 0;
    const mw = Middlewares.timing({
      onComplete: (d) => {
        recorded = d;
      },
    });
    const result = await mw.fn(makeCtx('t'), identityNext);
    expect(result.output).toBe('t');
    expect(result.metadata?.durationMs).toBeDefined();
    expect(recorded).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Middlewares.retry
// ---------------------------------------------------------------------------
describe('Middlewares.retry', () => {
  it('succeeds on first attempt without retry', async () => {
    const mw = Middlewares.retry({ maxAttempts: 3, delay: 0 });
    const result = await mw.fn(makeCtx(), identityNext);
    expect(result.output).toBe('test');
  });

  it('retries on failure and eventually succeeds', async () => {
    let attempts = 0;
    const flakyNext: NextFunction = async (_ctx) => {
      attempts++;
      if (attempts < 3) throw new Error('flaky');
      return { output: 'ok', continue: true };
    };
    const mw = Middlewares.retry({ maxAttempts: 3, delay: 0, backoffFactor: 1 });
    const result = await mw.fn(makeCtx(), flakyNext);
    expect(result.output).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws after maxAttempts exhausted', async () => {
    const alwaysFail: NextFunction = async () => {
      throw new Error('always fail');
    };
    const mw = Middlewares.retry({ maxAttempts: 2, delay: 0 });
    await expect(mw.fn(makeCtx(), alwaysFail)).rejects.toThrow('always fail');
  });

  it('does not retry when retryOn returns false', async () => {
    let calls = 0;
    const mw = Middlewares.retry({
      maxAttempts: 5,
      delay: 0,
      retryOn: () => false,
    });
    const alwaysFail: NextFunction = async () => {
      calls++;
      throw new Error('no retry');
    };
    await expect(mw.fn(makeCtx(), alwaysFail)).rejects.toThrow('no retry');
    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Middlewares.cache
// ---------------------------------------------------------------------------
describe('Middlewares.cache', () => {
  it('returns cached result on second call', async () => {
    let calls = 0;
    const countingNext: NextFunction = async (_ctx) => {
      calls++;
      return { output: 'fresh', continue: true };
    };
    const mw = Middlewares.cache({ ttl: 60000 });
    await mw.fn(makeCtx('q'), countingNext);
    const second = await mw.fn(makeCtx('q'), countingNext);
    expect(second.output).toBe('fresh');
    expect(calls).toBe(1); // second call hit cache
    expect(second.metadata?.cached).toBe(true);
  });

  it('refreshes expired entries', async () => {
    let calls = 0;
    const countingNext: NextFunction = async () => {
      calls++;
      return { output: 'result', continue: true };
    };
    const mw = Middlewares.cache({ ttl: 0 }); // expires immediately
    await mw.fn(makeCtx('q'), countingNext);
    await new Promise((r) => setTimeout(r, 5)); // let it expire
    await mw.fn(makeCtx('q'), countingNext);
    expect(calls).toBe(2);
  });

  it('evicts LRU entry when maxSize is reached', async () => {
    const mw = Middlewares.cache({ ttl: 60000, maxSize: 2 });
    const makeNext =
      (v: string): NextFunction =>
      async () => ({ output: v, continue: true });
    await mw.fn(makeCtx('a'), makeNext('A'));
    await mw.fn(makeCtx('b'), makeNext('B'));
    // 'a' should be evicted when 'c' is inserted
    await mw.fn(makeCtx('c'), makeNext('C'));
    // 'a' should miss cache now
    let calls = 0;
    const countingNext: NextFunction = async () => {
      calls++;
      return { output: 'new-A', continue: true };
    };
    await mw.fn(makeCtx('a'), countingNext);
    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Middlewares.rateLimit
// ---------------------------------------------------------------------------
describe('Middlewares.rateLimit', () => {
  it('allows requests below the limit', async () => {
    const mw = Middlewares.rateLimit({ maxRequests: 5, windowMs: 1000 });
    for (let i = 0; i < 5; i++) {
      const result = await mw.fn(makeCtx(), identityNext);
      expect(result.output).toBe('test');
    }
  });

  it('throws when limit is exceeded', async () => {
    let triggered = false;
    const mw = Middlewares.rateLimit({
      maxRequests: 2,
      windowMs: 60000,
      onLimitReached: () => {
        triggered = true;
      },
    });
    await mw.fn(makeCtx(), identityNext);
    await mw.fn(makeCtx(), identityNext);
    await expect(mw.fn(makeCtx(), identityNext)).rejects.toThrow('Rate limit exceeded');
    expect(triggered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Middlewares.timeout
// ---------------------------------------------------------------------------
describe('Middlewares.timeout', () => {
  it('passes through for fast responses', async () => {
    const mw = Middlewares.timeout(5000);
    const result = await mw.fn(makeCtx(), identityNext);
    expect(result.output).toBe('test');
  });

  it('re-throws non-abort errors', async () => {
    const mw = Middlewares.timeout(5000);
    await expect(mw.fn(makeCtx(), errorNext)).rejects.toThrow('downstream error');
  });
});

// ---------------------------------------------------------------------------
// Middlewares.transformInput & transformOutput
// ---------------------------------------------------------------------------
describe('Middlewares.transformInput', () => {
  it('modifies processedInput before calling next', async () => {
    let seen: unknown;
    const spy: NextFunction = async (ctx) => {
      seen = ctx.processedInput;
      return { output: String(ctx.processedInput), continue: true };
    };
    const mw = Middlewares.transformInput((input) => `${input}-transformed`);
    await mw.fn(makeCtx('hello'), spy);
    expect(seen).toBe('hello-transformed');
  });
});

describe('Middlewares.transformOutput', () => {
  it('transforms the output after calling next', async () => {
    const mw = Middlewares.transformOutput((out) => out.toUpperCase());
    const result = await mw.fn(makeCtx('hello'), identityNext);
    expect(result.output).toBe('HELLO');
  });
});

// ---------------------------------------------------------------------------
// Middlewares.validation
// ---------------------------------------------------------------------------
describe('Middlewares.validation', () => {
  it('passes when input and output are valid', async () => {
    const mw = Middlewares.validation({
      validateInput: () => true,
      validateOutput: () => true,
    });
    const result = await mw.fn(makeCtx(), identityNext);
    expect(result.output).toBe('test');
  });

  it('throws when input validation fails with string message', async () => {
    const mw = Middlewares.validation({ validateInput: () => 'bad input' });
    await expect(mw.fn(makeCtx(), identityNext)).rejects.toThrow('bad input');
  });

  it('throws when input validation fails with false', async () => {
    const mw = Middlewares.validation({ validateInput: () => false });
    await expect(mw.fn(makeCtx(), identityNext)).rejects.toThrow('Input validation failed');
  });

  it('throws when output validation fails', async () => {
    const mw = Middlewares.validation({ validateOutput: () => 'bad output' });
    await expect(mw.fn(makeCtx(), identityNext)).rejects.toThrow('bad output');
  });
});

// ---------------------------------------------------------------------------
// Middlewares.fallback
// ---------------------------------------------------------------------------
describe('Middlewares.fallback', () => {
  it('returns fallback string on error', async () => {
    const mw = Middlewares.fallback('FALLBACK');
    const result = await mw.fn(makeCtx(), errorNext);
    expect(result.output).toBe('FALLBACK');
    expect(result.metadata?.fallback).toBe(true);
  });

  it('returns fallback from function on error', async () => {
    const mw = Middlewares.fallback((err) => `ERR:${err.message}`);
    const result = await mw.fn(makeCtx(), errorNext);
    expect(result.output).toBe('ERR:downstream error');
  });

  it('passes through on success', async () => {
    const mw = Middlewares.fallback('should not appear');
    const result = await mw.fn(makeCtx(), identityNext);
    expect(result.output).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// Middlewares.metrics
// ---------------------------------------------------------------------------
describe('Middlewares.metrics', () => {
  it('increments counters and records histogram on success', async () => {
    const collector = new InMemoryMetricsCollector();
    const mw = Middlewares.metrics(collector);
    await mw.fn(makeCtx(), identityNext);
    expect(collector.getCounter('requests_total')).toBe(1);
    expect(collector.getCounter('requests_success')).toBe(1);
    expect(collector.getHistogram('request_duration_ms').count).toBe(1);
  });

  it('increments requests_failed on error', async () => {
    const collector = new InMemoryMetricsCollector();
    const mw = Middlewares.metrics(collector);
    await expect(mw.fn(makeCtx(), errorNext)).rejects.toThrow();
    expect(collector.getCounter('requests_failed')).toBe(1);
    expect(collector.getCounter('requests_success')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Middlewares.circuitBreaker
// ---------------------------------------------------------------------------
describe('Middlewares.circuitBreaker', () => {
  it('stays closed when failures are below threshold', async () => {
    const mw = Middlewares.circuitBreaker({ threshold: 5, timeout: 60000 });
    const result = await mw.fn(makeCtx(), identityNext);
    expect(result.output).toBe('test');
  });

  it('opens after threshold failures and throws', async () => {
    let opened = false;
    const mw = Middlewares.circuitBreaker({
      threshold: 2,
      timeout: 60000,
      onOpen: () => {
        opened = true;
      },
    });
    await expect(mw.fn(makeCtx(), errorNext)).rejects.toThrow();
    await expect(mw.fn(makeCtx(), errorNext)).rejects.toThrow();
    // Circuit should now be open
    await expect(mw.fn(makeCtx(), identityNext)).rejects.toThrow('Circuit breaker is open');
    expect(opened).toBe(true);
  });

  it('closes circuit after half-open success', async () => {
    let closed = false;
    const mw = Middlewares.circuitBreaker({
      threshold: 1,
      timeout: 1, // very short
      onClose: () => {
        closed = true;
      },
    });
    // Open the circuit
    await expect(mw.fn(makeCtx(), errorNext)).rejects.toThrow();
    // Wait for timeout to expire
    await new Promise((r) => setTimeout(r, 5));
    // Half-open attempt should succeed and close circuit
    const result = await mw.fn(makeCtx(), identityNext);
    expect(result.output).toBe('test');
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Middlewares.dedupe
// ---------------------------------------------------------------------------
describe('Middlewares.dedupe', () => {
  it('deduplicates concurrent identical requests', async () => {
    let calls = 0;
    const slowNext: NextFunction = async (_ctx) => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { output: 'deduped', continue: true };
    };
    const mw = Middlewares.dedupe();
    const [a, b] = await Promise.all([
      mw.fn(makeCtx('same'), slowNext),
      mw.fn(makeCtx('same'), slowNext),
    ]);
    expect(calls).toBe(1);
    expect(a.output).toBe('deduped');
    expect(b.output).toBe('deduped');
  });

  it('does not dedupe different inputs', async () => {
    let calls = 0;
    const countNext: NextFunction = async (ctx) => {
      calls++;
      return { output: String(ctx.input), continue: true };
    };
    const mw = Middlewares.dedupe();
    await mw.fn(makeCtx('a'), countNext);
    await mw.fn(makeCtx('b'), countNext);
    expect(calls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// InMemoryMetricsCollector
// ---------------------------------------------------------------------------
describe('InMemoryMetricsCollector', () => {
  it('tracks counters, histograms, and gauges', () => {
    const c = new InMemoryMetricsCollector();
    c.incrementCounter('hits', 3);
    c.incrementCounter('hits');
    c.recordHistogram('latency', 10);
    c.recordHistogram('latency', 20);
    c.recordGauge('queue', 5);

    expect(c.getCounter('hits')).toBe(4);
    expect(c.getGauge('queue')).toBe(5);
    const h = c.getHistogram('latency');
    expect(h.count).toBe(2);
    expect(h.sum).toBe(30);
    expect(h.avg).toBe(15);
    expect(h.min).toBe(10);
    expect(h.max).toBe(20);
  });

  it('returns zeros for unknown metrics', () => {
    const c = new InMemoryMetricsCollector();
    expect(c.getCounter('unknown')).toBe(0);
    expect(c.getGauge('unknown')).toBe(0);
    expect(c.getHistogram('unknown')).toEqual({ count: 0, sum: 0, avg: 0, min: 0, max: 0 });
  });

  it('getAll returns all metrics', () => {
    const c = new InMemoryMetricsCollector();
    c.incrementCounter('a');
    c.recordGauge('b', 7);
    const all = c.getAll();
    expect(all.counters.a).toBe(1);
    expect(all.gauges.b).toBe(7);
  });

  it('reset clears all metrics', () => {
    const c = new InMemoryMetricsCollector();
    c.incrementCounter('x');
    c.reset();
    expect(c.getCounter('x')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ComposedMiddleware
// ---------------------------------------------------------------------------
describe('ComposedMiddleware', () => {
  it('executes chain with model', async () => {
    const composed = new ComposedMiddleware([], mockModel);
    const result = await composed.execute('hello');
    expect(result.output).toBe('PROC:hello');
  });

  it('executes chain without model (uses string coercion)', async () => {
    const composed = new ComposedMiddleware([]);
    const result = await composed.execute('raw');
    expect(result.output).toBe('raw');
  });

  it('executeInChain delegates to outer next when empty', async () => {
    const composed = new ComposedMiddleware([]);
    const ctx = makeCtx('in');
    const result = await composed.executeInChain(ctx, identityNext);
    expect(result.output).toBe('in');
  });

  it('executeInChain runs middlewares and falls through to outer next', async () => {
    const transform = Middlewares.transformOutput((o) => `[${o}]`);
    const composed = new ComposedMiddleware([transform]);
    const ctx = makeCtx('data');
    const result = await composed.executeInChain(ctx, identityNext);
    expect(result.output).toBe('[data]');
  });
});

// ---------------------------------------------------------------------------
// MiddlewareChain helpers: remove, useAt, forModel
// ---------------------------------------------------------------------------
describe('MiddlewareChain helpers', () => {
  it('remove deletes a middleware by name', () => {
    const passThrough: Middleware = {
      name: 'pass',
      fn: async (c, n) => n(c),
    };
    const chain = MiddlewareChain.create().use(passThrough);
    expect(chain.getMiddlewares()).toHaveLength(1);
    chain.remove('pass');
    expect(chain.getMiddlewares()).toHaveLength(0);
  });

  it('useAt inserts at specific index', () => {
    const make = (name: string): Middleware => ({
      name,
      fn: async (c, n) => n(c),
    });
    const chain = MiddlewareChain.create().use(make('a')).use(make('c'));
    chain.useAt(1, make('b'));
    expect(chain.getMiddlewares().map((m) => m.name)).toEqual(['a', 'b', 'c']);
  });

  it('useBefore unknown name appends at end', () => {
    const make = (name: string): Middleware => ({
      name,
      fn: async (c, n) => n(c),
    });
    const chain = MiddlewareChain.create().use(make('x'));
    chain.useBefore('nonexistent', make('y'));
    expect(chain.getMiddlewares().map((m) => m.name)).toEqual(['x', 'y']);
  });

  it('useAfter unknown name appends at end', () => {
    const make = (name: string): Middleware => ({
      name,
      fn: async (c, n) => n(c),
    });
    const chain = MiddlewareChain.create().use(make('x'));
    chain.useAfter('nonexistent', make('y'));
    expect(chain.getMiddlewares().map((m) => m.name)).toEqual(['x', 'y']);
  });

  it('forModel + build + wrap produce MiddlewareWrappedModel', async () => {
    const chain = MiddlewareChain.create().forModel(mockModel);
    const wrapped = chain.build().execute('hello');
    expect(await wrapped).toMatchObject({ output: 'PROC:hello' });
  });

  it('use with function creates named middleware', () => {
    const fn: Middleware['fn'] = async (c, n) => n(c);
    const chain = MiddlewareChain.create().use(fn);
    expect(chain.getMiddlewares()[0].name).toMatch(/middleware-/);
  });
});

// ---------------------------------------------------------------------------
// MiddlewareWrappedModel streaming
// ---------------------------------------------------------------------------
describe('MiddlewareWrappedModel streaming', () => {
  it('streams from underlying model if it supports streaming', async () => {
    const streamingModel: AIModel = {
      name: () => 'streamer',
      process: async () => 'full',
      supportsPromptType: () => true,
      supportsStreaming: () => true,
      stream: async function* () {
        yield 'chunk1';
        yield 'chunk2';
      },
    };
    const chain = MiddlewareChain.create();
    const wrapped = chain.wrap(streamingModel);
    expect(wrapped.supportsStreaming()).toBe(true);
    const chunks: string[] = [];
    for await (const chunk of wrapped.stream!('hello')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['chunk1', 'chunk2']);
  });

  it('falls back to process() when model has no stream method', async () => {
    const chain = MiddlewareChain.create();
    const wrapped = chain.wrap(mockModel);
    expect(wrapped.supportsStreaming()).toBe(false);
    const chunks: string[] = [];
    for await (const chunk of wrapped.stream!('hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['PROC:hi']);
  });
});

// ---------------------------------------------------------------------------
// StepMiddlewares
// ---------------------------------------------------------------------------
describe('StepMiddlewares', () => {
  const makeStepCtx = (): {
    stepId: string;
    stepName: string;
    agentIds: string[];
    input: string;
    executionContext: never;
    metadata: Map<string, unknown>;
  } => ({
    stepId: 'step-1',
    stepName: 'TestStep',
    agentIds: ['a1'],
    input: 'input',
    executionContext: {} as never,
    metadata: new Map<string, unknown>(),
  });

  const ts = Date.now();
  const mockResults = [
    { agentId: 'a1', taskId: 't1', output: 'done', success: true, timestamp: ts },
  ];

  it('logging middleware logs and returns results', async () => {
    const mw = StepMiddlewares.logging();
    const results = await mw.fn(makeStepCtx(), async () => mockResults);
    expect(results).toHaveLength(1);
  });

  it('timing middleware records step duration', async () => {
    const ctx = makeStepCtx();
    let recorded = '';
    const mw = StepMiddlewares.timing((id, _d) => {
      recorded = id;
    });
    await mw.fn(ctx, async () => mockResults);
    expect(ctx.metadata.get('stepDuration')).toBeGreaterThanOrEqual(0);
    expect(recorded).toBe('step-1');
  });

  it('filterResults filters based on predicate', async () => {
    const mw = StepMiddlewares.filterResults((r) => r.success === true);
    const results = await mw.fn(makeStepCtx(), async () => [
      ...mockResults,
      { agentId: 'a2', taskId: 't2', output: 'failed', success: false, timestamp: ts },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBe('a1');
  });

  it('enrichResults enriches each result', async () => {
    const mw = StepMiddlewares.enrichResults((r) => ({ ...r, output: r.output + '-enriched' }));
    const results = await mw.fn(makeStepCtx(), async () => mockResults);
    expect(results[0].output).toBe('done-enriched');
  });
});
