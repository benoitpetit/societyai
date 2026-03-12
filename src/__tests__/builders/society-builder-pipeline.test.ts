/**
 * Coverage tests for society-builder.ts
 *
 * Targets:
 * - FluentPipelineBuilder (all patterns: chain, scatter-gather, fallback, race, router)
 * - AggregationStrategies (concat, first, last, best, reduce, structured)
 * - FluentTaskBuilder extended paths (withCondition, withInstructions, withOutputSchema,
 *   withExecutionType, withLoopConfig, withCompletionCondition, transformResults,
 *   thenGoto, withNextSteps, withConditionalNext, thenResolve, withTimeout, isHuman,
 *   withMaxIterations, withAgents)
 * - roleBuilder / createRole / agentBuilder / createAgent helpers
 */

import {
  FluentPipelineBuilder,
  AggregationStrategies,
  FluentTaskBuilder,
  roleBuilder,
  createRole,
} from '../../builders/society-builder';
import { TaskResult } from '../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    agentId: 'agent1',
    taskId: 'task1',
    output: 'result',
    success: true,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FluentPipelineBuilder
// ---------------------------------------------------------------------------

describe('FluentPipelineBuilder — chain pattern', () => {
  it('builds a chain of sequential steps', () => {
    const config = new FluentPipelineBuilder().chain(['a1', 'a2', 'a3']).build();
    expect(config.pattern).toBe('chain');
    expect(config.agentIds).toEqual(['a1', 'a2', 'a3']);
  });

  it('toSteps() produces chain tasks with nextTasks wired', () => {
    const steps = new FluentPipelineBuilder().chain(['a1', 'a2', 'a3']).toSteps();
    expect(steps).toHaveLength(3);
    expect(steps[0].id).toBe('chain-0');
    expect(steps[0].nextTasks).toEqual(['chain-1']);
    expect(steps[1].nextTasks).toEqual(['chain-2']);
    expect(steps[2].nextTasks).toBeUndefined();
  });

  it('chain step has sequential executionType', () => {
    const steps = new FluentPipelineBuilder().chain(['a1']).toSteps();
    expect(steps[0].executionType).toBe('sequential');
  });
});

describe('FluentPipelineBuilder — scatter-gather pattern', () => {
  it('builds scatter-gather config', () => {
    const config = new FluentPipelineBuilder().scatterGather(['a1', 'a2']).build();
    expect(config.pattern).toBe('scatter-gather');
  });

  it('toSteps() produces one parallel step', () => {
    const steps = new FluentPipelineBuilder().scatterGather(['a1', 'a2']).toSteps();
    expect(steps).toHaveLength(1);
    expect(steps[0].executionType).toBe('parallel');
    expect(steps[0].id).toBe('scatter');
  });

  it('toSteps() uses provided aggregator', () => {
    const agg = (results: TaskResult[]): string => results.map((r) => r.output).join(',');
    const steps = new FluentPipelineBuilder().scatterGather(['a1', 'a2']).aggregate(agg).toSteps();
    expect(steps[0].resultTransformer).toBeDefined();
    const results = [makeResult({ output: 'x' }), makeResult({ output: 'y' })];
    expect(steps[0].resultTransformer!(results)).toBe('x,y');
  });
});

describe('FluentPipelineBuilder — fallback pattern', () => {
  it('builds fallback config', () => {
    const config = new FluentPipelineBuilder().fallback(['a1', 'a2']).build();
    expect(config.pattern).toBe('fallback');
  });

  it('toSteps() produces per-agent tasks with nextTaskResolvers', () => {
    const steps = new FluentPipelineBuilder().fallback(['a1', 'a2']).toSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0].nextTaskResolver).toBeDefined();
    expect(steps[1].nextTaskResolver).toBeDefined();
  });

  it('nextTaskResolver routes to next agent on failure', () => {
    const steps = new FluentPipelineBuilder().fallback(['a1', 'a2']).toSteps();
    const failedResult = makeResult({ taskId: 'fallback-0', success: false });
    const next = steps[0].nextTaskResolver!([failedResult]);
    expect(next).toBe('fallback-1');
  });

  it('nextTaskResolver returns null on success (done)', () => {
    const steps = new FluentPipelineBuilder().fallback(['a1', 'a2']).toSteps();
    const successResult = makeResult({ taskId: 'fallback-0', success: true });
    const next = steps[0].nextTaskResolver!([successResult]);
    expect(next).toBeNull();
  });

  it('last fallback agent has null possibleNextTasks', () => {
    const steps = new FluentPipelineBuilder().fallback(['a1', 'a2']).toSteps();
    expect(steps[1].possibleNextTasks).toEqual([]);
  });
});

describe('FluentPipelineBuilder — race pattern', () => {
  it('builds race config', () => {
    const config = new FluentPipelineBuilder().race(['a1', 'a2']).build();
    expect(config.pattern).toBe('race');
  });

  it('toSteps() produces one parallel step', () => {
    const steps = new FluentPipelineBuilder().race(['a1', 'a2']).toSteps();
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('race');
    expect(steps[0].executionType).toBe('parallel');
  });

  it('resultTransformer returns first successful result', () => {
    const steps = new FluentPipelineBuilder().race(['a1', 'a2']).toSteps();
    const results = [
      makeResult({ success: false, output: 'fail' }),
      makeResult({ success: true, output: 'win' }),
    ];
    expect(steps[0].resultTransformer!(results)).toBe('win');
  });

  it('resultTransformer falls back to first result when none succeed', () => {
    const steps = new FluentPipelineBuilder().race(['a1']).toSteps();
    const results = [makeResult({ success: false, output: 'only' })];
    expect(steps[0].resultTransformer!(results)).toBe('only');
  });

  it('resultTransformer handles single TaskResult (non-array)', () => {
    const steps = new FluentPipelineBuilder().race(['a1']).toSteps();
    const single = makeResult({ success: true, output: 'single' });
    expect(steps[0].resultTransformer!(single)).toBe('single');
  });
});

describe('FluentPipelineBuilder — router pattern', () => {
  it('toSteps() prepends a router task and adds per-agent tasks', () => {
    const routerFn = (_input: string): string => 'a2';
    const steps = new FluentPipelineBuilder().router(['a1', 'a2'], routerFn).toSteps();
    expect(steps[0].id).toBe('router');
    expect(steps[1].id).toBe('route-0');
    expect(steps[2].id).toBe('route-1');
  });

  it('router nextTaskResolver routes to correct agent index', () => {
    const routerFn = (_input: string): string => 'a2';
    const steps = new FluentPipelineBuilder().router(['a1', 'a2'], routerFn).toSteps();
    const routerTask = steps[0];
    // The router receives an empty results array; last result output is used as input
    const result = routerTask.nextTaskResolver!([makeResult({ output: 'hello' })]);
    expect(result).toBe('route-1');
  });

  it('router nextTaskResolver returns null for unknown agent', () => {
    const routerFn = (_input: string): string => 'unknown-agent';
    const steps = new FluentPipelineBuilder().router(['a1', 'a2'], routerFn).toSteps();
    const routerTask = steps[0];
    const result = routerTask.nextTaskResolver!([makeResult({ output: 'hello' })]);
    expect(result).toBeNull();
  });

  it('router condition always returns true', () => {
    const routerFn = (_input: string): string => 'a1';
    const steps = new FluentPipelineBuilder().router(['a1'], routerFn).toSteps();
    const routerTask = steps[0];
    expect(routerTask.condition!(new Map())).toBe(true);
  });

  it('toSteps() throws without router function', () => {
    // Build a pipeline set to router pattern without supplying routerFn
    const builder = new FluentPipelineBuilder();
    // Directly set the pattern without calling .router()
    (builder as unknown as { _pattern: string })._pattern = 'router';
    (builder as unknown as { _agentIds: string[] })._agentIds = ['a1'];
    expect(() => builder.toSteps()).toThrow();
  });
});

describe('FluentPipelineBuilder — build() extras', () => {
  it('withTimeout sets timeout in config', () => {
    const config = new FluentPipelineBuilder().chain(['a1']).withTimeout(5000).build();
    expect(config.timeout).toBe(5000);
  });

  it('aggregate sets aggregator in config', () => {
    const agg = (): string => 'aggregated';
    const config = new FluentPipelineBuilder().scatterGather(['a1']).aggregate(agg).build();
    expect(config.aggregator).toBe(agg);
  });

  it('onAllFailed sets fallbackHandler in build result', () => {
    const handler = (): string => 'fallback';
    const result = new FluentPipelineBuilder().fallback(['a1']).onAllFailed(handler).build();
    expect(result.fallbackHandler).toBe(handler);
  });
});

// ---------------------------------------------------------------------------
// AggregationStrategies
// ---------------------------------------------------------------------------

describe('AggregationStrategies.concat()', () => {
  it('concatenates successful results with default separator', () => {
    const fn = AggregationStrategies.concat();
    const results = [
      makeResult({ output: 'a', success: true }),
      makeResult({ output: 'b', success: true }),
    ];
    expect(fn(results)).toBe('a\n\nb');
  });

  it('uses custom separator', () => {
    const fn = AggregationStrategies.concat(' | ');
    const results = [
      makeResult({ output: 'x', success: true }),
      makeResult({ output: 'y', success: true }),
    ];
    expect(fn(results)).toBe('x | y');
  });

  it('ignores failed results', () => {
    const fn = AggregationStrategies.concat();
    const results = [
      makeResult({ output: 'ok', success: true }),
      makeResult({ output: 'bad', success: false }),
    ];
    expect(fn(results)).toBe('ok');
  });
});

describe('AggregationStrategies.first()', () => {
  it('returns the first successful result', () => {
    const fn = AggregationStrategies.first();
    const results = [
      makeResult({ output: 'first', success: true }),
      makeResult({ output: 'second', success: true }),
    ];
    expect(fn(results)).toBe('first');
  });

  it('returns empty string when no successes', () => {
    const fn = AggregationStrategies.first();
    expect(fn([makeResult({ success: false })])).toBe('');
  });
});

describe('AggregationStrategies.last()', () => {
  it('returns the last successful result', () => {
    const fn = AggregationStrategies.last();
    const results = [
      makeResult({ output: 'first', success: true }),
      makeResult({ output: 'last', success: true }),
    ];
    expect(fn(results)).toBe('last');
  });

  it('returns empty string when no successes', () => {
    const fn = AggregationStrategies.last();
    expect(fn([])).toBe('');
  });
});

describe('AggregationStrategies.best()', () => {
  it('returns the result with the highest score', () => {
    const scorer = (r: TaskResult): number => r.output.length;
    const fn = AggregationStrategies.best(scorer);
    const results = [
      makeResult({ output: 'hi', success: true }),
      makeResult({ output: 'hello world', success: true }),
    ];
    expect(fn(results)).toBe('hello world');
  });

  it('returns empty string when no successes', () => {
    const scorer = (): number => 1;
    const fn = AggregationStrategies.best(scorer);
    expect(fn([])).toBe('');
  });
});

describe('AggregationStrategies.reduce()', () => {
  it('reduces results to a string via custom logic', () => {
    const fn = AggregationStrategies.reduce<string[]>(
      (acc, r) => [...acc, r.output],
      [],
      (acc) => acc.join('+')
    );
    const results = [
      makeResult({ output: 'a', success: true }),
      makeResult({ output: 'b', success: true }),
    ];
    expect(fn(results)).toBe('a+b');
  });
});

describe('AggregationStrategies.structured()', () => {
  const results = [
    makeResult({ agentId: 'a1', output: 'out1', success: true }),
    makeResult({ agentId: 'a2', output: 'out2', success: true }),
  ];

  it('formats as markdown (default)', () => {
    const fn = AggregationStrategies.structured();
    const result = fn(results);
    expect(result).toContain('## a1');
    expect(result).toContain('## a2');
  });

  it('formats as json', () => {
    const fn = AggregationStrategies.structured('json');
    const result = JSON.parse(fn(results));
    expect(result).toHaveLength(2);
    expect(result[0].agent).toBe('a1');
  });

  it('formats as list', () => {
    const fn = AggregationStrategies.structured('list');
    const result = fn(results);
    expect(result).toContain('- [a1]: out1');
  });
});

// ---------------------------------------------------------------------------
// FluentTaskBuilder — extended paths
// ---------------------------------------------------------------------------

describe('FluentTaskBuilder — extended builder methods', () => {
  it('withAgents sets multiple agents at once', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .withAgents(['a1', 'a2'])
      .sequential()
      .build();
    expect(step.agentIds).toEqual(['a1', 'a2']);
  });

  it('withExecutionType sets execution type', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .withExecutionType('parallel')
      .build();
    expect(step.executionType).toBe('parallel');
  });

  it('isHuman() sets human execution type (no agents required)', () => {
    const step = FluentTaskBuilder.create().withId('t').withName('T').isHuman().build();
    expect(step.executionType).toBe('human');
  });

  it('withCondition sets condition function', () => {
    const cond = (): boolean => true;
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .withCondition(cond)
      .sequential()
      .build();
    expect(step.condition).toBe(cond);
  });

  it('withInstructions sets instructions field', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .withInstructions('Do this')
      .sequential()
      .build();
    expect(step.instructions).toBe('Do this');
  });

  it('withOutputSchema sets schema field', () => {
    const schema = { type: 'object' as const };
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .withOutputSchema(schema)
      .sequential()
      .build();
    expect(step.outputSchema).toBe(schema);
  });

  it('withLoopConfig sets loop config', () => {
    const loopConfig = { maxIterations: 3, exitCondition: (): boolean => false };
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .withLoopConfig(loopConfig)
      .build();
    expect(step.loopConfig).toBe(loopConfig);
    expect(step.maxIterations).toBe(3);
  });

  it('withCompletionCondition sets completion condition', () => {
    const cond = (): boolean => true;
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .collaborative()
      .withCompletionCondition(cond)
      .build();
    expect(step.completionCondition).toBe(cond);
  });

  it('withMaxIterations sets max iterations', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .collaborative()
      .withMaxIterations(7)
      .build();
    expect(step.maxIterations).toBe(7);
  });

  it('transformResults sets result transformer', () => {
    const xf = (): string => 'transformed';
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .transformResults(xf)
      .build();
    expect(step.resultTransformer).toBe(xf);
  });

  it('thenGoto sets nextTasks', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .thenGoto(['step2'])
      .build();
    expect(step.nextTasks).toEqual(['step2']);
  });

  it('withNextSteps sets nextTasks (alias for thenGoto)', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withNextSteps(['step3'])
      .build();
    expect(step.nextTasks).toEqual(['step3']);
  });

  it('withConditionalNext creates a nextTaskResolver', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withConditionalNext(() => true, 'yes', 'no')
      .build();
    expect(step.nextTaskResolver).toBeDefined();
    const result = step.nextTaskResolver!([makeResult({ taskId: 't' })]);
    expect(result).toBe('yes');
  });

  it('withConditionalNext without fallback routes to null on false', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withConditionalNext(() => false, 'yes')
      .build();
    const result = step.nextTaskResolver!([makeResult({ taskId: 't' })]);
    expect(result).toBeNull();
  });

  it('thenResolve sets nextTaskResolver directly', () => {
    const resolver = (): string => 'custom-task';
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .thenResolve(resolver)
      .build();
    expect(step.nextTaskResolver).toBe(resolver);
  });

  it('withTimeout sets timeout in built task', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withTimeout(3000)
      .build();
    expect((step as { timeout?: number }).timeout).toBe(3000);
  });

  it('build() throws when id is missing', () => {
    expect(() =>
      FluentTaskBuilder.create().withName('T').addAgent('a').sequential().build()
    ).toThrow();
  });

  it('build() throws when agents missing and not human', () => {
    expect(() =>
      FluentTaskBuilder.create().withId('t').withName('T').sequential().build()
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// withBranch — extended paths
// ---------------------------------------------------------------------------

describe('FluentTaskBuilder — withBranch()', () => {
  it('routes to false tasks when condition returns false', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withBranch(() => false, ['yes'], ['no'])
      .build();
    const result = step.nextTaskResolver!([makeResult()]);
    expect(result).toBe('no');
  });

  it('returns null when trueTasks is empty and condition is true', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withBranch(() => true, [], ['no'])
      .build();
    const result = step.nextTaskResolver!([makeResult()]);
    expect(result).toBeNull();
  });

  it('sets possibleNextTasks to union of true and false tasks', () => {
    const step = FluentTaskBuilder.create()
      .withId('t')
      .withName('T')
      .addAgent('a')
      .sequential()
      .withBranch(() => true, ['yes1', 'yes2'], ['no1'])
      .build();
    expect(step.possibleNextTasks).toEqual(expect.arrayContaining(['yes1', 'yes2', 'no1']));
  });
});

// ---------------------------------------------------------------------------
// roleBuilder / createRole helpers
// ---------------------------------------------------------------------------

describe('roleBuilder() / createRole()', () => {
  it('creates a FluentRoleBuilder with id and systemPrompt', () => {
    const rb = roleBuilder('analyst', 'You are an analyst.');
    const role = rb.build();
    expect(role.id).toBe('analyst');
    expect(role.systemPrompt).toBe('You are an analyst.');
  });

  it('supports all options', () => {
    const rb = roleBuilder('r1', 'prompt', {
      name: 'Role One',
      description: 'desc',
      capabilities: ['cap1'],
      constraints: ['con1'],
      promptTemplate: 'tmpl',
    });
    const role = rb.build();
    expect(role.name).toBe('Role One');
    expect(role.description).toBe('desc');
  });

  it('works without systemPrompt - creates role with empty prompt', () => {
    const rb = roleBuilder('r2', 'Required prompt');
    expect(rb.build().id).toBe('r2');
  });

  it('createRole is an alias for roleBuilder', () => {
    const rb = createRole('r3', 'prompt');
    expect(rb.build().id).toBe('r3');
  });
});
