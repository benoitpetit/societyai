/**
 * Advanced Graph Integration Tests
 * Tests for complex scenarios: conditionals, loops, cyclic graphs, collaborative sessions
 */

import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import { Agent, Role } from '../../core/types';
import { MockModel } from '../utils/mock-model';

describe('Advanced Graph Scenarios', () => {
  let mockModel: MockModel;
  let agent: Agent;

  beforeEach(() => {
    mockModel = new MockModel();
    agent = {
      id: 'agent1',
      name: 'Test Agent',
      role: {
        id: 'role1',
        name: 'Role',
        systemPrompt: 'You are a test agent',
      } as Role,
      model: mockModel,
      priority: 0,
    };
  });

  describe('Conditional Branching', () => {
    test('should route to true path when condition is met', async () => {
      const agentTrue = {
        ...agent,
        id: 'trueAgent',
        model: new MockModel().withDefaultResponse('True branch executed'),
      };
      const agentFalse = {
        ...agent,
        id: 'falseAgent',
        model: new MockModel().withDefaultResponse('False branch executed'),
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('check', NodeType.CONDITION, {
          condition: (_result, ctx) => ctx.input.includes('success'),
        })
        .addNode('trueNode', NodeType.AGENT, { agentId: 'trueAgent' })
        .addNode('falseNode', NodeType.AGENT, { agentId: 'falseAgent' })
        .addNode('end', NodeType.END)
        .addEdge('start', 'check')
        .addEdge('check', 'trueNode', { label: 'true' })
        .addEdge('check', 'falseNode', { label: 'false' })
        .addEdge('trueNode', 'end')
        .addEdge('falseNode', 'end')
        .build();

      const result = await graph.execute('success case', [agentTrue, agentFalse]);

      expect(result.success).toBe(true);
      expect(result.output).toBe('True branch executed');
      expect(result.executionPath).toContain('trueNode');
      expect(result.executionPath).not.toContain('falseNode');
    });

    test('should route to false path when condition is not met', async () => {
      const agentTrue = {
        ...agent,
        id: 'trueAgent',
        model: new MockModel().withDefaultResponse('True branch'),
      };
      const agentFalse = {
        ...agent,
        id: 'falseAgent',
        model: new MockModel().withDefaultResponse('False branch'),
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('check', NodeType.CONDITION, {
          condition: (_result, ctx) => ctx.input.includes('success'),
        })
        .addNode('trueNode', NodeType.AGENT, { agentId: 'trueAgent' })
        .addNode('falseNode', NodeType.AGENT, { agentId: 'falseAgent' })
        .addNode('end', NodeType.END)
        .addEdge('start', 'check')
        .addEdge('check', 'trueNode', { label: 'true' })
        .addEdge('check', 'falseNode', { label: 'false' })
        .addEdge('trueNode', 'end')
        .addEdge('falseNode', 'end')
        .build();

      const result = await graph.execute('failure case', [agentTrue, agentFalse]);

      expect(result.success).toBe(true);
      expect(result.output).toBe('False branch');
      expect(result.executionPath).toContain('falseNode');
      expect(result.executionPath).not.toContain('trueNode');
    });

    test('should handle nested conditionals', async () => {
      const agent1 = {
        ...agent,
        id: 'agent1',
        model: new MockModel().withDefaultResponse('Path A-1'),
      };
      const agent2 = {
        ...agent,
        id: 'agent2',
        model: new MockModel().withDefaultResponse('Path A-2'),
      };
      const agent3 = {
        ...agent,
        id: 'agent3',
        model: new MockModel().withDefaultResponse('Path B'),
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('firstCheck', NodeType.CONDITION, {
          condition: (_result, ctx) => ctx.input.includes('A'),
        })
        .addNode('secondCheck', NodeType.CONDITION, {
          condition: (_result, ctx) => ctx.input.includes('1'),
        })
        .addNode('pathA1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('pathA2', NodeType.AGENT, { agentId: 'agent2' })
        .addNode('pathB', NodeType.AGENT, { agentId: 'agent3' })
        .addNode('end', NodeType.END)

        .addEdge('start', 'firstCheck')
        .addEdge('firstCheck', 'secondCheck', { label: 'true' }) // A path leads to second check
        .addEdge('firstCheck', 'pathB', { label: 'false' }) // B path
        .addEdge('secondCheck', 'pathA1', { label: 'true' }) // A1 path
        .addEdge('secondCheck', 'pathA2', { label: 'false' }) // A2 path
        .addEdge('pathA1', 'end')
        .addEdge('pathA2', 'end')
        .addEdge('pathB', 'end')
        .build();

      // Test path A-1
      const resultA1 = await graph.execute('A1', [agent1, agent2, agent3]);
      expect(resultA1.output).toBe('Path A-1');
      expect(resultA1.executionPath).toContain('pathA1');

      // Test path A-2
      const resultA2 = await graph.execute('A2', [agent1, agent2, agent3]);
      expect(resultA2.output).toBe('Path A-2');
      expect(resultA2.executionPath).toContain('pathA2');

      // Test path B
      const resultB = await graph.execute('B', [agent1, agent2, agent3]);
      expect(resultB.output).toBe('Path B');
      expect(resultB.executionPath).toContain('pathB');
    });
  });

  describe('Cyclic Graphs and Loops', () => {
    test('should execute a cyclic validation loop with max iterations', async () => {
      let attemptCount = 0;
      const generator = {
        ...agent,
        id: 'generator',
        model: {
          name: () => 'generator',
          process: async () => {
            attemptCount++;
            return attemptCount < 3 ? 'BAD output' : 'VALID output';
          },
          supportsPromptType: () => true,
        },
      };

      const validator = {
        ...agent,
        id: 'validator',
        model: new MockModel().when('VALID').thenReturn('Valid').withDefaultResponse('Invalid'),
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('generate', NodeType.AGENT, { agentId: 'generator' })
        .addNode('validate', NodeType.AGENT, { agentId: 'validator' })
        .addNode('check', NodeType.CONDITION, {
          condition: (result) =>
            result.toLowerCase().includes('valid') && !result.toLowerCase().includes('invalid'),
        })
        .addNode('end', NodeType.END)

        .addEdge('start', 'generate')
        .addEdge('generate', 'validate')
        .addEdge('validate', 'check')
        .addEdge('check', 'end', { label: 'true' })
        .addEdge('check', 'generate', { label: 'false' }) // Loop back
        .build();

      const result = await graph.execute('Generate valid output', [generator, validator]);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(result.output).toContain('Valid');
      // Check that we looped
      expect(result.executionPath.filter((p) => p === 'generate').length).toBeGreaterThan(1);
    });

    test('should prevent infinite loops with context tracking', async () => {
      let iterations = 0;
      const loopAgent = {
        ...agent,
        id: 'looper',
        model: {
          name: () => 'looper',
          process: async () => {
            iterations++;
            return `Iteration ${iterations}`;
          },
          supportsPromptType: () => true,
        },
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('loop', NodeType.AGENT, { agentId: 'looper' })
        .addNode('check', NodeType.CONDITION, {
          condition: (_result, ctx) => {
            const count = (ctx.sharedData.get('loopCount') as number) || 0;
            ctx.sharedData.set('loopCount', count + 1);
            return count >= 5; // Stop after 5 iterations
          },
        })
        .addNode('end', NodeType.END)

        .addEdge('start', 'loop')
        .addEdge('loop', 'check')
        .addEdge('check', 'end', { label: 'true' })
        .addEdge('check', 'loop', { label: 'false' })
        .build();

      const result = await graph.execute('Start loop', [loopAgent]);

      expect(result.success).toBe(true);
      expect(iterations).toBe(6); // 1 initial + 5 loop iterations
      expect(result.executionPath.filter((p) => p === 'loop').length).toBe(6);
    });
  });

  describe('Transform and Aggregate Nodes', () => {
    test('should transform data between nodes', async () => {
      mockModel.withDefaultResponse('Hello World');

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('transform', NodeType.TRANSFORM, {
          transformer: (result) => result.toUpperCase(),
        })
        .addNode('end', NodeType.END)

        .addEdge('start', 'agent')
        .addEdge('agent', 'transform')
        .addEdge('transform', 'end')
        .build();

      const result = await graph.execute('input', [agent]);

      expect(result.success).toBe(true);
      expect(result.output).toBe('HELLO WORLD');
    });

    test('should aggregate results from multiple parallel agents', async () => {
      const agent1 = {
        ...agent,
        id: 'agent1',
        model: new MockModel().withDefaultResponse('Result 1'),
      };
      const agent2 = {
        ...agent,
        id: 'agent2',
        model: new MockModel().withDefaultResponse('Result 2'),
      };
      const agent3 = {
        ...agent,
        id: 'agent3',
        model: new MockModel().withDefaultResponse('Result 3'),
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('parallel', NodeType.PARALLEL, { agentIds: ['agent1', 'agent2', 'agent3'] })
        .addNode('aggregate', NodeType.AGGREGATE, {
          aggregator: (results) => {
            const contents = results.map((r) => r.output);
            return `Combined: ${contents.join(' | ')}`;
          },
        })
        .addNode('end', NodeType.END)

        .addEdge('start', 'parallel')
        .addEdge('parallel', 'aggregate')
        .addEdge('aggregate', 'end')
        .build();

      const result = await graph.execute('input', [agent1, agent2, agent3]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Combined:');
      expect(result.output).toContain('Result 1');
      expect(result.output).toContain('Result 2');
      expect(result.output).toContain('Result 3');
    });

    test('should chain multiple transformations', async () => {
      mockModel.withDefaultResponse('test');

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('uppercase', NodeType.TRANSFORM, {
          transformer: (result) => result.toUpperCase(),
        })
        .addNode('prefix', NodeType.TRANSFORM, {
          transformer: (result) => `[PROCESSED] ${result}`,
        })
        .addNode('suffix', NodeType.TRANSFORM, {
          transformer: (result) => `${result} [DONE]`,
        })
        .addNode('end', NodeType.END)

        .addEdge('start', 'agent')
        .addEdge('agent', 'uppercase')
        .addEdge('uppercase', 'prefix')
        .addEdge('prefix', 'suffix')
        .addEdge('suffix', 'end')
        .build();

      const result = await graph.execute('input', [agent]);

      expect(result.output).toBe('[PROCESSED] TEST [DONE]');
    });
  });

  describe('Complex Workflows', () => {
    test('should execute a complete self-correction pattern', async () => {
      let generationAttempt = 0;

      const generator = {
        ...agent,
        id: 'writer',
        model: {
          name: () => 'writer',
          process: async (prompt: unknown) => {
            generationAttempt++;
            const promptStr = String(prompt);

            // First attempt: intentionally bad
            if (generationAttempt === 1) {
              return 'This is a bad response without proper structure';
            }

            // If feedback is present, improve
            if (promptStr.includes('FEEDBACK')) {
              return 'This is a well-structured response that meets all requirements';
            }

            return 'Generic response';
          },
          supportsPromptType: () => true,
        },
      };

      const critic = {
        ...agent,
        id: 'critic',
        model: {
          name: () => 'critic',
          process: async (prompt: unknown) => {
            const content = String(prompt);
            if (content.includes('well-structured') && content.includes('requirements')) {
              return 'APPROVED: Response is good';
            }
            return 'FEEDBACK: Response lacks proper structure and does not meet requirements';
          },
          supportsPromptType: () => true,
        },
      };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('generate', NodeType.AGENT, { agentId: 'writer' })
        .addNode('review', NodeType.AGENT, { agentId: 'critic' })
        .addNode('checkApproval', NodeType.CONDITION, {
          condition: (result) => result.includes('APPROVED'),
        })
        .addNode('storeFeedback', NodeType.TRANSFORM, {
          transformer: (result, ctx) => {
            ctx.sharedData.set('feedback', result);
            return result;
          },
        })
        .addNode('end', NodeType.END)

        .addEdge('start', 'generate')
        .addEdge('generate', 'review')
        .addEdge('review', 'checkApproval')
        .addEdge('checkApproval', 'end', { label: 'true' })
        .addEdge('checkApproval', 'storeFeedback', { label: 'false' })
        .addEdge('storeFeedback', 'generate') // Loop back with feedback
        .build();

      const result = await graph.execute('Write a good response', [generator, critic]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('APPROVED');
      expect(generationAttempt).toBe(2);
      expect(result.executionPath.filter((p) => p === 'generate').length).toBe(2);
    });
  });
});
