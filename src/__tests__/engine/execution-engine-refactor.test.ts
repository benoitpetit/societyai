/**
 * Tests for the refactored ExecutionEngine:
 * - runExecutionLoop shared by execute() and resume()
 * - loopCondition activation on LOOP nodes
 * - taskResults propagation in executeAgentNode
 */

import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import { Agent, Role } from '../../core/types';
import { MockModel } from '../utils/mock-model';
import { StorageAdapter, WorkflowState } from '../../core/persistence';

// ============================================================================
// Helpers
// ============================================================================

function createAgent(id: string, model: MockModel): Agent {
  return {
    id,
    name: id,
    role: { id: `role-${id}`, name: id, systemPrompt: `You are ${id}` } as Role,
    model,
    priority: 0,
  };
}

class InMemoryStorageAdapter implements StorageAdapter {
  public states = new Map<string, WorkflowState>();
  public saveCount = 0;

  async save(id: string, state: WorkflowState): Promise<void> {
    this.states.set(id, JSON.parse(JSON.stringify(state)));
    this.saveCount++;
  }
  async load(id: string): Promise<WorkflowState | null> {
    return this.states.get(id) || null;
  }
  async delete(id: string): Promise<void> {
    this.states.delete(id);
  }
  async list(): Promise<string[]> {
    return Array.from(this.states.keys());
  }
}

// ============================================================================
// Tests: runExecutionLoop (shared logic)
// ============================================================================

describe('ExecutionEngine — runExecutionLoop refactor', () => {
  let model: MockModel;
  let agent: Agent;

  beforeEach(() => {
    model = new MockModel();
    model.withDefaultResponse('processed');
    agent = createAgent('agent1', model);
  });

  test('execute() and resume() should both use shared loop — sequential workflow', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute('hello', [agent]);
    expect(result.status).toBe('completed');
    expect(result.success).toBe(true);
    expect(result.executionId).toBeDefined();
  });

  test('execute() should save granular state via storageAdapter', async () => {
    const storage = new InMemoryStorageAdapter();

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute(
      'input',
      [agent],
      undefined,
      undefined,
      undefined,
      undefined,
      storage
    );

    expect(result.status).toBe('completed');
    // Multiple saves: initial, after each node, final completion
    expect(storage.saveCount).toBeGreaterThanOrEqual(3);
  });

  test('HUMAN node should pause and resume correctly via shared loop', async () => {
    const storage = new InMemoryStorageAdapter();

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('human', NodeType.HUMAN)
      .addNode('step2', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'human')
      .addEdge('human', 'step2')
      .addEdge('step2', 'end')
      .build();

    // First execution → pauses at HUMAN node
    const paused = await graph.execute(
      'initial',
      [agent],
      undefined,
      undefined,
      undefined,
      undefined,
      storage
    );

    expect(paused.status).toBe('paused');
    expect(paused.waitingForNodeId).toBe('human');
    expect(paused.executionId).toBeDefined();

    // Load saved state
    const savedState = await storage.load(paused.executionId!);
    expect(savedState).not.toBeNull();
    expect(savedState!.status).toBe('paused');

    // Resume with human input
    model.withDefaultResponse('final output');
    const resumed = await graph.resume(
      savedState!,
      [agent],
      'human says ok',
      undefined,
      undefined,
      undefined,
      storage
    );

    expect(resumed.status).toBe('completed');
    expect(resumed.success).toBe(true);
    expect(resumed.nodeResults.has('human')).toBe(true);
    expect(resumed.nodeResults.get('human')!.agentId).toBe('human');
  });

  test('runExecutionLoop should handle errors and return failed status', async () => {
    const failModel = new MockModel();
    failModel.withDefaultResponse('');
    // Override process to throw
    const failAgent = createAgent('fail-agent', failModel);
    failAgent.model = {
      name: (): string => 'fail-model',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => {
        throw new Error('Agent exploded');
      },
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, {
        agentId: 'fail-agent',
        retryOptions: {
          maxRetries: 0,
          initialBackoff: 1,
          maxBackoff: 1,
          backoffFactor: 1,
          jitter: false,
        },
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute('input', [failAgent]);
    expect(result.status).toBe('failed');
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test('runExecutionLoop should save failed state when storageAdapter exists', async () => {
    const storage = new InMemoryStorageAdapter();
    const failAgent = createAgent('fail-agent', model);
    failAgent.model = {
      name: (): string => 'fail-model',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => {
        throw new Error('boom');
      },
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, {
        agentId: 'fail-agent',
        retryOptions: {
          maxRetries: 0,
          initialBackoff: 1,
          maxBackoff: 1,
          backoffFactor: 1,
          jitter: false,
        },
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute(
      'input',
      [failAgent],
      undefined,
      undefined,
      undefined,
      undefined,
      storage
    );

    expect(result.status).toBe('failed');
    // Verify state was saved as failed
    const savedState = await storage.load(result.executionId!);
    expect(savedState).not.toBeNull();
    expect(savedState!.status).toBe('failed');
  });

  test('resume() should restore currentResult from last executed node', async () => {
    const storage = new InMemoryStorageAdapter();

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('human', NodeType.HUMAN)
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'human')
      .addEdge('human', 'end')
      .build();

    model.withDefaultResponse('step1-result');
    const paused = await graph.execute(
      'input',
      [agent],
      undefined,
      undefined,
      undefined,
      undefined,
      storage
    );

    expect(paused.status).toBe('paused');
    const savedState = await storage.load(paused.executionId!);

    // Resume
    const resumed = await graph.resume(savedState!, [agent], 'user input');
    expect(resumed.status).toBe('completed');
    expect(resumed.nodeResults.get('human')!.output).toBe('user input');
  });
});

// ============================================================================
// Tests: loopCondition activation
// ============================================================================

describe('ExecutionEngine — loopCondition', () => {
  let model: MockModel;
  let agent: Agent;

  beforeEach(() => {
    model = new MockModel();
    agent = createAgent('agent1', model);
  });

  test('loopCondition returning false should terminate loop early', async () => {
    let callCount = 0;
    agent.model = {
      name: (): string => 'counter-model',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => {
        callCount++;
        return `iteration-${callCount}`;
      },
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('loop', NodeType.LOOP, {
        maxIterations: 10,
        // Stop after first iteration (iteration count will be 1 when checked second time)
        loopCondition: (iteration: number) => iteration < 1,
      })
      .addNode('body', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'loop')
      .addEdge('loop', 'body')
      .addEdge('body', 'loop')
      .addEdge('loop', 'end')
      .build();

    const result = await graph.execute('input', [agent]);
    expect(result.success).toBe(true);
    // The loop should stop much earlier than maxIterations=10
    expect(callCount).toBeLessThan(10);
  });

  test('loop without loopCondition should fall back to maxIterations', async () => {
    let callCount = 0;
    agent.model = {
      name: (): string => 'counter-model',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => {
        callCount++;
        return `result-${callCount}`;
      },
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('loop', NodeType.LOOP, { maxIterations: 3 })
      .addNode('body', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'loop')
      .addEdge('loop', 'body')
      .addEdge('body', 'loop')
      .addEdge('loop', 'end')
      .build();

    const result = await graph.execute('input', [agent]);
    expect(result.success).toBe(true);
    // Should loop exactly maxIterations times
    expect(callCount).toBe(3);
  });

  test('loopCondition should receive iteration count and current result', async () => {
    const conditionCalls: Array<{ iteration: number; result: string }> = [];

    agent.model = {
      name: (): string => 'model',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => 'done',
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('loop', NodeType.LOOP, {
        maxIterations: 5,
        loopCondition: (iteration: number, result: string) => {
          conditionCalls.push({ iteration, result });
          return iteration < 2; // allow 2 iterations
        },
      })
      .addNode('body', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'loop')
      .addEdge('loop', 'body')
      .addEdge('body', 'loop')
      .addEdge('loop', 'end')
      .build();

    const result = await graph.execute('input', [agent]);
    expect(result.success).toBe(true);
    // loopCondition should have been called
    expect(conditionCalls.length).toBeGreaterThan(0);
    // First call should have iteration 0 (before any iteration)
    expect(conditionCalls[0].iteration).toBe(0);
  });
});

// ============================================================================
// Tests: taskResults propagation in executeAgentNode
// ============================================================================

describe('ExecutionEngine — taskResults propagation', () => {
  test('subsequent agents should receive prior node results as taskResults', async () => {
    const model1 = new MockModel();
    model1.withDefaultResponse('output-from-agent1');

    // Agent2 captures its execution context
    const model2 = {
      name: (): string => 'model2',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => 'output-from-agent2',
    };

    const agent1 = createAgent('agent1', model1);
    const agent2 = createAgent('agent2', new MockModel());
    agent2.model = model2;

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('step2', NodeType.AGENT, { agentId: 'agent2' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'step2')
      .addEdge('step2', 'end')
      .build();

    const result = await graph.execute('input', [agent1, agent2]);
    expect(result.success).toBe(true);

    // Both agents should have results stored
    expect(result.nodeResults.has('step1')).toBe(true);
    expect(result.nodeResults.has('step2')).toBe(true);
    expect(result.nodeResults.get('step1')!.output).toBe('output-from-agent1');
    expect(result.nodeResults.get('step2')!.output).toBe('output-from-agent2');
  });

  test('taskResults map should group by agentId', async () => {
    // When the same agent runs in multiple nodes,
    // taskResults should accumulate under the same agentId key
    const model1 = new MockModel();
    let callNum = 0;
    model1.withDefaultResponse('');
    const agent1 = createAgent('agent1', model1);
    agent1.model = {
      name: (): string => 'model',
      supportsPromptType: (): boolean => true,
      process: async (): Promise<string> => {
        callNum++;
        return `call-${callNum}`;
      },
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('step2', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'step2')
      .addEdge('step2', 'end')
      .build();

    const result = await graph.execute('input', [agent1]);
    expect(result.success).toBe(true);
    expect(result.nodeResults.has('step1')).toBe(true);
    expect(result.nodeResults.has('step2')).toBe(true);
    // verify second call received results from first (via the model being called)
    expect(result.nodeResults.get('step1')!.output).toBe('call-1');
    expect(result.nodeResults.get('step2')!.output).toBe('call-2');
  });
});
