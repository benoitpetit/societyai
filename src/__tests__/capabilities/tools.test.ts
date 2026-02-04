import { ToolRegistry, Tool } from '../../capabilities/tools';

// Mock logger
jest.mock('../../observability/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Tool System', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  const weatherTool: Tool = {
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        unit: { type: 'string', enum: ['c', 'f'], default: 'c' },
      },
      required: ['location'],
    },
    execute: async (params) => {
      return `Weather in ${params.location} is Sunny`;
    },
  };

  test('should register and retrieve tools', () => {
    registry.register(weatherTool);
    expect(registry.has('get_weather')).toBe(true);
    expect(registry.get('get_weather')).toBe(weatherTool);
    expect(registry.getAll()).toHaveLength(1);

    const definitions = registry.getDefinitions();
    expect(definitions[0].name).toBe('get_weather');
  });

  test('should unregister tools', () => {
    registry.register(weatherTool);
    registry.unregister('get_weather');
    expect(registry.has('get_weather')).toBe(false);
  });

  test('should execute tool successfully with valid parameters', async () => {
    registry.register(weatherTool);

    const result = await registry.execute({
      name: 'get_weather',
      parameters: { location: 'Paris', unit: 'c' },
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('Weather in Paris is Sunny');
    expect(result.tool).toBe('get_weather');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('should fail when tool is not found', async () => {
    const result = await registry.execute({
      name: 'unknown_tool',
      parameters: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Tool not found');
  });

  test('should validate required parameters', async () => {
    registry.register(weatherTool);

    const result = await registry.execute({
      name: 'get_weather',
      parameters: { unit: 'c' }, // Missing location
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Missing required parameter: location');
  });

  test('should validate parameter types', async () => {
    registry.register(weatherTool);

    const result = await registry.execute({
      name: 'get_weather',
      parameters: { location: 123 }, // Should be string
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('expected string, got number');
  });

  test('should validate enum values', async () => {
    registry.register(weatherTool);

    const result = await registry.execute({
      name: 'get_weather',
      parameters: { location: 'Paris', unit: 'invalid' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('must be one of c, f');
  });

  test('should execute multiple tools in parallel', async () => {
    registry.register(weatherTool);

    const calcTool: Tool = {
      name: 'calc',
      description: 'Calculator',
      parameters: {
        type: 'object',
        properties: { x: { type: 'number' } },
        required: ['x'],
      },
      execute: async (params) => (params.x as number) * 2,
    };
    registry.register(calcTool);

    const results = await registry.executeParallel([
      { name: 'get_weather', parameters: { location: 'London' } },
      { name: 'calc', parameters: { x: 21 } },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(results[1].result).toBe(42);
  });

  test('should validate number constraints', async () => {
    const numberTool: Tool = {
      name: 'num',
      description: 'd',
      parameters: {
        type: 'object',
        properties: {
          val: { type: 'number', minimum: 10, maximum: 20 },
        },
      },
      execute: async () => 'ok',
    };

    registry.register(numberTool);

    let res = await registry.execute({ name: 'num', parameters: { val: 5 } });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('must be >= 10');

    res = await registry.execute({ name: 'num', parameters: { val: 25 } });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('must be <= 20');
  });

  test('should validate string length constraints', async () => {
    const strTool: Tool = {
      name: 'str',
      description: 'd',
      parameters: {
        type: 'object',
        properties: {
          txt: { type: 'string', minLength: 3, maxLength: 5 },
        },
      },
      execute: async () => 'ok',
    };

    registry.register(strTool);

    let res = await registry.execute({ name: 'str', parameters: { txt: 'hi' } });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('length must be >= 3');

    res = await registry.execute({ name: 'str', parameters: { txt: 'toolong' } });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('length must be <= 5');
  });

  test('should validate unknown parameters', async () => {
    registry.register(weatherTool);
    const res = await registry.execute({
      name: 'get_weather',
      parameters: { location: 'Paris', unknownArg: 'fail' },
    });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('Unknown parameter: unknownArg');
  });
});
