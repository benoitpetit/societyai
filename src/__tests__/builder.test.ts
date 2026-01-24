/**
 * Tests for the new fluent Society Builder API (v2.0)
 */

import { Society, Strategies, StandardModelBase, createRole, createAgent } from '..';

// Mock model for testing
class MockModel extends StandardModelBase {
  constructor(name = 'MockModel', responseText = 'Mock response') {
    super(
      { name },
      async (prompt: unknown) => {
        return `${responseText}: ${prompt}`;
      }
    );
  }
}

describe('Society Builder API (v2.0)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Society.create() basic functionality', () => {
    it('should create a society with scatter-gather pattern', async () => {
      const model = new MockModel('TestModel', 'Test response');

      const result = await Society.create()
        .withName('Test Society')
        .addAgent(a => a
          .withId('agent-1')
          .withRole(r => r
            .withId('role-1')
            .withSystemPrompt('You are agent 1'))
          .withModel(model))
        .addAgent(a => a
          .withId('agent-2')
          .withRole(r => r
            .withId('role-2')
            .withSystemPrompt('You are agent 2'))
          .withModel(model))
        .scatterGather(Strategies.concat('\\n').aggregate)
        .execute('test prompt');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test response');
    });

    it('should create a society with chain pattern', async () => {
      const model = new MockModel('TestModel', 'Step');

      const result = await Society.create()
        .withName('Chain Society')
        .addAgent(a => a
          .withId('agent-1')
          .withRole(r => r.withSystemPrompt('First agent'))
          .withModel(model))
        .addAgent(a => a
          .withId('agent-2')
          .withRole(r => r.withSystemPrompt('Second agent'))
          .withModel(model))
        .usePipeline(p => p.chain(['agent-1', 'agent-2']))
        .execute('test input');

      expect(result.success).toBe(true);
      expect(result.stepResults.size).toBeGreaterThan(0);
    });

    it.skip('should handle errors gracefully', async () => {
      const errorModel = new StandardModelBase(
        { name: 'ErrorModel' },
        async () => {
          throw new Error('Simulated error');
        }
      );

      await expect(
        Society.create()
          .addAgent(a => a
            .withId('failing-agent')
            .withRole(r => r.withSystemPrompt('Will fail'))
            .withModel(errorModel))
          .usePipeline(p => p.chain(['failing-agent']))
          .execute('test')
      ).rejects.toThrow();
    });
  });

  describe('Helper functions', () => {
    it('createRole should create a valid role', () => {
      const role = createRole('analyst', 'You are an analyst', {
        capabilities: ['analysis', 'reporting'],
        constraints: ['Be objective'],
      });

      expect(role.id).toBe('analyst');
      expect(role.systemPrompt).toBe('You are an analyst');
      expect(role.capabilities).toEqual(['analysis', 'reporting']);
      expect(role.constraints).toEqual(['Be objective']);
    });

    it('createAgent should create a valid agent config', () => {
      const model = new MockModel();
      const role = createRole('test-role', 'Test system prompt');
      
      const agent = createAgent('test-agent', role, model, {
        priority: 5,
      });

      expect(agent.id).toBe('test-agent');
      expect(agent.role.id).toBe('test-role');
      expect(agent.priority).toBe(5);
    });
  });

  describe('Aggregation strategies', () => {
    it('should use concat strategy', async () => {
      const model = new MockModel('Model', 'Result');

      const result = await Society.create()
        .addAgent(a => a
          .withId('a1')
          .withRole(r => r.withSystemPrompt('Agent 1'))
          .withModel(model))
        .addAgent(a => a
          .withId('a2')
          .withRole(r => r.withSystemPrompt('Agent 2'))
          .withModel(model))
        .scatterGather(Strategies.concat(' | ').aggregate)
        .execute('test');

      expect(result.output).toContain('Result');
      // Both agents contribute so there should be content
      expect(result.output.length).toBeGreaterThan(10);
    });

    it('should use first strategy', async () => {
      const model = new MockModel('Model', 'Response');

      const result = await Society.create()
        .addAgent(a => a
          .withId('a1')
          .withRole(r => r.withSystemPrompt('First'))
          .withModel(model))
        .addAgent(a => a
          .withId('a2')
          .withRole(r => r.withSystemPrompt('Second'))
          .withModel(model))
        .scatterGather(Strategies.first().aggregate)
        .execute('test');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Response');
    });

    it('should use longest strategy', async () => {
      const shortModel = new MockModel('Short', 'Short');
      const longModel = new MockModel('Long', 'This is a much longer response');

      const result = await Society.create()
        .addAgent(a => a
          .withId('short')
          .withRole(r => r.withSystemPrompt('Short'))
          .withModel(shortModel))
        .addAgent(a => a
          .withId('long')
          .withRole(r => r.withSystemPrompt('Long'))
          .withModel(longModel))
        .scatterGather(Strategies.longest().aggregate)
        .execute('test');

      expect(result.output).toContain('much longer');
    });
  });

  describe('Pipeline patterns', () => {
    it('should execute custom pipeline', async () => {
      const model = new MockModel('Model', 'Output');

      const result = await Society.create()
        .addAgent(a => a
          .withId('agent-1')
          .withRole(r => r.withSystemPrompt('Process'))
          .withModel(model))
        .addAgent(a => a
          .withId('agent-2')
          .withRole(r => r.withSystemPrompt('Review'))
          .withModel(model))
        .usePipeline(p => p
          .chain(['agent-1', 'agent-2']))
        .execute('input');

      expect(result.success).toBe(true);
      expect(result.stepResults.size).toBeGreaterThan(0);
    });

    it('should handle multiple agents in scatter', async () => {
      const model = new MockModel('Model', 'Analysis');

      const result = await Society.create()
        .addAgent(a => a.withId('a1').withRole(r => r.withSystemPrompt('A1')).withModel(model))
        .addAgent(a => a.withId('a2').withRole(r => r.withSystemPrompt('A2')).withModel(model))
        .addAgent(a => a.withId('a3').withRole(r => r.withSystemPrompt('A3')).withModel(model))
        .scatterGather(Strategies.concat('\n').aggregate)
        .execute('test');

      expect(result.success).toBe(true);
    });
  });

  describe('FluentAgentBuilder', () => {
    it('should build agent with all options', async () => {
      const model = new MockModel();

      const result = await Society.create()
        .addAgent(a => a
          .withId('full-agent')
          .withName('Full Agent')
          .withRole(r => r
            .withId('role-1')
            .withName('Test Role')
            .withSystemPrompt('System prompt')
            .withCapabilities(['cap1', 'cap2'])
            .withConstraints(['constraint1']))
          .withModel(model)
          .withPriority(10))
        .usePipeline(p => p.chain(['full-agent']))
        .execute('test');

      expect(result.success).toBe(true);
    });

    it('should handle role passed as function', async () => {
      const model = new MockModel();

      const result = await Society.create()
        .addAgent(a => a
          .withId('agent')
          .withRole(r => r
            .withSystemPrompt('Prompt')
            .addCapability('analysis'))
          .withModel(model))
        .usePipeline(p => p.chain(['agent']))
        .execute('test');

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it.skip('should throw error for invalid configuration', async () => {
      // Test avec aucun agent - devrait échouer
      await expect(
        Society.create()
          .usePipeline(p => p.chain(['agent-1']))
          .execute('test')
      ).rejects.toThrow();
    });

    it.skip('should handle abort signal', async () => {
      const model = new StandardModelBase(
        { name: 'SlowModel' },
        async (_prompt, signal) => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve('Too late'), 5000);
            if (signal) {
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Operation was aborted'));
              });
            }
          });
        }
      );

      const controller = new AbortController();
      
      const executionPromise = Society.create()
        .addAgent(a => a
          .withId('slow')
          .withRole(r => r.withSystemPrompt('Slow'))
          .withModel(model))
        .usePipeline(p => p.chain(['slow']))
        .execute('test', controller.signal);

      setTimeout(() => controller.abort(), 100);

      await expect(executionPromise).rejects.toThrow();
    }, 10000);
  });

  describe('Context and metadata', () => {
    it('should preserve metadata through pipeline', async () => {
      const model = new MockModel('Model', 'Result');

      const result = await Society.create()
        .withName('Test Society')
        .addAgent(a => a
          .withId('agent')
          .withRole(r => r.withSystemPrompt('Test'))
          .withModel(model))
        .usePipeline(p => p.chain(['agent']))
        .execute('input');

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.success).toBe(true);
    });
  });
});
