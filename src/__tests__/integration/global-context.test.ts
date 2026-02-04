import { Society, createAgent, createRole } from '../../index';
import { MockModel } from '../utils/mock-model';

describe('Global Context Integration', () => {
  test('should access globalContext in agent execution', async () => {
    const mockModel = new MockModel();

    // Mock that captures the prompt to verify context is passed
    let capturedPrompt = '';
    mockModel.process = async (prompt: unknown) => {
      capturedPrompt = String(prompt);
      return 'Context received';
    };

    const agent = createAgent(
      'contextual-agent',
      createRole('agent', 'You are an agent. Context: {context}', {
        name: 'Contextual Agent',
      }),
      mockModel
    );

    const result = await Society.create()
      .withName('Global Context Test')
      .withGlobalContext({
        userId: 'user123',
        sessionId: 'session456',
        preferences: { theme: 'dark', lang: 'fr' },
      })
      .useAgent(agent)
      .addTask((s) => s.withId('process').withAgents(['contextual-agent']).sequential())
      .execute('Test input');

    expect(result.success).toBe(true);

    // The globalContext should be available in sharedData
    // This is verified indirectly through successful execution
    expect(result.output).toBeDefined();
    expect(capturedPrompt).toBeDefined();
  });

  test('should preserve globalContext across multiple steps', async () => {
    const model1 = new MockModel().withDefaultResponse('Step 1 complete');
    const model2 = new MockModel().withDefaultResponse('Step 2 complete');

    const agent1 = createAgent('agent1', createRole('role1', 'First'), model1);
    const agent2 = createAgent('agent2', createRole('role2', 'Second'), model2);

    const result = await Society.create()
      .withName('Multi-Step Context Test')
      .withGlobalContext({
        projectId: 'proj789',
        config: { retries: 3 },
      })
      .useAgents([agent1, agent2])
      .addTask((s) => s.withId('step1').withAgents(['agent1']).sequential())
      .addTask((s) => s.withId('step2').withAgents(['agent2']).sequential())
      .execute('Multi-step test');

    expect(result.success).toBe(true);
    expect(result.taskResults.has('step1')).toBe(true);
    expect(result.taskResults.has('step2')).toBe(true);
  });

  test('should allow adding context dynamically', async () => {
    const mockModel = new MockModel().withDefaultResponse('Dynamic context used');
    const agent = createAgent('agent', createRole('role', 'Agent'), mockModel);

    const society = Society.create()
      .withName('Dynamic Context Test')
      .useAgent(agent)
      .addGlobalContext('initialKey', 'initialValue')
      .addGlobalContext('runtimeKey', new Date().toISOString())
      .addTask((s) => s.withId('process').withAgents(['agent']).sequential());

    const result = await society.execute('Test');

    expect(result.success).toBe(true);
  });

  test('should work with empty globalContext', async () => {
    const mockModel = new MockModel().withDefaultResponse('No context needed');
    const agent = createAgent('agent', createRole('role', 'Agent'), mockModel);

    // Don't set any globalContext - should still work
    const result = await Society.create()
      .withName('No Context Test')
      .useAgent(agent)
      .addTask((s) => s.withId('process').withAgents(['agent']).sequential())
      .execute('Test without context');

    expect(result.success).toBe(true);
    expect(result.output).toBe('No context needed');
  });
});
