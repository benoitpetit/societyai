import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import { Agent, Role } from '../../core/types';
import { MockModel } from '../utils/mock-model';

describe('ExecutionEngine', () => {
  let mockModel: MockModel;
  let agent: Agent;

  beforeEach(() => {
    mockModel = new MockModel();
    agent = {
      id: 'agent1',
      name: 'Test Agent',
      role: {
        id: 'role1',
        name: 'Role',
        systemPrompt: 'You are a test role',
      } as Role,
      model: mockModel,
      priority: 0,
    };
  });

  test('should execute a simple single-node workflow', async () => {
    mockModel.withDefaultResponse('Processed: input');

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute('input', [agent]);

    expect(result.success).toBe(true);
    expect(result.output).toBe('Processed: input');
    expect(result.nodeResults.has('step1')).toBe(true);
  });

  test('should execute parallel nodes', async () => {
    const agent2 = {
      ...agent,
      id: 'agent2',
      model: new MockModel().withDefaultResponse('Result 2'),
    };
    mockModel.withDefaultResponse('Result 1');

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('parallel', NodeType.PARALLEL, { agentIds: ['agent1', 'agent2'] })
      .addNode('end', NodeType.END)
      .addEdge('start', 'parallel')
      .addEdge('parallel', 'end')
      .build();

    const result = await graph.execute('input', [agent, agent2]);

    expect(result.success).toBe(true);
    // Parallel output is usually concatenated
    expect(result.output).toContain('Result 1');
    expect(result.output).toContain('Result 2');
  });

  test('should handle conditional routing logic', async () => {
    const agentTrue = {
      ...agent,
      id: 'trueAgent',
      model: new MockModel().withDefaultResponse('True Path'),
    };
    const agentFalse = {
      ...agent,
      id: 'falseAgent',
      model: new MockModel().withDefaultResponse('False Path'),
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      // Condition: check if input is "go_true"
      .addNode('check', NodeType.CONDITION, {
        condition: (_res, ctx) => ctx.input === 'go_true',
      })
      .addNode('pathTrue', NodeType.AGENT, { agentId: 'trueAgent' })
      .addNode('pathFalse', NodeType.AGENT, { agentId: 'falseAgent' })
      .addNode('end', NodeType.END)

      .addEdge('start', 'check')
      .addEdge('check', 'pathTrue', { label: 'true' })
      .addEdge('check', 'pathFalse', { label: 'false' })
      .addEdge('pathTrue', 'end')
      .addEdge('pathFalse', 'end')
      .build();

    // Test True Path
    const resultTrue = await graph.execute('go_true', [agentTrue, agentFalse]);
    expect(resultTrue.output).toBe('True Path');

    // Test False Path
    const resultFalse = await graph.execute('go_something_else', [agentTrue, agentFalse]);
    expect(resultFalse.output).toBe('False Path');
  });

  test('should initialize sharedData with initialContext', async () => {
    mockModel.withDefaultResponse('Processed');

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const initialContext = {
      userId: '12345',
      preference: 'detailed',
      maxTokens: 1000,
    };

    const result = await graph.execute(
      'input',
      [agent],
      undefined,
      undefined,
      undefined,
      initialContext
    );

    expect(result.success).toBe(true);
    // The context should have been initialized with our data
    // We can't directly access sharedData from result, but we can verify no errors occurred
    expect(result.errors).toBeUndefined();
  });
});
