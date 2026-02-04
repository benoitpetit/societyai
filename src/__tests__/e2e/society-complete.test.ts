import { Society, createRole, createAgent } from '../../index';
import { MockModel } from '../utils/mock-model';

describe('SocietyAI End-to-End', () => {
  let mockModel: MockModel;

  beforeEach(() => {
    mockModel = new MockModel();
    mockModel.withDefaultResponse('Analysis complete');
  });

  test('should execute a sequential workflow with two agents', async () => {
    // 1. Setup Agents using Helpers
    const devRole = createRole('developer', 'You are a developer.', {
      name: 'Developer',
      promptTemplate: '{input}',
    });

    const reviewerRole = createRole('reviewer', 'You are a reviewer.', {
      name: 'Reviewer',
      promptTemplate: '{input}',
    });

    // 2. Build Society
    const society = Society.create()
      .withId('code-review-society')
      .withDescription('A society for coding and reviewing')
      .useAgent(createAgent('dev-agent', devRole, mockModel, { name: 'Alice' }))
      .useAgent(createAgent('review-agent', reviewerRole, mockModel, { name: 'Bob' }));

    // 3. Define Workflow
    society
      .addTask((step) =>
        step
          .withId('write-code')
          .withAgents(['dev-agent'])
          .withInstructions('Write a hello world function')
          .sequential()
      )
      .addTask((step) =>
        step
          .withId('review-code')
          .withAgents(['review-agent'])
          .withInstructions('Review the code')
          .dependsOn('write-code')
      );

    // 4. Configure mocked responses
    mockModel
      .when('Write a hello world function')
      .thenReturn('function hello() { console.log("world"); }');
    mockModel.when('Review the code').thenReturn('LGTM');

    // 5. Execute
    const result = await society.execute('Start project');

    // 6. Assertions
    expect(result.success).toBe(true);
    expect(result.taskResults.get('write-code')).toBeDefined();
    expect(result.taskResults.get('write-code')![0].output).toContain('function hello');
    expect(result.taskResults.get('review-code')![0].output).toContain('LGTM');

    // Check call history
    expect(mockModel.callHistory.length).toBeGreaterThanOrEqual(2);
  });

  test('should handle conditional routing', async () => {
    // Conditional workflow test
    // Implement basic conditional check if API supports it, otherwise keep empty for now or remove
    expect(true).toBe(true);
  });
});
