import { Society, createAgent, createRole } from '../../index';
import { MockModel } from '../utils/mock-model';

describe('Society Integration Flow', () => {
  let mockModel: MockModel;

  beforeEach(() => {
    mockModel = new MockModel();
    mockModel.when('Start').thenReturn('Agent output');
  });

  test('should create and execute a simple sequential society', async () => {
    const role = createRole('analyst', 'You analyze data');
    const agent = createAgent('agent1', role, mockModel);

    const result = await Society.create()
      .withName('Test Society')
      .useAgent(agent)
      // Fluent API usage
      .addTask((s) => s.withId('step1').withAgents(['agent1']).sequential())
      .execute('Start');

    expect(result.success).toBe(true);
    expect(result.taskResults.get('step1')).toBeDefined();
    expect(result.taskResults.get('step1')![0].output).toBe('Agent output');
    expect(result.output).toBeDefined();
  });

  test('should handle builder shortcuts', async () => {
    // Tests createRole and createAgent shortcuts combined with fluent builder
    const agent = createAgent(
      'quick-agent',
      createRole('worker', 'Work hard'),
      new MockModel().withDefaultResponse('Quick work')
    );

    const result = await Society.create()
      .withName('Quick Society')
      .useAgents([agent])
      .chain() // Implicit chain
      .execute('Do work');

    expect(result.success).toBe(true);
    expect(result.output).toContain('Quick work');
  });

  test('should allow implicit routing in non-strict mode (default)', async () => {
    const agent = createAgent(
      'agent1',
      createRole('worker', 'Work hard'),
      new MockModel().withDefaultResponse('Step output')
    );

    // Multiple steps without explicit nextSteps - should work by default
    const result = await Society.create()
      .withName('Implicit Routing')
      .useAgent(agent)
      .addTask((s) => s.withId('step1').withAgents(['agent1']).sequential())
      .addTask((s) => s.withId('step2').withAgents(['agent1']).sequential())
      .execute('Start');

    expect(result.success).toBe(true);
  });

  test('should throw error in strict routing mode without explicit transitions', async () => {
    const agent = createAgent(
      'agent1',
      createRole('worker', 'Work hard'),
      new MockModel().withDefaultResponse('Step output')
    );

    // Enable strict routing - should throw error for missing nextSteps
    const result = await Society.create()
      .withName('Strict Routing')
      .useAgent(agent)
      .withStrictRouting(true)
      .addTask((s) => s.withId('step1').withAgents(['agent1']).sequential())
      .addTask((s) => s.withId('step2').withAgents(['agent1']).sequential())
      .execute('Start');

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toContain('has no explicit nextTasks defined');
  });

  test('should work in strict mode with explicit nextSteps', async () => {
    const agent = createAgent(
      'agent1',
      createRole('worker', 'Work hard'),
      new MockModel().withDefaultResponse('Step output')
    );

    const result = await Society.create()
      .withName('Strict With Explicit')
      .useAgent(agent)
      .withStrictRouting(true)
      .addTask((s) =>
        s.withId('step1').withAgents(['agent1']).sequential().withNextSteps(['step2'])
      )
      .addTask((s) => s.withId('step2').withAgents(['agent1']).sequential())
      .execute('Start');

    expect(result.success).toBe(true);
  });
});
