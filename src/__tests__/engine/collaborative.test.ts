/**
 * Collaborative Node Tests
 * Tests for advanced collaborative scenarios with message routing
 */

import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import { Agent, Role } from '../../core/types';
import { MockModel } from '../utils/mock-model';

describe('Collaborative Mode', () => {
  let agent1: Agent;
  let agent2: Agent;
  let agent3: Agent;

  beforeEach(() => {
    const baseAgent = {
      name: 'Agent',
      role: {
        id: 'collab',
        name: 'Collaborator',
        systemPrompt: 'You collaborate with others',
      } as Role,
      priority: 0,
    };

    agent1 = {
      ...baseAgent,
      id: 'alice',
      model: new MockModel().withDefaultResponse('Alice says hello'),
    };

    agent2 = {
      ...baseAgent,
      id: 'bob',
      model: new MockModel().withDefaultResponse('Bob responds'),
    };

    agent3 = {
      ...baseAgent,
      id: 'charlie',
      model: new MockModel().withDefaultResponse('Charlie agrees'),
    };
  });

  describe('Basic Collaboration', () => {
    test('should execute collaborative session with broadcast', async () => {
      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('collab', NodeType.COLLABORATIVE, {
          agentIds: ['alice', 'bob', 'charlie'],
          maxIterations: 2,
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'collab')
        .addEdge('collab', 'end')
        .build();

      const result = await graph.execute('Discuss the topic', [agent1, agent2, agent3]);

      expect(result.success).toBe(true);
      expect(result.messages).toBeDefined();
      expect(result.messages!.length).toBeGreaterThanOrEqual(6); // 3 agents × 2 iterations

      // Check that all agents participated
      const aliceMessages = result.messages!.filter((m) => m.from === 'alice');
      const bobMessages = result.messages!.filter((m) => m.from === 'bob');
      const charlieMessages = result.messages!.filter((m) => m.from === 'charlie');

      expect(aliceMessages.length).toBeGreaterThan(0);
      expect(bobMessages.length).toBeGreaterThan(0);
      expect(charlieMessages.length).toBeGreaterThan(0);
    });

    test('should stop when completion condition is met', async () => {
      // Mock agent that says "CONSENSUS" on second iteration
      let aliceIteration = 0;
      const aliceModel = {
        name: () => 'alice-model',
        process: async () => {
          aliceIteration++;
          return aliceIteration >= 2 ? 'CONSENSUS reached!' : 'Still discussing...';
        },
        supportsPromptType: () => true,
      };

      agent1.model = aliceModel as any;

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('collab', NodeType.COLLABORATIVE, {
          agentIds: ['alice', 'bob'],
          maxIterations: 10,
          completionCondition: (results) => {
            return results.some((r) => r.output.includes('CONSENSUS'));
          },
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'collab')
        .addEdge('collab', 'end')
        .build();

      const result = await graph.execute('Find consensus', [agent1, agent2]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('CONSENSUS');
      // Should stop early, not reach 10 iterations
      expect(result.messages!.length).toBeLessThan(20); // 10 iterations × 2 agents = 20
    });
  });

  describe('Targeted Message Routing', () => {
    test('should parse and route targeted messages with @mentions', async () => {
      const aliceModel = {
        name: () => 'alice',
        process: async () => '@bob: Hey Bob, what do you think?',
        supportsPromptType: () => true,
      };

      const bobModel = {
        name: () => 'bob',
        process: async (prompt: unknown) => {
          const promptStr = String(prompt);
          if (promptStr.includes('what do you think')) {
            return "@alice: I think it's great!";
          }
          return 'Just observing...';
        },
        supportsPromptType: () => true,
      };

      agent1.model = aliceModel as any;
      agent2.model = bobModel as any;

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('collab', NodeType.COLLABORATIVE, {
          agentIds: ['alice', 'bob'],
          maxIterations: 2,
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'collab')
        .addEdge('collab', 'end')
        .build();

      const result = await graph.execute('Start discussion', [agent1, agent2]);

      expect(result.success).toBe(true);

      // Check that targeted messages were parsed
      const aliceMessage = result.messages!.find((m) => m.from === 'alice');
      expect(aliceMessage?.to).toBe('bob');
      expect(aliceMessage?.content).not.toContain('@bob:'); // Should be stripped

      const bobMessage = result.messages!.find(
        (m) => m.from === 'bob' && m.content.includes('great')
      );
      expect(bobMessage?.to).toBe('alice');
    });

    test('should use custom message router for hierarchical communication', async () => {
      // Junior → Senior → Manager flow
      const juniorModel = {
        name: () => 'junior',
        process: async () => 'I have a question about the architecture',
        supportsPromptType: () => true,
      };

      const seniorModel = {
        name: () => 'senior',
        process: async (prompt: unknown) => {
          const p = String(prompt);
          if (p.includes('question about')) {
            return 'Let me escalate this to the manager';
          }
          return 'Reviewing...';
        },
        supportsPromptType: () => true,
      };

      const managerModel = {
        name: () => 'manager',
        process: async () => 'Approved. Proceed with the plan.',
        supportsPromptType: () => true,
      };

      const junior = { ...agent1, id: 'junior', model: juniorModel as any };
      const senior = { ...agent2, id: 'senior', model: seniorModel as any };
      const manager = { ...agent3, id: 'manager', model: managerModel as any };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('hierarchy', NodeType.COLLABORATIVE, {
          agentIds: ['junior', 'senior', 'manager'],
          maxIterations: 3,
          messageRouter: (_message, sender, _allAgents) => {
            // Hierarchical routing
            if (sender.id === 'junior') return ['senior'];
            if (sender.id === 'senior') return ['manager'];
            if (sender.id === 'manager') return ['junior', 'senior']; // Broadcast down
            return [];
          },
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'hierarchy')
        .addEdge('hierarchy', 'end')
        .build();

      const result = await graph.execute('Review architecture', [junior, senior, manager]);

      expect(result.success).toBe(true);

      // Verify routing metadata
      const messages = result.messages!;
      const juniorMsg = messages.find((m) => m.from === 'junior');
      expect(juniorMsg?.metadata?.recipients).toEqual(['senior']);

      const seniorMsg = messages.find((m) => m.from === 'senior');
      expect(seniorMsg?.metadata?.recipients).toEqual(['manager']);

      const managerMsg = messages.find((m) => m.from === 'manager');
      expect(managerMsg?.metadata?.recipients).toContain('junior');
      expect(managerMsg?.metadata?.recipients).toContain('senior');
    });

    test('should filter message history per agent', async () => {
      const bobPrompts: string[] = [];
      const charliePrompts: string[] = [];

      const aliceModel = {
        name: () => 'alice',
        process: async () => '@bob: Private message for Bob only',
        supportsPromptType: () => true,
      };

      const bobModel = {
        name: () => 'bob',
        process: async (prompt: unknown) => {
          bobPrompts.push(String(prompt));
          return 'Bob received the message';
        },
        supportsPromptType: () => true,
      };

      const charlieModel = {
        name: () => 'charlie',
        process: async (prompt: unknown) => {
          charliePrompts.push(String(prompt));
          return 'Charlie is working';
        },
        supportsPromptType: () => true,
      };

      agent1.model = aliceModel as any;
      agent2.model = bobModel as any;
      agent3.model = charlieModel as any;

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('collab', NodeType.COLLABORATIVE, {
          agentIds: ['alice', 'bob', 'charlie'],
          maxIterations: 2,
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'collab')
        .addEdge('collab', 'end')
        .build();

      await graph.execute('Start', [agent1, agent2, agent3]);

      // Bob should see Alice's message in his prompt
      const bobPromptContent = bobPrompts.join('\n');
      expect(bobPromptContent).toContain('Private message for Bob');

      // Charlie should NOT see Alice's targeted message
      const charliePromptContent = charliePrompts.join('\n');
      expect(charliePromptContent).not.toContain('Private message for Bob');
    });
  });

  describe('Complex Collaborative Patterns', () => {
    test('should support debate pattern with moderator', async () => {
      let proArguments = 0;
      let conArguments = 0;

      const proModel = {
        name: () => 'pro',
        process: async () => {
          proArguments++;
          return proArguments === 1
            ? 'AI will improve productivity'
            : 'AI creates new job opportunities';
        },
        supportsPromptType: () => true,
      };

      const conModel = {
        name: () => 'con',
        process: async () => {
          conArguments++;
          return conArguments === 1
            ? 'AI will cause job displacement'
            : 'AI raises ethical concerns';
        },
        supportsPromptType: () => true,
      };

      const moderatorModel = {
        name: () => 'moderator',
        process: async (_prompt: unknown, _signal?: AbortSignal) => {
          if (proArguments >= 2 && conArguments >= 2) {
            return "CONSENSUS: Both perspectives have merit. Let's proceed with balanced implementation.";
          }
          return 'Continue the debate...';
        },
        supportsPromptType: () => true,
      };

      const pro = { ...agent1, id: 'pro', model: proModel as any };
      const con = { ...agent2, id: 'con', model: conModel as any };
      const moderator = { ...agent3, id: 'moderator', model: moderatorModel as any };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('debate', NodeType.COLLABORATIVE, {
          agentIds: ['pro', 'con', 'moderator'],
          maxIterations: 5,
          completionCondition: (results) => {
            return results.some((r) => r.output.includes('CONSENSUS'));
          },
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'debate')
        .addEdge('debate', 'end')
        .build();

      const result = await graph.execute('Debate: Impact of AI on employment', [
        pro,
        con,
        moderator,
      ]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('CONSENSUS');
      expect(proArguments).toBeGreaterThanOrEqual(2);
      expect(conArguments).toBeGreaterThanOrEqual(2);
    });

    test('should support expert consultation pattern', async () => {
      const requesterModel = {
        name: () => 'requester',
        process: async (prompt: unknown) => {
          const p = String(prompt);
          // On first iteration, ask question
          if (!p.includes('input validation') && !p.includes('caching')) {
            // Broadcast with mentions instead of targeting single agent
            return 'Questions: @security: Is this implementation secure? @performance: Will this scale?';
          }
          // After receiving responses
          return 'Thank you for the feedback. Proceeding with implementation.';
        },
        supportsPromptType: () => true,
      };

      const securityModel = {
        name: () => 'security',
        process: async (prompt: unknown) => {
          if (String(prompt).includes('Is this implementation secure')) {
            return '@requester: Yes, but add input validation';
          }
          return 'Monitoring...';
        },
        supportsPromptType: () => true,
      };

      const performanceModel = {
        name: () => 'performance',
        process: async (prompt: unknown) => {
          if (String(prompt).includes('Will this scale')) {
            return '@requester: Consider adding caching';
          }
          return 'Monitoring...';
        },
        supportsPromptType: () => true,
      };

      const requester = { ...agent1, id: 'requester', model: requesterModel as any };
      const security = { ...agent2, id: 'security', model: securityModel as any };
      const performance = { ...agent3, id: 'performance', model: performanceModel as any };

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('consultation', NodeType.COLLABORATIVE, {
          agentIds: ['requester', 'security', 'performance'],
          maxIterations: 3,
          completionCondition: (results) => {
            return results.some((r) => r.output.includes('Proceeding with implementation'));
          },
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'consultation')
        .addEdge('consultation', 'end')
        .build();

      const result = await graph.execute('Review implementation plan', [
        requester,
        security,
        performance,
      ]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('implementation');

      // Verify targeted messages were exchanged
      const messages = result.messages!;
      const securityResponse = messages.find((m) => m.from === 'security' && m.to === 'requester');
      const performanceResponse = messages.find(
        (m) => m.from === 'performance' && m.to === 'requester'
      );

      expect(securityResponse).toBeDefined();
      expect(performanceResponse).toBeDefined();
    });
  });
});
