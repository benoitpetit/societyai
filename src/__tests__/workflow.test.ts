import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
  MessageBus,
  StandardModelBase,
} from '../';

/**
 * Mock AI Model for testing
 */
class MockModel extends StandardModelBase {
  constructor(
    name = 'MockModel',
    private response = 'Mock response'
  ) {
    super({ name, timeout: 5000 }, async () => this.response);
  }

  setResponse(response: string): void {
    this.response = response;
  }
}

describe('Workflow System', () => {
  describe('RoleBuilder', () => {
    it('should build a valid role', () => {
      const role = RoleBuilder.create()
        .withId('test-role')
        .withName('Test Role')
        .withDescription('A test role')
        .withSystemPrompt('You are a test agent.')
        .withCapabilities(['testing', 'validation'])
        .withConstraints(['no-external-calls'])
        .withPromptTemplate('{systemPrompt}\n\n{input}')
        .build();

      expect(role.id).toBe('test-role');
      expect(role.name).toBe('Test Role');
      expect(role.description).toBe('A test role');
      expect(role.systemPrompt).toBe('You are a test agent.');
      expect(role.capabilities).toEqual(['testing', 'validation']);
      expect(role.constraints).toEqual(['no-external-calls']);
      expect(role.promptTemplate).toBe('{systemPrompt}\n\n{input}');
    });

    it('should auto-generate id if missing', () => {
      const role = RoleBuilder.create().withName('Test').withSystemPrompt('Test').build();
      expect(role.id).toBeDefined();
      expect(role.id).toContain('role-');
    });

    it('should default name to id if missing', () => {
      const role = RoleBuilder.create().withId('test-id').withSystemPrompt('Test').build();
      expect(role.name).toBe('test-id');
    });

    it('should throw error if systemPrompt is missing', () => {
      expect(() => {
        RoleBuilder.create().withId('test').withName('Test').build();
      }).toThrow('Role systemPrompt is required');
    });
  });

  describe('AgentBuilder', () => {
    const testRole = RoleBuilder.create()
      .withId('test-role')
      .withName('Test Role')
      .withSystemPrompt('Test prompt')
      .build();

    const testModel = new MockModel();

    it('should build a valid agent', () => {
      const agent = AgentBuilder.create()
        .withId('agent-1')
        .withName('Test Agent')
        .withRole(testRole)
        .withModel(testModel)
        .canCommunicateWith(['agent-2', 'agent-3'])
        .withPriority(5)
        .withInitialContext({ key: 'value' })
        .build();

      expect(agent.id).toBe('agent-1');
      expect(agent.name).toBe('Test Agent');
      expect(agent.role).toEqual(testRole);
      expect(agent.model).toBe(testModel);
      expect(agent.canCommunicateWith).toEqual(['agent-2', 'agent-3']);
      expect(agent.priority).toBe(5);
      expect(agent.initialContext).toEqual({ key: 'value' });
    });

    it('should throw error if id is missing', () => {
      expect(() => {
        AgentBuilder.create().withRole(testRole).withModel(testModel).build();
      }).toThrow('Agent id is required');
    });

    it('should throw error if role is missing', () => {
      expect(() => {
        AgentBuilder.create().withId('test').withModel(testModel).build();
      }).toThrow('Agent role is required');
    });

    it('should throw error if model is missing', () => {
      expect(() => {
        AgentBuilder.create().withId('test').withRole(testRole).build();
      }).toThrow('Agent model is required');
    });
  });

  describe('StepBuilder', () => {
    it('should build a valid step', () => {
      const step = StepBuilder.create()
        .withId('step-1')
        .withName('Test Step')
        .withDescription('A test step')
        .withAgents(['agent-1', 'agent-2'])
        .withExecutionType('parallel')
        .withInstructions('Do the thing')
        .withMaxIterations(5)
        .build();

      expect(step.id).toBe('step-1');
      expect(step.name).toBe('Test Step');
      expect(step.description).toBe('A test step');
      expect(step.agentIds).toEqual(['agent-1', 'agent-2']);
      expect(step.executionType).toBe('parallel');
      expect(step.instructions).toBe('Do the thing');
      expect(step.maxIterations).toBe(5);
    });

    it('should default to sequential execution type', () => {
      const step = StepBuilder.create()
        .withId('step-1')
        .withName('Test Step')
        .withAgents(['agent-1'])
        .build();

      expect(step.executionType).toBe('sequential');
    });

    it('should throw error if agents are missing', () => {
      expect(() => {
        StepBuilder.create().withId('step-1').withName('Test Step').build();
      }).toThrow('Step must have at least one agent');
    });
  });

  describe('WorkflowConfigBuilder', () => {
    const testRole = RoleBuilder.create()
      .withId('test-role')
      .withName('Test Role')
      .withSystemPrompt('Test')
      .build();

    const testModel = new MockModel();

    const testAgent = AgentBuilder.create()
      .withId('agent-1')
      .withRole(testRole)
      .withModel(testModel)
      .build();

    const testStep = StepBuilder.create()
      .withId('step-1')
      .withName('Test Step')
      .withAgents(['agent-1'])
      .build();

    it('should build a valid workflow', () => {
      const workflow = WorkflowConfigBuilder.create()
        .withId('workflow-1')
        .withName('Test Workflow')
        .withDescription('A test workflow')
        .addAgent(testAgent)
        .addStep(testStep)
        .withGlobalContext({ key: 'value' })
        .build();

      expect(workflow.id).toBe('workflow-1');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.description).toBe('A test workflow');
      expect(workflow.agents).toHaveLength(1);
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.globalContext).toEqual({ key: 'value' });
      expect(workflow.entryStepId).toBe('step-1');
    });

    it('should throw error if no agents', () => {
      expect(() => {
        WorkflowConfigBuilder.create()
          .withId('workflow-1')
          .withName('Test Workflow')
          .addStep(testStep)
          .build();
      }).toThrow('Workflow must have at least one agent');
    });

    it('should throw error if no steps', () => {
      expect(() => {
        WorkflowConfigBuilder.create()
          .withId('workflow-1')
          .withName('Test Workflow')
          .addAgent(testAgent)
          .build();
      }).toThrow('Workflow must have at least one step');
    });
  });

  describe('MessageBus', () => {
    it('should send and receive messages', async () => {
      const bus = new MessageBus();
      const receivedMessages: string[] = [];

      bus.subscribe('agent-1', (message) => {
        receivedMessages.push(message.content);
      });

      await bus.send({
        from: 'agent-2',
        to: 'agent-1',
        type: 'data',
        content: 'Hello',
        timestamp: Date.now(),
        messageId: 'msg-1',
      });

      expect(receivedMessages).toContain('Hello');
    });

    it('should handle broadcast messages', async () => {
      const bus = new MessageBus();
      const receivedByAgent1: string[] = [];
      const receivedByAgent2: string[] = [];

      bus.subscribe('agent-1', (message) => {
        receivedByAgent1.push(message.content);
      });

      bus.subscribe('agent-2', (message) => {
        receivedByAgent2.push(message.content);
      });

      await bus.send({
        from: 'agent-3',
        to: 'broadcast',
        type: 'notification',
        content: 'Hello everyone',
        timestamp: Date.now(),
        messageId: 'msg-1',
      });

      expect(receivedByAgent1).toContain('Hello everyone');
      expect(receivedByAgent2).toContain('Hello everyone');
    });

    it('should filter history by criteria', async () => {
      const bus = new MessageBus();

      await bus.send({
        from: 'agent-1',
        to: 'agent-2',
        type: 'data',
        content: 'Data message',
        timestamp: Date.now(),
        messageId: 'msg-1',
      });

      await bus.send({
        from: 'agent-1',
        to: 'agent-3',
        type: 'request',
        content: 'Request message',
        timestamp: Date.now(),
        messageId: 'msg-2',
      });

      const fromAgent1 = bus.getHistory({ from: 'agent-1' });
      expect(fromAgent1).toHaveLength(2);

      const toAgent2 = bus.getHistory({ to: 'agent-2' });
      expect(toAgent2).toHaveLength(1);

      const dataType = bus.getHistory({ type: 'data' });
      expect(dataType).toHaveLength(1);
    });
  });

  describe('DefaultWorkflowExecutor', () => {
    const testRole = RoleBuilder.create()
      .withId('test-role')
      .withName('Test Role')
      .withSystemPrompt('You are a test agent.')
      .build();

    it('should execute a simple sequential workflow', async () => {
      const model = new MockModel('Model', 'Sequential result');

      const agent = AgentBuilder.create()
        .withId('agent-1')
        .withRole(testRole)
        .withModel(model)
        .build();

      const step = StepBuilder.create()
        .withId('step-1')
        .withName('Sequential Step')
        .withAgents(['agent-1'])
        .withExecutionType('sequential')
        .build();

      const workflow = WorkflowConfigBuilder.create()
        .withId('workflow-1')
        .withName('Test Workflow')
        .addAgent(agent)
        .addStep(step)
        .build();

      const executor = new DefaultWorkflowExecutor();
      const result = await executor.execute(workflow, 'Test input');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Sequential result');
      expect(result.stepResults.size).toBe(1);
    });

    it('should execute parallel steps', async () => {
      const model1 = new MockModel('Model1', 'Result 1');
      const model2 = new MockModel('Model2', 'Result 2');

      const agents = [
        AgentBuilder.create().withId('agent-1').withRole(testRole).withModel(model1).build(),
        AgentBuilder.create().withId('agent-2').withRole(testRole).withModel(model2).build(),
      ];

      const step = StepBuilder.create()
        .withId('parallel-step')
        .withName('Parallel Step')
        .withAgents(['agent-1', 'agent-2'])
        .withExecutionType('parallel')
        .build();

      const workflow = WorkflowConfigBuilder.create()
        .withId('workflow-1')
        .withName('Parallel Workflow')
        .addAgents(agents)
        .addStep(step)
        .build();

      const executor = new DefaultWorkflowExecutor();
      const result = await executor.execute(workflow, 'Test input');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Result 1');
      expect(result.output).toContain('Result 2');
    });

    it('should execute multiple steps in order', async () => {
      const model = new MockModel('Model', 'Step result');

      const agents = [
        AgentBuilder.create().withId('agent-1').withRole(testRole).withModel(model).build(),
        AgentBuilder.create().withId('agent-2').withRole(testRole).withModel(model).build(),
      ];

      const steps = [
        StepBuilder.create()
          .withId('step-1')
          .withName('First Step')
          .withAgents(['agent-1'])
          .build(),
        StepBuilder.create()
          .withId('step-2')
          .withName('Second Step')
          .withAgents(['agent-2'])
          .build(),
      ];

      const workflow = WorkflowConfigBuilder.create()
        .withId('workflow-1')
        .withName('Multi-step Workflow')
        .addAgents(agents)
        .addSteps(steps)
        .build();

      const executor = new DefaultWorkflowExecutor();
      const result = await executor.execute(workflow, 'Test input');

      expect(result.success).toBe(true);
      expect(result.stepResults.size).toBe(2);
      expect(result.stepResults.has('step-1')).toBe(true);
      expect(result.stepResults.has('step-2')).toBe(true);
    });

    it('should support custom final result generator', async () => {
      const model = new MockModel('Model', 'Result');

      const agent = AgentBuilder.create()
        .withId('agent-1')
        .withRole(testRole)
        .withModel(model)
        .build();

      const step = StepBuilder.create()
        .withId('step-1')
        .withName('Step')
        .withAgents(['agent-1'])
        .build();

      const workflow = WorkflowConfigBuilder.create()
        .withId('workflow-1')
        .withName('Custom Output Workflow')
        .addAgent(agent)
        .addStep(step)
        .withFinalResultGenerator(async (_results) => {
          return 'Custom generated output';
        })
        .build();

      const executor = new DefaultWorkflowExecutor();
      const result = await executor.execute(workflow, 'Test input');

      expect(result.output).toBe('Custom generated output');
    });

    it('should call observer methods', async () => {
      const model = new MockModel('Model', 'Result');

      const agent = AgentBuilder.create()
        .withId('agent-1')
        .withRole(testRole)
        .withModel(model)
        .build();

      const step = StepBuilder.create()
        .withId('step-1')
        .withName('Observed Step')
        .withAgents(['agent-1'])
        .build();

      const workflow = WorkflowConfigBuilder.create()
        .withId('workflow-1')
        .withName('Observed Workflow')
        .addAgent(agent)
        .addStep(step)
        .build();

      const events: string[] = [];
      const observer = {
        onSocietyStart: jest.fn(() => events.push('society-start')),
        onSocietyComplete: jest.fn(() => events.push('society-complete')),
        onAgentStart: jest.fn(() => events.push('agent-start')),
        onAgentComplete: jest.fn(() => events.push('agent-complete')),
        onAgentError: jest.fn(),
        onPhaseStart: jest.fn(() => events.push('phase-start')),
        onPhaseComplete: jest.fn(() => events.push('phase-complete')),
      };

      const executor = new DefaultWorkflowExecutor(observer);
      await executor.execute(workflow, 'Test input');

      expect(observer.onSocietyStart).toHaveBeenCalled();
      expect(observer.onSocietyComplete).toHaveBeenCalled();
      expect(observer.onAgentStart).toHaveBeenCalled();
      expect(observer.onAgentComplete).toHaveBeenCalled();
      expect(observer.onPhaseStart).toHaveBeenCalled();
      expect(observer.onPhaseComplete).toHaveBeenCalled();
    });
  });
});
