/**
 * Tests for FluentAgentBuilder and FluentRoleBuilder — comprehensive coverage
 */

import { FluentAgentBuilder } from '../../builders/agent-builder';
import { FluentRoleBuilder } from '../../builders/role-builder';
import { InvalidConfigurationError } from '../../core/errors';
import { MockModel } from '../utils/mock-model';
import { Role } from '../../core/types';
import { MemorySystem } from '../../capabilities/memory';
import { Tool } from '../../capabilities/tools';

// ============================================================================
// Helper
// ============================================================================

function makeRole(prompt = 'You are a test role'): Role {
  return FluentRoleBuilder.create().withId('role1').withSystemPrompt(prompt).build();
}

function makeTool(name: string): Tool {
  return {
    name,
    description: `Tool ${name}`,
    parameters: { type: 'object' },
    execute: async () => `${name} result`,
  };
}

// ============================================================================
// FluentAgentBuilder
// ============================================================================

describe('FluentAgentBuilder', () => {
  let model: MockModel;

  beforeEach(() => {
    model = new MockModel();
  });

  test('static create() should return a builder instance', () => {
    const builder = FluentAgentBuilder.create();
    expect(builder).toBeInstanceOf(FluentAgentBuilder);
  });

  test('build() should require id, role, and model', () => {
    // Missing all
    expect(() => FluentAgentBuilder.create().build()).toThrow(InvalidConfigurationError);

    // Missing role + model
    expect(() => FluentAgentBuilder.create().withId('a').build()).toThrow(
      InvalidConfigurationError
    );

    // Missing model
    expect(() => FluentAgentBuilder.create().withId('a').withRole(makeRole()).build()).toThrow(
      InvalidConfigurationError
    );
  });

  test('withId should auto-set name if not already set', () => {
    const agent = FluentAgentBuilder.create()
      .withId('my-agent')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect(agent.id).toBe('my-agent');
    expect(agent.name).toBe('my-agent');
  });

  test('withName should override auto-set name', () => {
    const agent = FluentAgentBuilder.create()
      .withId('my-agent')
      .withName('Custom Name')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect(agent.name).toBe('Custom Name');
  });

  test('withRole should accept a Role object directly', () => {
    const role = makeRole();
    const agent = FluentAgentBuilder.create().withId('a').withRole(role).withModel(model).build();

    expect(agent.role).toBe(role);
  });

  test('withRole should accept a FluentRoleBuilder instance', () => {
    const roleBuilder = FluentRoleBuilder.create().withId('r').withSystemPrompt('prompt');

    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(roleBuilder)
      .withModel(model)
      .build();

    expect(agent.role.id).toBe('r');
  });

  test('withRole should accept a callback function', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole((rb) => rb.withId('r2').withSystemPrompt('test'))
      .withModel(model)
      .build();

    expect(agent.role.id).toBe('r2');
  });

  test('useRole should set role directly', () => {
    const role = makeRole();
    const agent = FluentAgentBuilder.create().withId('a').useRole(role).withModel(model).build();

    expect(agent.role).toBe(role);
  });

  test('canCommunicateWith should set agent IDs', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .canCommunicateWith(['b', 'c'])
      .build();

    expect(agent.canCommunicateWith).toEqual(['b', 'c']);
  });

  test('empty canCommunicateWith should be undefined', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect(agent.canCommunicateWith).toBeUndefined();
  });

  test('withPriority should set priority', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withPriority(5)
      .build();

    expect(agent.priority).toBe(5);
  });

  test('withInitialContext should set context', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withInitialContext({ key: 'value' })
      .build();

    expect(agent.initialContext).toEqual({ key: 'value' });
  });

  test('addContext should accumulate key-value pairs', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .addContext('x', 1)
      .addContext('y', 2)
      .build();

    expect(agent.initialContext).toEqual({ x: 1, y: 2 });
  });

  test('empty initialContext should be undefined', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect(agent.initialContext).toBeUndefined();
  });

  test('withRetry should set retry config', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withRetry({ maxRetries: 5, initialBackoff: 100 })
      .build();

    expect(agent.retryConfig).toEqual({ maxRetries: 5, initialBackoff: 100 });
  });

  test('withTags should set tags', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withTags(['fast', 'gpt4'])
      .build();

    expect((agent as unknown as Record<string, unknown>).tags).toEqual(['fast', 'gpt4']);
  });

  test('addTag should accumulate tags', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .addTag('tag1')
      .addTag('tag2')
      .build();

    expect((agent as unknown as Record<string, unknown>).tags).toEqual(['tag1', 'tag2']);
  });

  test('empty tags should be undefined', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect((agent as unknown as Record<string, unknown>).tags).toBeUndefined();
  });

  test('withMetadata should set metadata', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withMetadata({ version: '1.0', env: 'test' })
      .build();

    expect((agent as unknown as Record<string, unknown>).metadata).toEqual({
      version: '1.0',
      env: 'test',
    });
  });

  test('empty metadata should be undefined', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect((agent as unknown as Record<string, unknown>).metadata).toBeUndefined();
  });

  test('withMemory should attach memory system', () => {
    const memory = { add: jest.fn(), retrieve: jest.fn() } as unknown as MemorySystem;
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withMemory(memory)
      .build();

    expect(agent.memory).toBe(memory);
  });

  // =====================================================
  // Critical: withTools() cumulative behavior
  // =====================================================

  test('withTools() should be cumulative (not overwrite)', () => {
    const tool1 = makeTool('tool1');
    const tool2 = makeTool('tool2');
    const tool3 = makeTool('tool3');

    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .addTool(tool1)
      .withTools([tool2, tool3])
      .build();

    // All 3 tools should be present (not just tool2 + tool3)
    expect(agent.tools).toHaveLength(3);
    expect(agent.tools).toContain(tool1);
    expect(agent.tools).toContain(tool2);
    expect(agent.tools).toContain(tool3);
  });

  test('addTool() then addTool() should accumulate', () => {
    const tool1 = makeTool('a');
    const tool2 = makeTool('b');

    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .addTool(tool1)
      .addTool(tool2)
      .build();

    expect(agent.tools).toEqual([tool1, tool2]);
  });

  test('withTools() called twice should accumulate both sets', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .withTools([makeTool('a'), makeTool('b')])
      .withTools([makeTool('c')])
      .build();

    expect(agent.tools).toHaveLength(3);
  });

  test('empty tools should be undefined', () => {
    const agent = FluentAgentBuilder.create()
      .withId('a')
      .withRole(makeRole())
      .withModel(model)
      .build();

    expect(agent.tools).toBeUndefined();
  });
});

// ============================================================================
// FluentRoleBuilder
// ============================================================================

describe('FluentRoleBuilder', () => {
  test('static create() should return builder instance', () => {
    expect(FluentRoleBuilder.create()).toBeInstanceOf(FluentRoleBuilder);
  });

  test('build() should require systemPrompt', () => {
    expect(() => FluentRoleBuilder.create().withId('r').build()).toThrow(InvalidConfigurationError);
  });

  test('build() should auto-generate id if not set', () => {
    const role = FluentRoleBuilder.create().withSystemPrompt('prompt').build();

    expect(role.id).toBeDefined();
    expect(role.id.startsWith('role-')).toBe(true);
  });

  test('build() should auto-set name from id', () => {
    const role = FluentRoleBuilder.create().withId('my-role').withSystemPrompt('prompt').build();

    expect(role.name).toBe('my-role');
  });

  test('withName should override auto-set name', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withName('Custom')
      .withSystemPrompt('prompt')
      .build();

    expect(role.name).toBe('Custom');
  });

  test('withDescription should set description', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withSystemPrompt('prompt')
      .withDescription('desc')
      .build();

    expect(role.description).toBe('desc');
  });

  test('withCapabilities should set capabilities', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withSystemPrompt('prompt')
      .withCapabilities(['analyze', 'summarize'])
      .build();

    expect(role.capabilities).toEqual(['analyze', 'summarize']);
  });

  test('addCapability should accumulate', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withSystemPrompt('prompt')
      .addCapability('read')
      .addCapability('write')
      .build();

    expect(role.capabilities).toEqual(['read', 'write']);
  });

  test('empty capabilities should be undefined', () => {
    const role = FluentRoleBuilder.create().withId('r').withSystemPrompt('prompt').build();

    expect(role.capabilities).toBeUndefined();
  });

  test('withConstraints should set constraints', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withSystemPrompt('prompt')
      .withConstraints(['no-pii', 'max-1000-words'])
      .build();

    expect(role.constraints).toEqual(['no-pii', 'max-1000-words']);
  });

  test('addConstraint should accumulate', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withSystemPrompt('prompt')
      .addConstraint('c1')
      .addConstraint('c2')
      .build();

    expect(role.constraints).toEqual(['c1', 'c2']);
  });

  test('empty constraints should be undefined', () => {
    const role = FluentRoleBuilder.create().withId('r').withSystemPrompt('prompt').build();

    expect(role.constraints).toBeUndefined();
  });

  test('withPromptTemplate should set template', () => {
    const role = FluentRoleBuilder.create()
      .withId('r')
      .withSystemPrompt('prompt')
      .withPromptTemplate('{systemPrompt}\n{input}')
      .build();

    expect(role.promptTemplate).toBe('{systemPrompt}\n{input}');
  });

  test('withId should auto-set name if name is empty', () => {
    const role = FluentRoleBuilder.create().withId('auto-name').withSystemPrompt('p').build();

    expect(role.name).toBe('auto-name');
  });

  test('withName set before withId should not be overridden', () => {
    const role = FluentRoleBuilder.create()
      .withName('FirstName')
      .withId('id')
      .withSystemPrompt('p')
      .build();

    // withId auto-sets name only if empty; name was already 'FirstName'
    expect(role.name).toBe('FirstName');
  });
});
