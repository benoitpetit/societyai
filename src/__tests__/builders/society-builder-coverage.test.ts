import { FluentTaskBuilder } from '../../builders/society-builder';
import { TaskResult } from '../../core/types';

describe('Workflow Builder Fluent API', () => {
  test('FluentTaskBuilder should build a basic step', () => {
    const step = FluentTaskBuilder.create()
      .withId('step1')
      .withName('Step One')
      .withDescription('A test step')
      .addAgent('agent1')
      .sequential()
      .build();

    expect(step.id).toBe('step1');
    expect(step.name).toBe('Step One');
    expect(step.description).toBe('A test step');
    expect(step.agentIds).toEqual(['agent1']);
    expect(step.executionType).toBe('sequential');
  });

  test('should support execution types', () => {
    let step = FluentTaskBuilder.create().withId('p').addAgent('a').parallel().build();
    expect(step.executionType).toBe('parallel');

    step = FluentTaskBuilder.create().withId('c').addAgent('a').collaborative(5).build();
    expect(step.executionType).toBe('collaborative');
    expect(step.maxIterations).toBe(5);
  });

  test('withBranch should configure conditional routing logic', () => {
    // Because build() returns a simple object, we can't easily test the dynamic function
    // of withBranch without mocking the whole execution context.
    // However, we can verify that nextTaskResolver is created.

    const step = FluentTaskBuilder.create()
      .withId('branch')
      .addAgent('a')
      .withBranch(() => true, ['a'], ['b'])
      .build();

    expect(step.nextTaskResolver).toBeDefined();

    // Test the logic of the resolved function
    const fakeResults: TaskResult[] = [
      {
        output: 'ok',
        agentId: 'test-agent',
        taskId: 'prev',
        timestamp: Date.now(),
        success: true,
      },
    ];
    const nextStep = step.nextTaskResolver!(fakeResults);
    // Since our condition () => true always returns true, it should pick 'a'
    expect(nextStep).toBe('a');
  });

  test('withLoop should configure collaborative loop', () => {
    const condition = (): boolean => true;
    const step = FluentTaskBuilder.create()
      .withId('loop')
      .addAgent('a')
      .withLoop(10, condition)
      .build();

    expect(step.executionType).toBe('collaborative');
    expect(step.maxIterations).toBe(10);
    expect(step.completionCondition).toBe(condition);
  });

  test('dependsOn should accumulate dependencies', () => {
    const step = FluentTaskBuilder.create()
      .withId('s')
      .addAgent('a')
      .dependsOn('a')
      .dependsOn(['b', 'c'])
      .build();

    expect(step.dependencies).toEqual(['a', 'b', 'c']);
  });

  test('withPromptTemplate should set template', () => {
    const step = FluentTaskBuilder.create()
      .withId('s')
      .addAgent('a')
      .withPromptTemplate('Template {input}')
      .build();

    expect(step.promptTemplate).toBe('Template {input}');
  });
});
