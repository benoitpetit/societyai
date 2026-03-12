/**
 * Extended coverage tests for society.ts
 *
 * Targets uncovered lines: 155-159, 205-206, 261-312, 321, 341-357,
 * 542-550, 559-561, 574-616
 */

import { Society, SocietyPatterns, AggregationStrategies } from '../../builders/builder';
import { InvalidConfigurationError } from '../../core/errors';
import { Middlewares, MiddlewareChain } from '../../core/middleware';
import { AIModel, Message, ExecutionContext } from '../../core/types';

// ---------------------------------------------------------------------------
// Minimal mock model
// ---------------------------------------------------------------------------

function makeMockModel(response = 'ok'): AIModel {
  return {
    name: () => 'mock',
    supportsPromptType: () => true,
    process: jest.fn().mockResolvedValue(response),
  };
}

function makeAgent(id: string, model?: AIModel) {
  return {
    id,
    name: id,
    role: { systemPrompt: 'You are helpful.' },
    model: model ?? makeMockModel(),
  };
}

// ---------------------------------------------------------------------------
// Helpers to build a minimal valid society
// ---------------------------------------------------------------------------

function buildMinimalSociety(id = 'test', agentId = 'a1', taskId = 'task1') {
  return Society.create(id)
    .withName('Test Society')
    .addAgent((a) =>
      a
        .withId(agentId)
        .withRole((r) => r.withSystemPrompt('sys'))
        .withModel(makeMockModel())
    )
    .addTask((t) => t.withId(taskId).withName('Task').withAgents([agentId]).sequential());
}

// ============================================================================
// Builder methods — hooks, timeout, retention policy, observer
// ============================================================================

describe('Society builder — hooks and options', () => {
  it('beforeTask() and afterTask() are stored and returned in build()', () => {
    const onBefore = jest.fn();
    const onAfter = jest.fn();
    const config = buildMinimalSociety('hooks-test')
      .beforeTask(onBefore as never)
      .afterTask(onAfter as never)
      .build();
    expect(config.onBeforeTask).toBe(onBefore);
    expect(config.onAfterTask).toBe(onAfter);
  });

  it('withFinalResultGenerator() is stored in build()', () => {
    const generator = jest.fn().mockReturnValue('final');
    const config = buildMinimalSociety('gen-test')
      .withFinalResultGenerator(generator as never)
      .build();
    expect(config.finalResultGenerator).toBe(generator);
  });

  it('withTimeout() is stored in build()', () => {
    const config = buildMinimalSociety('timeout-test').withTimeout(5000).build();
    expect(config.timeout).toBe(5000);
  });

  it('withRetentionPolicy() is stored in build()', () => {
    const policy = { maxMessages: 10 };
    const config = buildMinimalSociety('ret-test').withRetentionPolicy(policy).build();
    expect(config.retentionPolicy).toEqual(policy);
  });

  it('withObserver() is stored in build()', () => {
    const observer = { onEvent: jest.fn() };
    const config = buildMinimalSociety('obs-test')
      .withObserver(observer as never)
      .build();
    expect(config.observer).toBe(observer);
  });
});

// ============================================================================
// scatterGather() / chain() / collaborate() — throw on existing tasks
// ============================================================================

describe('Society shorthand methods — throw on existing tasks', () => {
  it('scatterGather() throws when tasks already exist', () => {
    const s = Society.create('sg-throw')
      .addAgent((a) =>
        a
          .withId('a1')
          .withRole((r) => r.withSystemPrompt('sys'))
          .withModel(makeMockModel())
      )
      .addTask((t) => t.withId('t1').withName('T').withAgents(['a1']).sequential());
    expect(() => s.scatterGather()).toThrow(InvalidConfigurationError);
  });

  it('chain() throws when tasks already exist', () => {
    const s = Society.create('chain-throw')
      .addAgent((a) =>
        a
          .withId('a1')
          .withRole((r) => r.withSystemPrompt('sys'))
          .withModel(makeMockModel())
      )
      .addTask((t) => t.withId('t1').withName('T').withAgents(['a1']).sequential());
    expect(() => s.chain()).toThrow(InvalidConfigurationError);
  });

  it('collaborate() throws when tasks already exist', () => {
    const s = Society.create('collab-throw')
      .addAgent((a) =>
        a
          .withId('a1')
          .withRole((r) => r.withSystemPrompt('sys'))
          .withModel(makeMockModel())
      )
      .addTask((t) => t.withId('t1').withName('T').withAgents(['a1']).sequential());
    expect(() => s.collaborate()).toThrow(InvalidConfigurationError);
  });

  it('scatterGather() works with a custom aggregator', () => {
    const agg = jest.fn().mockReturnValue('aggregated');
    const s = Society.create('sg-agg')
      .addAgent((a) =>
        a
          .withId('a1')
          .withRole((r) => r.withSystemPrompt('sys'))
          .withModel(makeMockModel())
      )
      .scatterGather(agg);
    const config = s.build();
    expect(config.tasks[0].executionType).toBe('parallel');
    expect(typeof config.tasks[0].resultTransformer).toBe('function');
  });

  it('collaborate() stores maxIterations', () => {
    const s = Society.create('collab-iters')
      .addAgent((a) =>
        a
          .withId('a1')
          .withRole((r) => r.withSystemPrompt('sys'))
          .withModel(makeMockModel())
      )
      .collaborate(5);
    const config = s.build();
    expect(config.tasks[0].maxIterations).toBe(5);
  });
});

// ============================================================================
// execute() with timeout
// ============================================================================

describe('Society.execute() with timeout', () => {
  it('executes successfully within timeout', async () => {
    const s = buildMinimalSociety('exec-timeout', 'a1', 'task1').withTimeout(10000);
    const result = await s.execute('hello');
    expect(result).toBeDefined();
  });

  it('passes external signal through', async () => {
    const controller = new AbortController();
    const s = buildMinimalSociety('exec-signal', 'a1', 'task1');
    // Signal not aborted — should complete normally
    const result = await s.execute('hello', controller.signal);
    expect(result).toBeDefined();
  });

  it('passes both timeout and external signal', async () => {
    const controller = new AbortController();
    const s = buildMinimalSociety('exec-both', 'a1', 'task1').withTimeout(10000);
    const result = await s.execute('hello', controller.signal);
    expect(result).toBeDefined();
  });
});

// ============================================================================
// SocietyPatterns
// ============================================================================

describe('SocietyPatterns', () => {
  const model = makeMockModel();
  const agents = [makeAgent('w1', model), makeAgent('w2', model)];

  it('parallel() creates a scatter-gather society', () => {
    const s = SocietyPatterns.parallel(agents as never);
    const config = s.build();
    expect(config.tasks.length).toBe(1);
    expect(config.tasks[0].executionType).toBe('parallel');
  });

  it('chain() creates a sequential chain society', () => {
    const s = SocietyPatterns.chain(agents as never);
    const config = s.build();
    expect(config.tasks.length).toBe(2);
    config.tasks.forEach((t) => expect(t.executionType).toBe('sequential'));
  });

  it('collaborative() creates a collaborative society', () => {
    const s = SocietyPatterns.collaborative(agents as never, 4);
    const config = s.build();
    expect(config.tasks.length).toBe(1);
    expect(config.tasks[0].executionType).toBe('collaborative');
    expect(config.tasks[0].maxIterations).toBe(4);
  });

  it('collaborative() defaults to 3 iterations', () => {
    const s = SocietyPatterns.collaborative(agents as never);
    const config = s.build();
    expect(config.tasks[0].maxIterations).toBe(3);
  });

  it('review() creates a 3-step review pipeline', () => {
    const [writer, reviewer] = agents;
    const s = SocietyPatterns.review(writer as never, reviewer as never);
    const config = s.build();
    expect(config.tasks.length).toBe(3);
    expect(config.tasks[0].id).toBe('draft');
    expect(config.tasks[1].id).toBe('review');
    expect(config.tasks[2].id).toBe('revise');
  });
});

// ============================================================================
// addMiddleware() with MiddlewareChain and ComposedMiddleware
// ============================================================================

describe('Society.addMiddleware()', () => {
  it('accepts MiddlewareChain and flattens its middlewares', () => {
    const chain = MiddlewareChain.create().use(Middlewares.logging()).use(Middlewares.logging());
    const config = buildMinimalSociety('mw-chain').addMiddleware(chain).build();
    expect(config.middlewares?.length).toBe(2);
  });

  it('accepts ComposedMiddleware', () => {
    const chain = MiddlewareChain.create().use(Middlewares.logging());
    const composed = chain.build();
    const config = buildMinimalSociety('mw-composed').addMiddleware(composed).build();
    expect(config.middlewares?.length).toBe(1);
    expect(config.middlewares?.[0].name).toBe('composed-middleware');
  });

  it('accepts raw Middleware objects', () => {
    const mw = Middlewares.logging();
    const config = buildMinimalSociety('mw-raw').addMiddleware(mw).build();
    expect(config.middlewares?.length).toBe(1);
  });
});
