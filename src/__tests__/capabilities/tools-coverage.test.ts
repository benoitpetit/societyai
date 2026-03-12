/**
 * @fileoverview Coverage tests for ToolBuilder, ToolExecutor, BuiltInTools,
 * and JSON extraction helpers in capabilities/tools.ts.
 */

import {
  ToolBuilder,
  ToolExecutor,
  ToolRegistry,
  BuiltInTools,
  Tool,
} from '../../capabilities/tools';

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
// ToolBuilder
// ---------------------------------------------------------------------------
describe('ToolBuilder', () => {
  it('builds a valid tool with all fields', () => {
    const tool = ToolBuilder.create()
      .withName('my-tool')
      .withDescription('A test tool')
      .withParameters({ type: 'object' as const })
      .withExecutor(async () => 'result')
      .withMetadata({ version: '1.0' })
      .build();

    expect(tool.name).toBe('my-tool');
    expect(tool.description).toBe('A test tool');
    expect(tool.metadata?.version).toBe('1.0');
  });

  it('throws when name is missing', () => {
    expect(() =>
      ToolBuilder.create()
        .withDescription('d')
        .withParameters({ type: 'object' as const })
        .withExecutor(async () => 'x')
        .build()
    ).toThrow('Tool name is required');
  });

  it('throws when description is missing', () => {
    expect(() =>
      ToolBuilder.create()
        .withName('x')
        .withParameters({ type: 'object' as const })
        .withExecutor(async () => 'x')
        .build()
    ).toThrow('Tool description is required');
  });

  it('throws when parameters are missing', () => {
    expect(() =>
      ToolBuilder.create()
        .withName('x')
        .withDescription('d')
        .withExecutor(async () => 'x')
        .build()
    ).toThrow('Tool parameters schema is required');
  });

  it('throws when executor is missing', () => {
    expect(() =>
      ToolBuilder.create()
        .withName('x')
        .withDescription('d')
        .withParameters({ type: 'object' as const })
        .build()
    ).toThrow('Tool executor is required');
  });
});

// ---------------------------------------------------------------------------
// ToolRegistry — overwrite behavior
// ---------------------------------------------------------------------------
describe('ToolRegistry overwrite', () => {
  it('overwrites an existing tool without error', () => {
    const registry = new ToolRegistry();
    const tool1: Tool = {
      name: 'dup',
      description: 'First',
      parameters: { type: 'object' as const },
      execute: async () => 'v1',
    };
    const tool2: Tool = {
      name: 'dup',
      description: 'Second',
      parameters: { type: 'object' as const },
      execute: async () => 'v2',
    };
    registry.register(tool1);
    registry.register(tool2);
    expect(registry.get('dup')?.description).toBe('Second');
  });
});

// ---------------------------------------------------------------------------
// ToolRegistry — non-object schema validation
// ---------------------------------------------------------------------------
describe('ToolRegistry non-object schema', () => {
  it('fails with error when schema.type is not object', async () => {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: 'badschema',
      description: 'd',
      parameters: { type: 'string' as const },
      execute: async () => 'ok',
    };
    registry.register(tool);
    const result = await registry.execute({ name: 'badschema', parameters: {} });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('parameters must be an object');
  });
});

// ---------------------------------------------------------------------------
// ToolExecutor
// ---------------------------------------------------------------------------
describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  function echoTool(): Tool {
    return ToolBuilder.create()
      .withName('echo')
      .withDescription('Echoes input')
      .withParameters({
        type: 'object',
        properties: { msg: { type: 'string' } },
        required: ['msg'],
      })
      .withExecutor(async (p) => p.msg)
      .build();
  }

  it('returns no tool calls when output has no JSON', async () => {
    registry.register(echoTool());
    const { results, hasToolCalls } = await executor.executeFromAgentOutput('plain text');
    expect(hasToolCalls).toBe(false);
    expect(results).toHaveLength(0);
  });

  it('extracts tool call from <tool_code> tags', async () => {
    registry.register(echoTool());
    const output = `<tool_code>{"name": "echo", "arguments": {"msg": "hello"}}</tool_code>`;
    const { results, hasToolCalls } = await executor.executeFromAgentOutput(output);
    expect(hasToolCalls).toBe(true);
    expect(results[0].success).toBe(true);
    expect(results[0].result).toBe('hello');
  });

  it('extracts legacy JSON tool call format', async () => {
    registry.register(echoTool());
    const output = JSON.stringify({ tool: 'echo', parameters: { msg: 'world' } });
    const { results, hasToolCalls } = await executor.executeFromAgentOutput(output);
    expect(hasToolCalls).toBe(true);
    expect(results[0].result).toBe('world');
  });

  it('extracts embedded JSON tool call from mixed text', async () => {
    registry.register(echoTool());
    const output = `some text {"tool": "echo", "parameters": {"msg": "embedded"}} more text`;
    const { results, hasToolCalls } = await executor.executeFromAgentOutput(output);
    expect(hasToolCalls).toBe(true);
    expect(results[0].result).toBe('embedded');
  });

  it('formatResults formats success and failure', async () => {
    const results = [
      { tool: 'echo', success: true, result: 'hello', duration: 5 },
      { tool: 'fail', success: false, error: new Error('oops'), duration: 3 },
    ];
    const formatted = executor.formatResults(results);
    expect(formatted).toContain('echo');
    expect(formatted).toContain('hello');
    expect(formatted).toContain('fail');
    expect(formatted).toContain('oops');
  });

  it('executeWithTools runs tool loop until no more calls', async () => {
    registry.register(echoTool());
    let call = 0;
    const agent = async (_input: string): Promise<string> => {
      call++;
      if (call === 1)
        return `<tool_code>{"name": "echo", "arguments": {"msg": "step1"}}</tool_code>`;
      return 'final answer';
    };
    const { output, toolResults } = await executor.executeWithTools(agent, 'start');
    expect(output).toBe('final answer');
    expect(toolResults).toHaveLength(1);
  });

  it('executeWithTools stops at maxIterations', async () => {
    registry.register(echoTool());
    const agent = async (): Promise<string> =>
      `<tool_code>{"name": "echo", "arguments": {"msg": "loop"}}</tool_code>`;
    const { toolResults } = await executor.executeWithTools(agent, 'start', undefined, 3);
    expect(toolResults).toHaveLength(3);
  });

  it('handles malformed JSON in <tool_code> gracefully', async () => {
    registry.register(echoTool());
    const output = `<tool_code>not valid json</tool_code>`;
    const { hasToolCalls } = await executor.executeFromAgentOutput(output);
    expect(hasToolCalls).toBe(false);
  });

  it('handles <tool_code> without name field', async () => {
    registry.register(echoTool());
    const output = `<tool_code>{"noname": true}</tool_code>`;
    const { hasToolCalls } = await executor.executeFromAgentOutput(output);
    expect(hasToolCalls).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BuiltInTools
// ---------------------------------------------------------------------------
describe('BuiltInTools.calculator', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(BuiltInTools.calculator());
  });

  const calc = (expr: string): Promise<{ success: boolean; result?: unknown; error?: Error }> =>
    registry.execute({ name: 'calculator', parameters: { expression: expr } });

  it('adds numbers', async () => {
    const r = await calc('2 + 3');
    expect(r.success).toBe(true);
    expect((r.result as { result: number }).result).toBe(5);
  });

  it('multiplies numbers', async () => {
    const r = await calc('4 * 5');
    expect((r.result as { result: number }).result).toBe(20);
  });

  it('evaluates nested expressions', async () => {
    const r = await calc('(2 + 3) * 4');
    expect((r.result as { result: number }).result).toBe(20);
  });

  it('handles division', async () => {
    const r = await calc('10 / 4');
    expect((r.result as { result: number }).result).toBe(2.5);
  });

  it('returns error for invalid expression', async () => {
    const r = await calc('2 +');
    expect(r.success).toBe(false);
  });

  it('returns error for division by zero', async () => {
    const r = await calc('5 / 0');
    expect(r.success).toBe(false);
  });
});

describe('BuiltInTools.stringManipulation', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(BuiltInTools.stringManipulation());
  });

  const str = (text: string, operation: string): Promise<{ success: boolean; result?: unknown; error?: Error }> =>
    registry.execute({ name: 'string_manipulation', parameters: { text, operation } });

  it('uppercases text', async () => {
    const r = await str('hello', 'uppercase');
    expect((r.result as { result: string }).result).toBe('HELLO');
  });

  it('lowercases text', async () => {
    const r = await str('WORLD', 'lowercase');
    expect((r.result as { result: string }).result).toBe('world');
  });

  it('reverses text', async () => {
    const r = await str('abc', 'reverse');
    expect((r.result as { result: string }).result).toBe('cba');
  });

  it('returns length of text', async () => {
    const r = await str('hello', 'length');
    expect((r.result as { result: number }).result).toBe(5);
  });
});

describe('BuiltInTools.storage', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(BuiltInTools.storage());
  });

  it('stores and retrieves a value', async () => {
    await registry.execute({
      name: 'storage',
      parameters: { operation: 'set', key: 'k', value: 'v' },
    });
    const r = await registry.execute({
      name: 'storage',
      parameters: { operation: 'get', key: 'k' },
    });
    expect((r.result as { result: unknown }).result).toBe('v');
  });

  it('deletes a value', async () => {
    await registry.execute({
      name: 'storage',
      parameters: { operation: 'set', key: 'del-key', value: 'x' },
    });
    await registry.execute({
      name: 'storage',
      parameters: { operation: 'delete', key: 'del-key' },
    });
    const r = await registry.execute({
      name: 'storage',
      parameters: { operation: 'get', key: 'del-key' },
    });
    expect((r.result as { result: unknown }).result).toBeUndefined();
  });

  it('lists all keys', async () => {
    await registry.execute({
      name: 'storage',
      parameters: { operation: 'set', key: 'list-a', value: '1' },
    });
    await registry.execute({
      name: 'storage',
      parameters: { operation: 'set', key: 'list-b', value: '2' },
    });
    const r = await registry.execute({ name: 'storage', parameters: { operation: 'list' } });
    expect((r.result as { result: string[] }).result).toContain('list-a');
    expect((r.result as { result: string[] }).result).toContain('list-b');
  });
});

// ---------------------------------------------------------------------------
// ToolRegistry — array parameter validation
// ---------------------------------------------------------------------------
describe('ToolRegistry array parameter validation', () => {
  it('validates array items', async () => {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: 'arr-tool',
      description: 'd',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      execute: async () => 'ok',
    };
    registry.register(tool);
    const result = await registry.execute({ name: 'arr-tool', parameters: { items: [1, 2] } });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('expected string');
  });

  it('validates nested object parameters', async () => {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: 'nested-tool',
      description: 'd',
      parameters: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              level: { type: 'number' },
            },
          },
        },
      },
      execute: async () => 'ok',
    };
    registry.register(tool);
    // Passing a string where number is expected inside nested object
    const result = await registry.execute({
      name: 'nested-tool',
      parameters: { config: { level: 'not-a-number' } },
    });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('expected number');
  });
});
