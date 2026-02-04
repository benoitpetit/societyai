import { MiddlewareChain, Middleware } from '../../core/middleware';
import { AIModel } from '../../core/types';

describe('Middleware System', () => {
  // Mock model for testing
  const mockModel: AIModel = {
    name: () => 'mock-model',
    process: async (input: unknown) => `Processed: ${input}`,
    supportsPromptType: () => true,
  };

  test('should execute middlewares in correct order', async () => {
    const order: string[] = [];

    const m1: Middleware = {
      name: 'm1',
      fn: async (ctx, next) => {
        order.push('m1-start');
        const res = await next(ctx);
        order.push('m1-end');
        return res;
      },
    };

    const m2: Middleware = {
      name: 'm2',
      fn: async (ctx, next) => {
        order.push('m2-start');
        const res = await next(ctx);
        order.push('m2-end');
        return res;
      },
    };

    const chain = MiddlewareChain.create().use(m1).use(m2).forModel(mockModel);

    const wrapped = chain.build();
    const result = await wrapped.execute('input');

    expect(result.output).toBe('Processed: input');
    expect(order).toEqual(['m1-start', 'm2-start', 'm2-end', 'm1-end']);
  });

  test('should allow modifying context and results', async () => {
    const modifier: Middleware = {
      name: 'modifier',
      fn: async (ctx, next) => {
        // Modify input
        ctx.processedInput = `Modified: ${ctx.processedInput}`;

        // Execute next
        const result = await next(ctx);

        // Modify output
        return {
          ...result,
          output: `Wrapped(${result.output})`,
        };
      },
    };

    const chain = MiddlewareChain.create().use(modifier).forModel(mockModel);

    const wrapped = chain.build();
    const result = await wrapped.execute('original');

    // Input becomes: Modified: original
    // Model output becomes: Processed: Modified: original
    // Middleware wraps output: Wrapped(Processed: Modified: original)
    expect(result.output).toBe('Wrapped(Processed: Modified: original)');
  });

  test('should short-circuit execution', async () => {
    const blocker: Middleware = {
      name: 'blocker',
      fn: async () => {
        return {
          output: 'Blocked',
          continue: false,
        };
      },
    };

    const spy = jest.spyOn(mockModel, 'process');

    const chain = MiddlewareChain.create().use(blocker).forModel(mockModel);

    const wrapped = chain.build();
    const result = await wrapped.execute('input');

    expect(result.output).toBe('Blocked');
    expect(spy).not.toHaveBeenCalled();
  });

  test('should handle errors in middleware', async () => {
    const errorMiddleware: Middleware = {
      name: 'error',
      fn: async () => {
        throw new Error('Middleware Error');
      },
    };

    const chain = MiddlewareChain.create().use(errorMiddleware).forModel(mockModel);

    const wrapped = chain.build();

    await expect(wrapped.execute('input')).rejects.toThrow('Middleware Error');
  });

  test('should allow inserting middleware at specific positions', async () => {
    const chain = MiddlewareChain.create();
    const m1 = { name: 'm1', fn: async (c: any, n: any) => n(c) };
    const m2 = { name: 'm2', fn: async (c: any, n: any) => n(c) };
    const m3 = { name: 'm3', fn: async (c: any, n: any) => n(c) };

    chain.use(m1);
    chain.useBefore('m1', m2); // m2, m1
    chain.useAfter('m1', m3); // m2, m1, m3

    const middlewares = chain.getMiddlewares();
    expect(middlewares.map((m) => m.name)).toEqual(['m2', 'm1', 'm3']);
  });

  test('should sort middlewares by priority', async () => {
    const chain = MiddlewareChain.create();
    const low = { name: 'low', priority: 1, fn: async (c: any, n: any) => n(c) };
    const high = { name: 'high', priority: 10, fn: async (c: any, n: any) => n(c) };
    const medium = { name: 'medium', priority: 5, fn: async (c: any, n: any) => n(c) };

    chain.use(low).use(high).use(medium);
    chain.sortByPriority();

    const middlewares = chain.getMiddlewares();
    expect(middlewares.map((m) => m.name)).toEqual(['high', 'medium', 'low']);
  });

  test('wrap() should return a working AIModel', async () => {
    const modifier: Middleware = {
      name: 'modifier',
      fn: async (ctx, next) => {
        ctx.processedInput = 'MODIFIED';
        return next(ctx);
      },
    };

    const chain = MiddlewareChain.create().use(modifier);
    const wrappedModel = chain.wrap(mockModel);

    expect(wrappedModel.name()).toContain(mockModel.name());
    expect(wrappedModel.supportsPromptType('text')).toBe(true);

    const result = await wrappedModel.process('input');
    expect(result).toBe('Processed: MODIFIED');
  });
});
