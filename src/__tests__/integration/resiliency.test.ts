import {
  GraphBuilder,
  NodeType,
  createAgent,
  createRole,
  RetryOptions,
  TaskResult,
} from '../../index';
import { StorageAdapter, WorkflowState } from '../../core/persistence';
import { MockModel } from '../utils/mock-model';

// --- Mock Storage Adapter (In-Memory) ---
class InMemoryStorageAdapter implements StorageAdapter {
  public states: Map<string, WorkflowState[]> = new Map();
  public saveCount = 0;

  async save(id: string, state: WorkflowState): Promise<void> {
    if (!this.states.has(id)) {
      this.states.set(id, []);
    }
    // Deep copy to ensure we capture the snapshot at that moment
    this.states.get(id)!.push(JSON.parse(JSON.stringify(state)));
    this.saveCount++;
  }

  async load(id: string): Promise<WorkflowState | null> {
    const history = this.states.get(id);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  async delete(id: string): Promise<void> {
    this.states.delete(id);
  }

  async list(): Promise<string[]> {
    return Array.from(this.states.keys());
  }
}

// --- Faulty Model for Retry Testing ---
class FaultyModel extends MockModel {
  private failures = 0;
  private maxFailures: number;

  constructor(maxFailures: number) {
    super();
    this.maxFailures = maxFailures;
  }

  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    if (this.failures < this.maxFailures) {
      this.failures++;
      throw new Error(`Transient error ${this.failures}`);
    }
    return super.process(prompt, signal);
  }
}

describe('Resiliency & Robustness', () => {
  test('should persist state granularly (before, after-node, complete)', async () => {
    const storage = new InMemoryStorageAdapter();
    const model = new MockModel().withDefaultResponse('Result');
    const agent = createAgent('agent1', createRole('worker', 'work'), model).build();

    // Create a 2-step graph
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('step2', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'step2')
      .addEdge('step2', 'end')
      .build();

    const result = await graph.execute(
      'Start Input',
      [agent],
      undefined,
      undefined,
      undefined,
      undefined,
      storage
    );

    expect(result.success).toBe(true);

    // Check save calls
    // 1. Initial save (queue: start)
    // 2. Node START processed -> save (queue: step1)
    // 3. Node STEP1 processed -> save (queue: step2)
    // 4. Node STEP2 processed -> save (queue: end)
    // 5. Node END processed -> save (queue: [])
    // 6. Completion save -> save (completed)
    // Note: The logic might vary slightly depending on peak&shift implementation detail,
    // but we expect at least one save per node.
    expect(storage.saveCount).toBeGreaterThanOrEqual(4);

    const history = storage.states.get(result.executionId!)!;

    // The last state should be 'completed'
    expect(history[history.length - 1].status).toBe('completed');

    // We should see intermediate states with 'active' status and partially filled results
    const midState = history.find(
      (s) =>
        s.status === 'active' &&
        s.results.some((r: [string, TaskResult]) => r[0] === 'step1') &&
        !s.results.some((r: [string, TaskResult]) => r[0] === 'step2')
    );
    expect(midState).toBeDefined();
  }); // End test 1

  test('should retry on transient errors and eventually succeed', async () => {
    // Model fails 2 times, succeeds on 3rd
    const model = new FaultyModel(2).withDefaultResponse('Success after retry');
    const agent = createAgent('agent1', createRole('worker', 'work'), model).build();

    const retryOptions: RetryOptions = {
      maxRetries: 3,
      initialBackoff: 10, // Fast for test
      maxBackoff: 50,
      backoffFactor: 1.1,
      jitter: false,
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, {
        agentId: 'agent1',
        retryOptions: retryOptions,
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute('input', [agent]);

    expect(result.success).toBe(true);
    expect(result.output).toBe('Success after retry');
  }); // End test 2

  test('should fail if retries exhausted', async () => {
    // Model fails 5 times, maxRetries is 3
    const model = new FaultyModel(5).withDefaultResponse('Success');
    const agent = createAgent('agent1', createRole('worker', 'work'), model).build();

    const retryOptions: RetryOptions = {
      maxRetries: 2, // Less than failures
      initialBackoff: 10,
      maxBackoff: 50,
      backoffFactor: 1,
      jitter: false,
    };

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, {
        agentId: 'agent1',
        retryOptions: retryOptions,
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    const result = await graph.execute('input', [agent]);

    expect(result.success).toBe(false);
    // Error should propagate
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toMatch(/Transient error/);
  }); // End test 3

  test('should resume correctly from a crashed state', async () => {
    const storage = new InMemoryStorageAdapter();
    const model = new MockModel().withDefaultResponse('Processed');
    const agent = createAgent('agent1', createRole('worker', 'work'), model).build();

    // Build graph
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'step1')
      .addEdge('step1', 'end')
      .build();

    // 1. Manually construct a "Crashed" state
    // Pretend START executed, Queue has [step1], Result is input
    const crashedState: WorkflowState = {
      executionId: 'resumed-exec-1',
      status: 'active', // It was active when it crashed
      queue: ['step1'], // Step 1 was about to run (or running)
      results: [],
      sharedData: [], // Default empty
      iterationCounts: [],
      executionPath: ['start'],
      messageHistory: [],
      deadLetterQueue: [],
      timestamp: Date.now() - 1000,
    };

    // 2. Resume execution
    const result = await graph.resume(
      crashedState,
      [agent],
      undefined,
      undefined,
      undefined,
      undefined,
      storage // Pass storage to verify it continues saving
    );

    expect(result.success).toBe(true);
    // Execution path should contain restored history + new nodes
    expect(result.executionPath).toEqual(['start', 'step1', 'end']);
    // Should have saved the completion state
    expect(storage.states.get('resumed-exec-1')!.pop()!.status).toBe('completed');
  });
});
