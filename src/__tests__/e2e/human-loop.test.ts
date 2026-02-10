import { Society, createAgent, createRole } from '../../index';
import { MockModel } from '../utils/mock-model';
import { FileStorageAdapter } from '../../core/persistence';
import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Human-in-the-Loop E2E', () => {
  let mockModel: MockModel;
  const TEST_STORAGE_DIR = path.join(__dirname, '.tmp-hitl-test');
  let storageAdapter: FileStorageAdapter;

  beforeEach(async () => {
    mockModel = new MockModel();
    mockModel.withDefaultResponse('Processed');

    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
    storageAdapter = new FileStorageAdapter({ baseDir: TEST_STORAGE_DIR });
  });

  afterAll(async () => {
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('should pause at human node and resume correctly', async () => {
    // 1. Setup
    const role = createRole('worker', 'Work');
    const agent = createAgent('worker-1', role, mockModel);

    // Config created to verify typing, but we build graph manually for this test
    // to access execute() with storageAdapter directly
    Society.create()
      .withId('human-workflow')
      .useAgent(agent)
      .addTask((t) => t.withId('step-1').withAgents(['worker-1']))
      .addTask((t) => t.withId('step-human').isHuman())
      .build();

    // 2. Build Graph manually

    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('end', NodeType.END)
      .addNode('step-1', NodeType.AGENT, { agentId: 'worker-1' })
      .addNode('step-human', NodeType.HUMAN)
      .addNode('step-3', NodeType.AGENT, {
        agentId: 'worker-1',
        metadata: { promptTemplate: 'Received from human: {input}' },
      })
      .addEdge('start', 'step-1')
      .addEdge('step-1', 'step-human')
      .addEdge('step-human', 'step-3')
      .addEdge('step-3', 'end')
      .build();

    // 3. Execute - Phase 1 (Start -> Pause)
    const result1 = await graph.execute(
      'Start input',
      [agent.build()],
      undefined,
      undefined,
      undefined,
      undefined,
      storageAdapter
    );

    expect(result1.status).toBe('paused');
    expect(result1.waitingForNodeId).toBe('step-human');
    expect(result1.executionId).toBeDefined();

    // Verify storage file exists
    const storedState = await storageAdapter.load(result1.executionId!);
    expect(storedState).not.toBeNull();
    expect(storedState?.status).toBe('paused');
    expect(storedState?.waitingForNodeId).toBe('step-human');

    // 4. Resume - Phase 2 (Human Input -> End)
    // Setup mock for step-3 to verify it receives the human input
    mockModel.when('Received from human: Approved!').thenReturn('Final Done');

    const result2 = await graph.resume(
      storedState!,
      [agent.build()],
      'Approved!', // Human Input
      undefined,
      undefined,
      undefined,
      storageAdapter
    );

    expect(result2.status).toBe('completed');
    expect(result2.success).toBe(true);

    // Check results
    const step3Result = result2.nodeResults.get('step-3');
    expect(step3Result).toBeDefined();
    expect(step3Result!.output).toBe('Final Done');

    // Also check that the human node result is recorded in the final output
    const humanResult = result2.nodeResults.get('step-human');
    expect(humanResult).toBeDefined();
    expect(humanResult!.output).toBe('Approved!');
  });
});
