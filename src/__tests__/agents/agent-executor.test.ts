/**
 * @fileoverview Tests for AgentExecutor
 */

import { AgentExecutor } from '../../agents/agent-executor';
import { Agent, ExecutionContext, Role } from '../../core/types';
import { MockModel } from '../utils/mock-model';
import { JSONSchema } from '../../capabilities/validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(shared: Record<string, unknown> = {}): ExecutionContext {
  return {
    input: 'test input',
    sharedData: new Map(Object.entries(shared)),
    taskResults: new Map(),
    messageHistory: [],
    metadata: {},
  };
}

function makeAgent(
  opts: {
    id?: string;
    response?: string;
    model?: MockModel;
    tools?: Agent['tools'];
    memory?: Agent['memory'];
  } = {}
): Agent {
  const model =
    opts.model ?? new MockModel().withDefaultResponse(opts.response ?? 'default output');
  return {
    id: opts.id ?? 'agent-1',
    name: opts.id ?? 'Agent 1',
    role: {
      id: 'role-1',
      name: 'Test Role',
      systemPrompt: 'You are a test assistant',
    } as Role,
    model,
    priority: 0,
    tools: opts.tools,
    memory: opts.memory,
  };
}

// ---------------------------------------------------------------------------
// Basic execution
// ---------------------------------------------------------------------------

describe('AgentExecutor.execute()', () => {
  it('returns a successful TaskResult with output', async () => {
    const agent = makeAgent({ response: 'hello world' });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('test input', makeContext(), {
      taskId: 'task-1',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('hello world');
    expect(result.agentId).toBe('agent-1');
    expect(result.taskId).toBe('task-1');
  });

  it('includes duration in milliseconds', async () => {
    const agent = makeAgent({ response: 'ok' });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('x', makeContext(), { taskId: 't' });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('stores output in agent memory when memory is set', async () => {
    const memory = {
      add: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn().mockResolvedValue([]),
      clear: jest.fn(),
      getStats: jest.fn(),
    };
    const agent = makeAgent({
      response: 'remembered',
      memory: memory as unknown as Agent['memory'],
    });
    const executor = new AgentExecutor(agent);

    await executor.execute('input', makeContext(), { taskId: 't' });
    expect(memory.add).toHaveBeenCalledWith('remembered', expect.any(Object));
  });

  it('includes memory context in prompt', async () => {
    const mockModel = new MockModel().withDefaultResponse('ok');
    const memory = {
      add: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn().mockResolvedValue(['past fact']),
      clear: jest.fn(),
      getStats: jest.fn(),
    };
    const agent = makeAgent({ model: mockModel, memory: memory as unknown as Agent['memory'] });
    const executor = new AgentExecutor(agent);

    await executor.execute('input', makeContext(), { taskId: 't' });

    const prompt = mockModel.callHistory[0];
    expect(prompt).toContain('past fact');
  });

  it('omits empty Memory / Tools / Instructions sections from prompt', async () => {
    const mockModel = new MockModel().withDefaultResponse('ok');
    const agent = makeAgent({ model: mockModel });
    const executor = new AgentExecutor(agent);

    await executor.execute('test', makeContext(), { taskId: 't' });

    const prompt = mockModel.callHistory[0];
    expect(prompt).not.toContain('Memory:');
    expect(prompt).not.toContain('Tools:');
    expect(prompt).not.toContain('Instructions:');
  });

  it('includes Instructions section when provided', async () => {
    const mockModel = new MockModel().withDefaultResponse('ok');
    const agent = makeAgent({ model: mockModel });
    const executor = new AgentExecutor(agent);

    await executor.execute('test', makeContext(), {
      taskId: 't',
      instructions: 'Be precise',
    });

    const prompt = mockModel.callHistory[0];
    expect(prompt).toContain('Instructions: Be precise');
  });
});

// ---------------------------------------------------------------------------
// Template support
// ---------------------------------------------------------------------------

describe('AgentExecutor — prompt template', () => {
  it('uses promptTemplate with variable substitution', async () => {
    const mockModel = new MockModel().withDefaultResponse('ok');
    const agent = makeAgent({ model: mockModel });
    const executor = new AgentExecutor(agent);

    await executor.execute('MYINPUT', makeContext(), {
      taskId: 't',
      promptTemplate: 'SYS:{system} IN:{input}',
    });

    expect(mockModel.callHistory[0]).toContain('MYINPUT');
    expect(mockModel.callHistory[0]).toContain('SYS:');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('AgentExecutor — error handling', () => {
  it('returns success=false and error when model throws', async () => {
    const model: MockModel = new MockModel();
    jest.spyOn(model, 'process').mockRejectedValue(new Error('model error'));

    const agent = makeAgent({ model });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('x', makeContext(), { taskId: 't' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('model error');
  });

  it('retries with error context when loopConfig.maxIterations > 1', async () => {
    const model = new MockModel();
    let calls = 0;
    jest.spyOn(model, 'process').mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error('first fail');
      return 'recovered';
    });

    const agent = makeAgent({ model });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('x', makeContext(), {
      taskId: 't',
      loopConfig: { maxIterations: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('second attempt prompt contains original input and error message', async () => {
    const model = new MockModel();
    const prompts: string[] = [];
    let calls = 0;
    jest.spyOn(model, 'process').mockImplementation(async (p) => {
      prompts.push(String(p));
      calls++;
      if (calls === 1) throw new Error('oops');
      return 'ok';
    });

    const agent = makeAgent({ model });
    const executor = new AgentExecutor(agent);

    await executor.execute('ORIGINAL_INPUT', makeContext(), {
      taskId: 't',
      loopConfig: { maxIterations: 2 },
    });

    // The second prompt should contain original input + error context
    expect(prompts[1]).toContain('ORIGINAL_INPUT');
    expect(prompts[1]).toContain('oops');
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('AgentExecutor — outputSchema validation', () => {
  const schema: JSONSchema = {
    type: 'object',
    properties: { answer: { type: 'string' } },
    required: ['answer'],
  };

  it('passes through valid JSON output', async () => {
    const model = new MockModel().withDefaultResponse(JSON.stringify({ answer: 'yes' }));
    const agent = makeAgent({ model });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('x', makeContext(), {
      taskId: 't',
      outputSchema: schema,
    });

    expect(result.success).toBe(true);
  });

  it('fails when output does not match schema', async () => {
    const model = new MockModel().withDefaultResponse(JSON.stringify({ wrong: 'field' }));
    const agent = makeAgent({ model });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('x', makeContext(), {
      taskId: 't',
      outputSchema: schema,
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Validation failed');
  });
});

// ---------------------------------------------------------------------------
// Loop / exit condition
// ---------------------------------------------------------------------------

describe('AgentExecutor — loop with exitCondition', () => {
  it('exits when exitCondition returns true', async () => {
    const model = new MockModel().withDefaultResponse('DONE');
    const agent = makeAgent({ model });
    const executor = new AgentExecutor(agent);

    let iterationCount = 0;

    const result = await executor.execute('x', makeContext(), {
      taskId: 't',
      loopConfig: {
        maxIterations: 10,
        exitCondition: (output) => {
          iterationCount++;
          return output === 'DONE';
        },
      },
    });

    expect(result.success).toBe(true);
    expect(iterationCount).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Tool execution (ReAct loop)
// ---------------------------------------------------------------------------

describe('AgentExecutor — tool execution', () => {
  it('calls tool when model outputs tool_code block', async () => {
    const toolExecute = jest.fn().mockResolvedValue('tool result');
    const tool = {
      name: 'calculator',
      description: 'does math',
      parameters: { type: 'object' as const },
      execute: toolExecute,
    };

    const model = new MockModel();
    let calls = 0;
    jest.spyOn(model, 'process').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return '<tool_code>{"name":"calculator","arguments":{"expr":"2+2"}}</tool_code>';
      }
      return 'final answer';
    });

    const agent = makeAgent({ model, tools: [tool] });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('compute', makeContext(), { taskId: 't' });

    expect(toolExecute).toHaveBeenCalledWith({ expr: '2+2' }, expect.any(Object));
    expect(result.output).toBe('final answer');
  });

  it('handles unknown tool gracefully', async () => {
    const model = new MockModel();
    let calls = 0;
    jest.spyOn(model, 'process').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return '<tool_code>{"name":"unknown_tool","arguments":{}}</tool_code>';
      }
      return 'recovered';
    });

    const tool = {
      name: 'other_tool',
      description: 'something',
      parameters: { type: 'object' as const },
      execute: jest.fn(),
    };

    const agent = makeAgent({ model, tools: [tool] });
    const executor = new AgentExecutor(agent);

    const result = await executor.execute('x', makeContext(), { taskId: 't' });
    expect(result.success).toBe(true);
  });

  it('respects maxToolSteps limit', async () => {
    const model = new MockModel();
    let calls = 0;
    jest.spyOn(model, 'process').mockImplementation(async () => {
      calls++;
      // Always returns tool_code to trigger infinite loop
      if (calls <= 5) {
        return '<tool_code>{"name":"calc","arguments":{}}</tool_code>';
      }
      return 'final';
    });

    const tool = {
      name: 'calc',
      description: 'calc',
      parameters: { type: 'object' as const },
      execute: jest.fn().mockResolvedValue('0'),
    };

    const agent = makeAgent({ model, tools: [tool] });
    const executor = new AgentExecutor(agent);

    await executor.execute('x', makeContext(), { taskId: 't', maxToolSteps: 3 });

    // model.process called: 1 initial + 3 tool steps (max) = 4
    expect(calls).toBeLessThanOrEqual(4);
  });
});
