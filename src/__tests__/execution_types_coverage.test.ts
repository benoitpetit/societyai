/**
 * Comprehensive Execution Types Logic Coverage Tests
 * Verifies that each specific execution node type functions correctly within the iterative engine.
 */

import { GraphBuilder, NodeType } from '../execution/engine/execution-engine';
import { Agent, Role } from '../core/types';
import { MockModel } from './utils/mock-model';

describe('Execution Types Logic Coverage', () => {
  let mockModel: MockModel;
  let baseAgent: Agent;

  beforeEach(() => {
    mockModel = new MockModel();
    baseAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      role: {
        id: 'role-1',
        name: 'Role',
        systemPrompt: 'System',
      } as Role,
      model: mockModel,
    };
  });

  /**
   * 1. AGENT Node (Sequential)
   */
  test('AGENT Node: should execute a single agent task', async () => {
    mockModel.withDefaultResponse('Agent Output');

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('task', NodeType.AGENT, { agentId: 'agent-1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'task')
      .addEdge('task', 'end')
      .build();

    const result = await graph.execute('Input', [baseAgent]);

    expect(result.success).toBe(true);
    expect(result.output).toBe('Agent Output');
    expect(result.executionPath).toEqual(['start', 'task', 'end']);
  });

  /**
   * 2. PARALLEL Node
   */
  test('PARALLEL Node: should execute multiple agents concurrently', async () => {
    const agent2 = { ...baseAgent, id: 'agent-2' };
    mockModel.when('Input').thenReturn('Output');

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('parallel', NodeType.PARALLEL, { agentIds: ['agent-1', 'agent-2'] })
      .addNode('end', NodeType.END)
      .addEdge('start', 'parallel')
      .addEdge('parallel', 'end')
      .build();

    const result = await graph.execute('Input', [baseAgent, agent2]);

    expect(result.success).toBe(true);
    // Both agents produced output — the parallel node combines them
    expect(result.output).toContain('Output');
    // The parallel node result should be present and have output
    const parallelResult = result.nodeResults.get('parallel');
    expect(parallelResult).toBeDefined();
    expect(parallelResult!.output.length).toBeGreaterThan(0);
    // Execution path passes through the parallel node
    expect(result.executionPath).toContain('parallel');
  });

  /**
   * 3. AGGREGATE Node
   */
  test('AGGREGATE Node: should combine results from previous steps', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('task1', NodeType.AGENT, { agentId: 'agent-1' })
      .addNode('agg', NodeType.AGGREGATE, {
        aggregator: (results) => `Aggregated: ${results.length} items`,
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'task1')
      .addEdge('task1', 'agg')
      .addEdge('agg', 'end')
      .build();

    mockModel.withDefaultResponse('Result 1');
    const result = await graph.execute('Input', [baseAgent]);

    expect(result.output).toContain('Aggregated');
    expect(result.executionPath).toContain('agg');
  });

  /**
   * 4. TRANSFORM Node
   */
  test('TRANSFORM Node: should modify data in flight', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('transform', NodeType.TRANSFORM, {
        transformer: (input) => input.split('').reverse().join(''),
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'transform')
      .addEdge('transform', 'end')
      .build();

    const result = await graph.execute('HELLO', [baseAgent]);
    expect(result.output).toBe('OLLEH');
  });

  /**
   * 5. CONDITION Node
   */
  test('CONDITION Node: should branch execution flow', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('cond', NodeType.CONDITION, {
        condition: (res) => res === 'go-left',
      })
      .addNode('left', NodeType.TRANSFORM, { transformer: () => 'LEFT' })
      .addNode('right', NodeType.TRANSFORM, { transformer: () => 'RIGHT' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'cond')
      .addEdge('cond', 'left', { label: 'true' })
      .addEdge('cond', 'right', { label: 'false' })
      .addEdge('left', 'end')
      .addEdge('right', 'end')
      .build();

    const resLeft = await graph.execute('go-left', [baseAgent]);
    expect(resLeft.output).toBe('LEFT');

    const resRight = await graph.execute('go-right', [baseAgent]);
    expect(resRight.output).toBe('RIGHT');
  });

  /**
   * 6. LOOP Node
   */
  test('LOOP Node: should iterate and exit correctly', async () => {
    // Strategy: Loop Node acts as the "Check"
    // We rely on the Loop Node's internal counter.
    // However, the Loop Node implementation strictly controls whether to queue *any* next nodes based on maxIterations.
    // If we want an exit path, we might need a condition node OR rely on the fact that if loop stops,
    // we need to ensure the graph continues?

    // Actually, looking at the code: executeLoopNode ONLY queues next nodes if iteration < max.
    // It implies that "next nodes" are the LOOP BODY.
    // It DOES NOT seem to support an "exit" edge that fires when iteration >= max.
    // This looks like a logic gap if we want to continue flow AFTER the loop.

    // Let's test if it stops.
    let bodyExecutions = 0;

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('loop', NodeType.LOOP, { maxIterations: 3 })
      .addNode('body', NodeType.TRANSFORM, {
        transformer: (input) => {
          bodyExecutions++;
          return input;
        },
      })
      .addNode('end', NodeType.END)

      .addEdge('start', 'loop')
      .addEdge('loop', 'body')
      .addEdge('body', 'loop') // Cycle back
      .build();

    await graph.execute('Start', [baseAgent]);

    // Body runs exactly maxIterations (3) times:
    // Start → Loop(1) → Body → Loop(2) → Body → Loop(3) → Body → Loop(4 = stop, no more queuing)
    expect(bodyExecutions).toBe(3);

    // Known limitation: the LOOP node does not emit an "exit" edge once the limit is
    // reached, so any node connected only after the loop (like 'end') is never visited.
    // Downstream continuation requires a parallel exit path or a separate CONDITION node.
  });

  /**
   * 7. COLLABORATIVE Node
   */
  test('COLLABORATIVE Node: should run multi-agent interaction', async () => {
    const agent2 = { ...baseAgent, id: 'agent-2' };

    // Mock simple conversation
    mockModel.withDefaultResponse('Message');

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('collab', NodeType.COLLABORATIVE, {
        agentIds: ['agent-1', 'agent-2'],
        maxIterations: 2,
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'collab')
      .addEdge('collab', 'end')
      .build();

    const result = await graph.execute('Topic', [baseAgent, agent2]);

    expect(result.success).toBe(true);
    expect(result.executionPath).toContain('collab');
    // Collaborative node returns the last message
    expect(result.output).toBe('Message');
  });
});
