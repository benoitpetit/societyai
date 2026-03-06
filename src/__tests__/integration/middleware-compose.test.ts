import { MiddlewareChain, ComposedMiddleware, Middleware } from '../../core/middleware';
import { Society } from '../../index';
import { MockModel } from '../utils/mock-model';

import { Agent } from '../../core/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel() {
  const m = new MockModel();
  m.withDefaultResponse('model-response');
  return m;
}

function makeAgent(id: string, model: MockModel): Agent {
  return {
    id,
    name: id,
    role: {
      id: `role-${id}`,
      name: id,
      systemPrompt: `You are agent ${id}.`,
    },
    model,
    priority: 0,
  };
}

function recordingMiddleware(name: string, log: string[]): Middleware {
  return {
    name,
    fn: async (ctx, next) => {
      log.push(`${name}:before`);
      const result = await next(ctx);
      log.push(`${name}:after`);
      return result;
    },
  };
}

// ─── addMiddleware: raw Middleware ────────────────────────────────────────────

describe('addMiddleware – raw Middleware object', () => {
  test('a single raw middleware is applied during execution', async () => {
    const log: string[] = [];
    const model = makeModel();

    const result = await Society.create()
      .withName('raw-mw-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(recordingMiddleware('mw1', log))
      .execute('input');

    expect(result.success).toBe(true);
    expect(log).toContain('mw1:before');
    expect(log).toContain('mw1:after');
  });

  test('multiple raw middlewares are applied in registration order', async () => {
    const log: string[] = [];
    const model = makeModel();

    const result = await Society.create()
      .withName('multi-raw-mw-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(recordingMiddleware('mw1', log))
      .addMiddleware(recordingMiddleware('mw2', log))
      .execute('input');

    expect(result.success).toBe(true);
    // mw1 wraps mw2: before order = [mw1, mw2], after order reversed
    expect(log.indexOf('mw1:before')).toBeLessThan(log.indexOf('mw2:before'));
    expect(log.indexOf('mw2:after')).toBeLessThan(log.indexOf('mw1:after'));
  });
});

// ─── addMiddleware: MiddlewareChain ───────────────────────────────────────────

describe('addMiddleware – MiddlewareChain instance', () => {
  test('accepts a MiddlewareChain without throwing', () => {
    const model = makeModel();
    const chain = MiddlewareChain.create()
      .use(recordingMiddleware('c1', []))
      .use(recordingMiddleware('c2', []));

    expect(() =>
      Society.create()
        .withName('chain-test')
        .useAgents([makeAgent('a', model)])
        .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
        .addMiddleware(chain)
    ).not.toThrow();
  });

  test('middlewares from chain are executed during society execution', async () => {
    const log: string[] = [];
    const model = makeModel();

    const chain = MiddlewareChain.create()
      .use(recordingMiddleware('c1', log))
      .use(recordingMiddleware('c2', log));

    const result = await Society.create()
      .withName('chain-exec-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(chain)
      .execute('input');

    expect(result.success).toBe(true);
    expect(log).toContain('c1:before');
    expect(log).toContain('c2:before');
    expect(log).toContain('c1:after');
    expect(log).toContain('c2:after');
  });

  test('chain middlewares are flattened and maintain execution order', async () => {
    const log: string[] = [];
    const model = makeModel();

    const chain = MiddlewareChain.create()
      .use(recordingMiddleware('chain-first', log))
      .use(recordingMiddleware('chain-second', log));

    await Society.create()
      .withName('chain-order-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(recordingMiddleware('before-chain', log))
      .addMiddleware(chain)
      .addMiddleware(recordingMiddleware('after-chain', log))
      .execute('input');

    const beforeIdx = log.indexOf('before-chain:before');
    const chainFirstIdx = log.indexOf('chain-first:before');
    const chainSecondIdx = log.indexOf('chain-second:before');
    const afterIdx = log.indexOf('after-chain:before');

    expect(beforeIdx).toBeLessThan(chainFirstIdx);
    expect(chainFirstIdx).toBeLessThan(chainSecondIdx);
    expect(chainSecondIdx).toBeLessThan(afterIdx);
  });

  test('MiddlewareChain.getMiddlewares() returns all registered middlewares', () => {
    const log: string[] = [];
    const chain = MiddlewareChain.create()
      .use(recordingMiddleware('m1', log))
      .use(recordingMiddleware('m2', log))
      .use(recordingMiddleware('m3', log));

    const middlewares = chain.getMiddlewares();
    expect(middlewares.map((m) => m.name)).toEqual(['m1', 'm2', 'm3']);
  });

  test('empty MiddlewareChain passed to addMiddleware does not break execution', async () => {
    const model = makeModel();
    const emptyChain = MiddlewareChain.create();

    const result = await Society.create()
      .withName('empty-chain-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(emptyChain)
      .execute('input');

    expect(result.success).toBe(true);
  });
});

// ─── addMiddleware: ComposedMiddleware ────────────────────────────────────────

describe('addMiddleware – ComposedMiddleware (chain.build())', () => {
  test('accepts a ComposedMiddleware returned by chain.build() without throwing', () => {
    const log: string[] = [];
    const model = makeModel();

    const composed = MiddlewareChain.create()
      .use(recordingMiddleware('comp1', log))
      .forModel(new MockModel())
      .build();

    expect(composed).toBeInstanceOf(ComposedMiddleware);

    expect(() =>
      Society.create()
        .withName('composed-test')
        .useAgents([makeAgent('a', model)])
        .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
        .addMiddleware(composed)
    ).not.toThrow();
  });

  test('ComposedMiddleware.executeInChain is defined and callable', async () => {
    const log: string[] = [];

    const composed = MiddlewareChain.create()
      .use(recordingMiddleware('em1', log))
      .forModel(new MockModel())
      .build();

    expect(typeof composed.executeInChain).toBe('function');

    // Call executeInChain directly to verify it invokes the middleware
    const ctx = {
      processedInput: 'test-input',
      metadata: {},
      startTime: Date.now(),
    };
    const next = async () => {
      return { output: 'next-output', continue: true };
    };

    const result = await composed.executeInChain(ctx as never, next);

    expect(log).toContain('em1:before');
    expect(result).toBeDefined();
  });

  test('ComposedMiddleware executes during society execution', async () => {
    const log: string[] = [];
    const model = makeModel();

    const composed = MiddlewareChain.create()
      .use(recordingMiddleware('comp-exec', log))
      .forModel(new MockModel())
      .build();

    const result = await Society.create()
      .withName('composed-exec-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(composed)
      .execute('input');

    expect(result.success).toBe(true);
    expect(log).toContain('comp-exec:before');
    expect(log).toContain('comp-exec:after');
  });

  test('ComposedMiddleware can be combined with other middlewares', async () => {
    const log: string[] = [];
    const model = makeModel();

    const composed = MiddlewareChain.create()
      .use(recordingMiddleware('inner', log))
      .forModel(new MockModel())
      .build();

    const result = await Society.create()
      .withName('composed-combined-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(recordingMiddleware('outer-before', log))
      .addMiddleware(composed)
      .addMiddleware(recordingMiddleware('outer-after', log))
      .execute('input');

    expect(result.success).toBe(true);
    expect(log).toContain('outer-before:before');
    expect(log).toContain('inner:before');
    expect(log).toContain('outer-after:before');
  });
});

// ─── addMiddleware: middleware output transformation ──────────────────────────

describe('addMiddleware – output transformation', () => {
  test('middleware can transform model output', async () => {
    const model = makeModel();
    // model returns 'model-response' by default

    let capturedOutput = '';

    const capturingMiddleware: Middleware = {
      name: 'capture',
      fn: async (ctx, next) => {
        const result = await next(ctx);
        capturedOutput = result.output;
        return result;
      },
    };

    const result = await Society.create()
      .withName('transform-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(capturingMiddleware)
      .execute('input');

    expect(result.success).toBe(true);
    expect(capturedOutput).toBe('model-response');
  });

  test('middleware chain passed via MiddlewareChain can transform output', async () => {
    const model = makeModel();
    let capturedOutput = '';

    const capturingMiddleware: Middleware = {
      name: 'capture-chain',
      fn: async (ctx, next) => {
        const result = await next(ctx);
        capturedOutput = result.output;
        return result;
      },
    };

    const chain = MiddlewareChain.create().use(capturingMiddleware);

    const result = await Society.create()
      .withName('chain-transform-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(chain)
      .execute('input');

    expect(result.success).toBe(true);
    expect(capturedOutput).toBe('model-response');
  });
});

// ─── addMiddleware: error resilience ─────────────────────────────────────────

describe('addMiddleware – error resilience', () => {
  test('middleware that throws propagates the error', async () => {
    const model = makeModel();

    const throwingMiddleware: Middleware = {
      name: 'thrower',
      fn: async () => {
        throw new Error('middleware-error');
      },
    };

    const result = await Society.create()
      .withName('error-mw-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(throwingMiddleware)
      .execute('input');

    // Society executor catches errors and sets success: false
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test('MiddlewareChain with throwing middleware propagates the error', async () => {
    const model = makeModel();

    const throwingMiddleware: Middleware = {
      name: 'chain-thrower',
      fn: async () => {
        throw new Error('chain-middleware-error');
      },
    };

    const chain = MiddlewareChain.create().use(throwingMiddleware);

    const result = await Society.create()
      .withName('chain-error-test')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
      .addMiddleware(chain)
      .execute('input');

    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
