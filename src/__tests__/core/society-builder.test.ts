/**
 * @fileoverview Tests for Society builder, validateConfiguration, shorthand methods
 */

import { Society } from '../../core/society';
import { InvalidConfigurationError } from '../../core/errors';
import { MockModel } from '../utils/mock-model';
import { Agent, Role } from '../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(id: string): Agent {
  return {
    id,
    name: id,
    role: { id: `role-${id}`, name: 'Role', systemPrompt: 'test' } as Role,
    model: new MockModel(id).withDefaultResponse('ok'),
    priority: 0,
  };
}

// ---------------------------------------------------------------------------
// build()
// ---------------------------------------------------------------------------

describe('Society.build()', () => {
  it('builds a valid config when all required fields are present', () => {
    const config = Society.create('my-society')
      .addAgent((a) =>
        a
          .withId('agent1')
          .withRole((r) => r.withSystemPrompt('hello'))
          .withModel(new MockModel())
      )
      .addTask((t) => t.withId('task1').withAgents(['agent1']).sequential())
      .build();

    expect(config.id).toBe('my-society');
    expect(config.agents).toHaveLength(1);
    expect(config.tasks).toHaveLength(1);
  });

  it('auto-generates an ID when none is set', () => {
    const config = Society.create()
      .useAgent(makeAgent('a1'))
      .addTask((t) => t.withId('t1').withAgents(['a1']).sequential())
      .build();

    expect(typeof config.id).toBe('string');
    expect(config.id.length).toBeGreaterThan(0);
  });

  it('sets first task as entryTaskId by default', () => {
    const config = Society.create()
      .useAgent(makeAgent('a'))
      .addTask((t) => t.withId('first').withAgents(['a']).sequential())
      .addTask((t) => t.withId('second').withAgents(['a']).sequential())
      .build();

    expect(config.entryTaskId).toBe('first');
  });

  it('includes globalContext when set', () => {
    const config = Society.create()
      .withGlobalContext({ lang: 'en' })
      .useAgent(makeAgent('a'))
      .addTask((t) => t.withId('t').withAgents(['a']).sequential())
      .build();

    expect(config.globalContext).toEqual({ lang: 'en' });
  });

  it('includes description when set', () => {
    const config = Society.create()
      .withDescription('My society')
      .useAgent(makeAgent('a'))
      .addTask((t) => t.withId('t').withAgents(['a']).sequential())
      .build();

    expect(config.description).toBe('My society');
  });
});

// ---------------------------------------------------------------------------
// validateConfiguration()
// ---------------------------------------------------------------------------

describe('Society.validateConfiguration()', () => {
  it('throws when no agents are configured', () => {
    expect(() =>
      Society.create()
        .addTask((t) => t.withId('t').withAgents(['a']).sequential())
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when no tasks are configured', () => {
    expect(() => Society.create().useAgent(makeAgent('a')).build()).toThrow(
      InvalidConfigurationError
    );
  });

  it('throws when task references unknown agent', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('real-agent'))
        .addTask((t) => t.withId('t').withAgents(['unknown-agent']).sequential())
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when task routes to unknown task', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('a'))
        .addTask((t) => t.withId('t1').withAgents(['a']).withNextSteps(['t-missing']).sequential())
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when task declares dependency on unknown task', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('a'))
        .addTask((t) => t.withId('t1').withAgents(['a']).dependsOn(['t-missing']).sequential())
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when entry task does not exist', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('a'))
        .addTask((t) => t.withId('t1').withAgents(['a']).sequential())
        .withEntryTask('nonexistent')
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when duplicate agent IDs are used', () => {
    expect(() =>
      Society.create()
        .useAgents([makeAgent('dup'), makeAgent('dup')])
        .addTask((t) => t.withId('t').withAgents(['dup']).sequential())
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when duplicate task IDs are used', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('a'))
        .useTask({ id: 'same', name: 'Same Task', agentIds: ['a'], executionType: 'sequential' })
        .useTask({ id: 'same', name: 'Same Task', agentIds: ['a'], executionType: 'sequential' })
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('throws when agent canCommunicateWith references unknown agent', () => {
    const agent: Agent = {
      ...makeAgent('a'),
      canCommunicateWith: ['unknown'],
    };
    expect(() =>
      Society.create()
        .useAgent(agent)
        .addTask((t) => t.withId('t').withAgents(['a']).sequential())
        .build()
    ).toThrow(InvalidConfigurationError);
  });

  it('does not throw for a valid configuration', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('a'))
        .addTask((t) => t.withId('t').withAgents(['a']).sequential())
        .build()
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Agent / task building helpers
// ---------------------------------------------------------------------------

describe('Society agent helpers', () => {
  it('useAgent() accepts a direct Agent object', () => {
    const config = Society.create()
      .useAgent(makeAgent('direct'))
      .addTask((t) => t.withId('t').withAgents(['direct']).sequential())
      .build();

    expect(config.agents[0].id).toBe('direct');
  });

  it('useAgents() adds multiple agents', () => {
    const config = Society.create()
      .useAgents([makeAgent('a1'), makeAgent('a2')])
      .addTask((t) => t.withId('t').withAgents(['a1']).sequential())
      .build();

    expect(config.agents).toHaveLength(2);
  });

  it('useTask() accepts a direct Task object', () => {
    const config = Society.create()
      .useAgent(makeAgent('a'))
      .useTask({
        id: 'direct-task',
        name: 'Direct Task',
        agentIds: ['a'],
        executionType: 'sequential',
      })
      .build();

    expect(config.tasks[0].id).toBe('direct-task');
  });

  it('useTasks() adds multiple tasks', () => {
    const config = Society.create()
      .useAgent(makeAgent('a'))
      .useTasks([
        { id: 't1', name: 'Task 1', agentIds: ['a'], executionType: 'sequential' },
        { id: 't2', name: 'Task 2', agentIds: ['a'], executionType: 'sequential' },
      ])
      .build();

    expect(config.tasks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// withId / withName
// ---------------------------------------------------------------------------

describe('Society withId / withName', () => {
  it('withId() sets ID and name when name is unset', () => {
    const config = Society.create()
      .withId('my-id')
      .useAgent(makeAgent('a'))
      .addTask((t) => t.withId('t').withAgents(['a']).sequential())
      .build();

    expect(config.id).toBe('my-id');
    expect(config.name).toBe('my-id');
  });

  it('withName() sets name and derives ID', () => {
    const config = Society.create()
      .withName('My Society')
      .useAgent(makeAgent('a'))
      .addTask((t) => t.withId('t').withAgents(['a']).sequential())
      .build();

    expect(config.name).toBe('My Society');
    expect(config.id).toBe('my-society');
  });
});

// ---------------------------------------------------------------------------
// usePipeline
// ---------------------------------------------------------------------------

describe('Society.usePipeline()', () => {
  it('throws if tasks already exist', () => {
    expect(() =>
      Society.create()
        .useAgent(makeAgent('a'))
        .addTask((t) => t.withId('existing').withAgents(['a']).sequential())
        .usePipeline((p) => p)
    ).toThrow(InvalidConfigurationError);
  });
});
