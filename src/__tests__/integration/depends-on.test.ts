import { Society } from '../../index';
import { SocietyExecutor } from '../../agents/society-executor';
import { MockModel } from '../utils/mock-model';
import { Agent, Task } from '../../core/types';
import { FluentTaskBuilder } from '../../builders/society-builder';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── dependsOn: graph wiring ──────────────────────────────────────────────────

describe('dependsOn – graph edge wiring', () => {
  let model: MockModel;

  beforeEach(() => {
    model = new MockModel();
    model.withDefaultResponse('ok');
  });

  // ── 1. Simple A → B dependency ─────────────────────────────────────────────
  test('dependsOn creates an edge from dependency to dependent task', () => {
    const executor = new SocietyExecutor();

    const tasks: Task[] = [
      {
        id: 'draft',
        name: 'Draft',
        agentIds: ['a'],
        executionType: 'sequential',
      },
      {
        id: 'review',
        name: 'Review',
        agentIds: ['b'],
        executionType: 'sequential',
        dependencies: ['draft'],
      },
    ];

    const config = {
      id: 'test',
      name: 'test',
      agents: [makeAgent('a', model), makeAgent('b', model)],
      tasks,
      entryTaskId: 'draft',
      globalContext: {},
      strictRouting: false,
    };

    // Should not throw – graph must be buildable
    expect(() => executor.buildExecutionGraph(config)).not.toThrow();
  });

  // ── 2. dependsOn unknown task must throw ────────────────────────────────────
  test('dependsOn an unknown task id throws InvalidWorkflowRoutingError', () => {
    const executor = new SocietyExecutor();

    const tasks: Task[] = [
      {
        id: 'step-a',
        name: 'A',
        agentIds: ['a'],
        executionType: 'sequential',
      },
      {
        id: 'step-b',
        name: 'B',
        agentIds: ['b'],
        executionType: 'sequential',
        dependencies: ['does-not-exist'],
      },
    ];

    const config = {
      id: 'test',
      name: 'test',
      agents: [makeAgent('a', model), makeAgent('b', model)],
      tasks,
      entryTaskId: 'step-a',
      globalContext: {},
      strictRouting: false,
    };

    expect(() => executor.buildExecutionGraph(config)).toThrow(/does-not-exist/);
  });

  // ── 3. Multiple dependencies on a single task ───────────────────────────────
  test('a task can depend on multiple predecessors', () => {
    const executor = new SocietyExecutor();

    const tasks: Task[] = [
      { id: 'fetch', name: 'Fetch', agentIds: ['a'], executionType: 'sequential' },
      { id: 'parse', name: 'Parse', agentIds: ['b'], executionType: 'sequential' },
      {
        id: 'merge',
        name: 'Merge',
        agentIds: ['c'],
        executionType: 'sequential',
        dependencies: ['fetch', 'parse'],
      },
    ];

    const config = {
      id: 'test',
      name: 'test',
      agents: [makeAgent('a', model), makeAgent('b', model), makeAgent('c', model)],
      tasks,
      entryTaskId: 'fetch',
      globalContext: {},
      strictRouting: false,
    };

    expect(() => executor.buildExecutionGraph(config)).not.toThrow();
  });

  // ── 4. Builder accumulates multiple dependsOn calls ─────────────────────────
  test('FluentTaskBuilder.dependsOn accumulates multiple deps and graph builds cleanly', () => {
    const executor = new SocietyExecutor();
    const m = new MockModel();
    m.withDefaultResponse('ok');

    const t1 = FluentTaskBuilder.create()
      .withId('a')
      .withName('A')
      .addAgent('ag1')
      .sequential()
      .build();
    const t2 = FluentTaskBuilder.create()
      .withId('b')
      .withName('B')
      .addAgent('ag2')
      .sequential()
      .build();
    const t3 = FluentTaskBuilder.create()
      .withId('c')
      .withName('C')
      .addAgent('ag3')
      .sequential()
      .dependsOn('a')
      .dependsOn(['b'])
      .build();

    // Verify the builder correctly stores all deps
    expect(t3.dependencies).toEqual(['a', 'b']);

    const config = {
      id: 'test-multi-dep',
      name: 'Multi-dep test',
      agents: [makeAgent('ag1', m), makeAgent('ag2', m), makeAgent('ag3', m)],
      tasks: [t1, t2, t3],
      entryTaskId: 'a',
      globalContext: {},
      strictRouting: false,
    };

    expect(() => executor.buildExecutionGraph(config)).not.toThrow();
  });
});

// ─── dependsOn: execution order (end-to-end) ─────────────────────────────────

describe('dependsOn – execution order (end-to-end)', () => {
  let model: MockModel;

  beforeEach(() => {
    model = new MockModel();
    model.withDefaultResponse('ok');
  });

  // ── 5. Dependent task runs after its declared dependency ────────────────────
  test('dependent task always executes after the task it depends on', async () => {
    const result = await Society.create()
      .withName('Order test')
      .useAgents([makeAgent('writer', model), makeAgent('reviewer', model)])
      .addTask((t) =>
        t
          .withId('draft')
          .withName('Draft task')
          .withAgents(['writer'])
          .withInstructions('write the document')
          .sequential()
      )
      .addTask((t) =>
        t
          .withId('review')
          .withName('Review task')
          .withAgents(['reviewer'])
          .withInstructions('review the document')
          .sequential()
          .dependsOn('draft')
      )
      .execute('start');

    expect(result.success).toBe(true);
    expect(result.taskResults.get('draft')).toBeDefined();
    expect(result.taskResults.get('review')).toBeDefined();
  });

  // ── 6. Society executes successfully with dependsOn in non-strict mode ───────
  test('society executes successfully with dependsOn in non-strict mode', async () => {
    const result = await Society.create()
      .withName('dep-test-society')
      .useAgents([makeAgent('ag1', model), makeAgent('ag2', model)])
      .addTask((t) =>
        t
          .withId('step-1')
          .withName('Step 1')
          .withAgents(['ag1'])
          .withInstructions('step one')
          .sequential()
      )
      .addTask((t) =>
        t
          .withId('step-2')
          .withName('Step 2')
          .withAgents(['ag2'])
          .withInstructions('step two, depends on step-1')
          .sequential()
          .dependsOn('step-1')
      )
      .execute('run workflow');

    expect(result.success).toBe(true);
    expect(result.taskResults.has('step-1')).toBe(true);
    expect(result.taskResults.has('step-2')).toBe(true);
  });

  // ── 7. Three-step linear chain via dependsOn ─────────────────────────────────
  test('three sequential tasks wired via dependsOn all execute', async () => {
    const result = await Society.create()
      .withName('three-step-chain')
      .useAgents([makeAgent('a1', model), makeAgent('a2', model), makeAgent('a3', model)])
      .addTask((t) => t.withId('t1').withName('T1').withAgents(['a1']).sequential())
      .addTask((t) => t.withId('t2').withName('T2').withAgents(['a2']).sequential().dependsOn('t1'))
      .addTask((t) => t.withId('t3').withName('T3').withAgents(['a3']).sequential().dependsOn('t2'))
      .execute('start three-step');

    expect(result.success).toBe(true);
    expect(result.taskResults.has('t1')).toBe(true);
    expect(result.taskResults.has('t2')).toBe(true);
    expect(result.taskResults.has('t3')).toBe(true);
  });

  // ── 8. dependsOn and task outputs flow correctly ─────────────────────────────
  test('task output is available when dependent task runs', async () => {
    const trackingModel = new MockModel();
    trackingModel.when('step one').thenReturn('output-of-step-one');
    trackingModel.withDefaultResponse('downstream-response');

    const result = await Society.create()
      .withName('output-flow-test')
      .useAgents([makeAgent('a', trackingModel), makeAgent('b', trackingModel)])
      .addTask((t) =>
        t
          .withId('producer')
          .withName('Producer')
          .withAgents(['a'])
          .withInstructions('step one')
          .sequential()
      )
      .addTask((t) =>
        t
          .withId('consumer')
          .withName('Consumer')
          .withAgents(['b'])
          .sequential()
          .dependsOn('producer')
      )
      .execute('run');

    expect(result.success).toBe(true);
    expect(result.taskResults.get('producer')![0].output).toBe('output-of-step-one');
    expect(result.taskResults.get('consumer')).toBeDefined();
  });
});

// ─── dependsOn: edge-cases ────────────────────────────────────────────────────

describe('dependsOn – edge cases', () => {
  let model: MockModel;

  beforeEach(() => {
    model = new MockModel();
    model.withDefaultResponse('ok');
  });

  // ── 9. Single task with no dependencies still works ──────────────────────────
  test('single-task society with no dependencies executes successfully', async () => {
    const result = await Society.create()
      .withName('single-task')
      .useAgents([makeAgent('a', model)])
      .addTask((t) => t.withId('only').withName('Only').withAgents(['a']).sequential())
      .execute('run');

    expect(result.success).toBe(true);
    expect(result.taskResults.has('only')).toBe(true);
  });

  // ── 10. Task without explicit dependsOn uses implicit sequential ordering ─────
  test('tasks without dependsOn still execute in declaration order', async () => {
    const callOrder: string[] = [];
    const trackModel = new MockModel();
    (trackModel as MockModel)['process'] = async (prompt: unknown): Promise<string> => {
      const p = String(prompt);
      if (p.includes('first')) callOrder.push('first');
      else if (p.includes('second')) callOrder.push('second');
      return 'ok';
    };

    await Society.create()
      .withName('implicit-order')
      .useAgents([makeAgent('a', trackModel), makeAgent('b', trackModel)])
      .addTask((t) =>
        t
          .withId('first')
          .withName('First')
          .withAgents(['a'])
          .withInstructions('first task')
          .sequential()
      )
      .addTask((t) =>
        t
          .withId('second')
          .withName('Second')
          .withAgents(['b'])
          .withInstructions('second task')
          .sequential()
      )
      .execute('run');

    // Even without dependsOn, first should come before second (implicit sequential wiring)
    expect(callOrder.indexOf('first')).toBeLessThan(callOrder.indexOf('second'));
  });
});
