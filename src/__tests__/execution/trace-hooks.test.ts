import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import { SocietyObserver, Agent, AIModel, Role } from '../../core/types';

describe('Trace Hooks Integration', () => {
  let mockAgent: Agent;

  beforeEach(() => {
    mockAgent = {
      id: 'test-agent',
      role: {
        id: 'tester',
        name: 'Tester',
        systemPrompt: 'You are a tester.',
      } as unknown as Role,
      model: {
        id: 'mock-model',
        provider: 'mock',
        name: () => 'mock-model',
        process: jest.fn().mockResolvedValue('agent output'),
        stream: jest.fn(),
      } as unknown as AIModel,
    };
  });

  test('should trigger onNodeStart and onNodeEnd for simple workflow', async () => {
    const observer: SocietyObserver = {
      onAgentStart: jest.fn(),
      onAgentComplete: jest.fn(),
      onAgentError: jest.fn(),
      onPhaseStart: jest.fn(),
      onPhaseComplete: jest.fn(),
      onNodeStart: jest.fn(),
      onNodeEnd: jest.fn(),
      onNodeError: jest.fn(),
      onSocietyStart: jest.fn(),
      onSocietyComplete: jest.fn(),
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('process', NodeType.TRANSFORM, {
        transformer: (input) => input.toUpperCase(),
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'process')
      .addEdge('process', 'end')
      .build();

    await graph.execute('hello', [mockAgent], undefined, observer);

    // Verify Start Hooks
    expect(observer.onNodeStart).toHaveBeenCalledWith('start', NodeType.START, 'hello');
    expect(observer.onNodeStart).toHaveBeenCalledWith('process', NodeType.TRANSFORM, 'hello');
    expect(observer.onNodeStart).toHaveBeenCalledWith('end', NodeType.END, 'HELLO');

    // Verify End Hooks
    expect(observer.onNodeEnd).toHaveBeenCalledWith('start', 'hello', expect.any(Number));
    expect(observer.onNodeEnd).toHaveBeenCalledWith('process', 'HELLO', expect.any(Number));
    expect(observer.onNodeEnd).toHaveBeenCalledWith('end', 'HELLO', expect.any(Number));
  });

  test('should trigger onNodeError when node fails', async () => {
    const observer: SocietyObserver = {
      onAgentStart: jest.fn(),
      onAgentComplete: jest.fn(),
      onAgentError: jest.fn(),
      onPhaseStart: jest.fn(),
      onPhaseComplete: jest.fn(),
      onNodeStart: jest.fn(),
      onNodeEnd: jest.fn(),
      onNodeError: jest.fn(),
      onSocietyStart: jest.fn(),
      onSocietyComplete: jest.fn(),
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('fail', NodeType.TRANSFORM, {
        transformer: () => {
          throw new Error('Boom');
        },
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'fail')
      .addEdge('fail', 'end')
      .build();

    await expect(graph.execute('input', [], undefined, observer)).resolves.toHaveProperty(
      'success',
      false
    );

    expect(observer.onNodeStart).toHaveBeenCalledWith('fail', NodeType.TRANSFORM, 'input');
    expect(observer.onNodeError).toHaveBeenCalledWith(
      'fail',
      expect.objectContaining({ message: 'Boom' })
    );
    expect(observer.onNodeEnd).not.toHaveBeenCalledWith(
      'fail',
      expect.any(String),
      expect.any(Number)
    );
  });
});
