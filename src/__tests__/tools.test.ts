/**
 * Tests for Tool System
 */

import {
  ToolBuilder,
  ToolRegistry,
  ToolExecutor,
  BuiltInTools,
} from '..';

describe('Tool System', () => {
  describe('ToolBuilder', () => {
    it('should create a valid tool', () => {
      const tool = ToolBuilder.create()
        .withName('test_tool')
        .withDescription('A test tool')
        .withParameters({
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        })
        .withExecutor(async (params: Record<string, unknown>) => {
          return { result: params.input };
        })
        .build();

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
    });

    it('should throw error if name is missing', () => {
      expect(() => {
        ToolBuilder.create()
          .withDescription('test')
          .withParameters({ type: 'object' })
          .withExecutor(async () => ({}))
          .build();
      }).toThrow('Tool name is required');
    });

    it('should throw error if executor is missing', () => {
      expect(() => {
        ToolBuilder.create()
          .withName('test')
          .withDescription('test')
          .withParameters({ type: 'object' })
          .build();
      }).toThrow('Tool executor is required');
    });
  });

  describe('ToolRegistry', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
    });

    it('should register and retrieve tools', () => {
      const tool = ToolBuilder.create()
        .withName('test')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({}))
        .build();

      registry.register(tool);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(tool);
    });

    it('should unregister tools', () => {
      const tool = ToolBuilder.create()
        .withName('test')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({}))
        .build();

      registry.register(tool);
      registry.unregister('test');

      expect(registry.has('test')).toBe(false);
    });

    it('should get all registered tools', () => {
      const tool1 = ToolBuilder.create()
        .withName('tool1')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({}))
        .build();

      const tool2 = ToolBuilder.create()
        .withName('tool2')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({}))
        .build();

      registry.register(tool1);
      registry.register(tool2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should get tool definitions for AI', () => {
      const tool = ToolBuilder.create()
        .withName('test')
        .withDescription('A test tool')
        .withParameters({
          type: 'object',
          properties: { input: { type: 'string' } },
        })
        .withExecutor(async () => ({}))
        .build();

      registry.register(tool);

      const defs = registry.getDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe('test');
      expect(defs[0].description).toBe('A test tool');
    });

    it('should execute tool call successfully', async () => {
      const tool = ToolBuilder.create()
        .withName('echo')
        .withDescription('Echo input')
        .withParameters({
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        })
        .withExecutor(async (params: Record<string, unknown>) => {
          return { echo: params.text };
        })
        .build();

      registry.register(tool);

      const result = await registry.execute({
        name: 'echo',
        parameters: { text: 'hello' },
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ echo: 'hello' });
    });

    it('should handle missing tool', async () => {
      const result = await registry.execute({
        name: 'nonexistent',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should validate required parameters', async () => {
      const tool = ToolBuilder.create()
        .withName('test')
        .withDescription('test')
        .withParameters({
          type: 'object',
          properties: { required_param: { type: 'string' } },
          required: ['required_param'],
        })
        .withExecutor(async () => ({}))
        .build();

      registry.register(tool);

      const result = await registry.execute({
        name: 'test',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Missing required parameter');
    });

    it('should execute multiple tools in parallel', async () => {
      const tool1 = ToolBuilder.create()
        .withName('tool1')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({ value: 1 }))
        .build();

      const tool2 = ToolBuilder.create()
        .withName('tool2')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({ value: 2 }))
        .build();

      registry.register(tool1);
      registry.register(tool2);

      const results = await registry.executeParallel([
        { name: 'tool1', parameters: {} },
        { name: 'tool2', parameters: {} },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('BuiltInTools', () => {
    it('should create calculator tool', async () => {
      const calc = BuiltInTools.calculator();
      const registry = new ToolRegistry();
      registry.register(calc);

      const result = await registry.execute({
        name: 'calculator',
        parameters: { expression: '2 + 2' },
      });

      expect(result.success).toBe(true);
      expect((result.result as Record<string, unknown>).result).toBe(4);
    });

    it('should create string manipulation tool', async () => {
      const stringTool = BuiltInTools.stringManipulation();
      const registry = new ToolRegistry();
      registry.register(stringTool);

      const result = await registry.execute({
        name: 'string_manipulation',
        parameters: { text: 'hello', operation: 'uppercase' },
      });

      expect(result.success).toBe(true);
      expect((result.result as Record<string, unknown>).result).toBe('HELLO');
    });

    it('should create storage tool', async () => {
      const storage = BuiltInTools.storage();
      const registry = new ToolRegistry();
      registry.register(storage);

      // Set value
      await registry.execute({
        name: 'storage',
        parameters: { operation: 'set', key: 'test', value: 'value' },
      });

      // Get value
      const result = await registry.execute({
        name: 'storage',
        parameters: { operation: 'get', key: 'test' },
      });

      expect(result.success).toBe(true);
      expect((result.result as Record<string, unknown>).result).toBe('value');
    });
  });

  describe('ToolExecutor', () => {
    it('should extract tool calls from JSON output', async () => {
      const registry = new ToolRegistry();
      const tool = ToolBuilder.create()
        .withName('test')
        .withDescription('test')
        .withParameters({ type: 'object' })
        .withExecutor(async () => ({ success: true }))
        .build();

      registry.register(tool);

      const executor = new ToolExecutor(registry);
      const output = '{"tool": "test", "parameters": {}}';

      const { results, hasToolCalls } = await executor.executeFromAgentOutput(output);

      expect(hasToolCalls).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should format tool results', () => {
      const executor = new ToolExecutor(new ToolRegistry());

      const results = [
        { tool: 'tool1', success: true, result: 'ok', duration: 100 },
        { tool: 'tool2', success: false, error: new Error('failed'), duration: 50 },
      ];

      const formatted = executor.formatResults(results);

      expect(formatted).toContain('✓ tool1');
      expect(formatted).toContain('✗ tool2');
    });
  });
});
