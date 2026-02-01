/**
 * Tests for SocietyGraph
 */

import {
  GraphBuilder,
  NodeType,
  SocietyGraph,
  AgentBuilder,
  RoleBuilder,
  StandardModelBase,
  AgentConfig,
} from '..';

describe('SocietyGraph', () => {
  // Mock model
  class MockModel extends StandardModelBase {
    constructor(private response: string = 'test response') {
      super({ name: 'mock' }, async () => this.response);
    }
  }

  // Helper to create test agent
  function createTestAgent(id: string, response: string = 'test'): AgentConfig {
    const role = RoleBuilder.create()
      .withId(id)
      .withName(id)
      .withSystemPrompt('test')
      .build();

    return AgentBuilder.create()
      .withId(id)
      .withRole(role)
      .withModel(new MockModel(response))
      .build();
  }

  describe('Graph Construction', () => {
    it('should create a valid simple graph', () => {
      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('end', NodeType.END)
        .addEdge('start', 'agent1')
        .addEdge('agent1', 'end')
        .build();

      expect(graph).toBeInstanceOf(SocietyGraph);
    });

    it('should throw error if START node is missing', () => {
      expect(() => {
        GraphBuilder.create()
          .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
          .addNode('end', NodeType.END)
          .build();
      }).toThrow('must have at least one START node');
    });

    it('should throw error if END node is missing', () => {
      expect(() => {
        GraphBuilder.create()
          .addNode('start', NodeType.START)
          .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
          .build();
      }).toThrow('must have at least one END node');
    });

    it('should throw error for invalid edge', () => {
      expect(() => {
        GraphBuilder.create()
          .addNode('start', NodeType.START)
          .addNode('end', NodeType.END)
          .addEdge('start', 'nonexistent')
          .build();
      }).toThrow('Target node not found');
    });

    it('should validate AGENT node requires agentId', () => {
      expect(() => {
        GraphBuilder.create()
          .addNode('start', NodeType.START)
          .addNode('agent1', NodeType.AGENT) // Missing agentId
          .addNode('end', NodeType.END)
          .build();
      }).toThrow('must have agentId');
    });
  });

  describe('Graph Execution', () => {
    it('should execute simple linear graph', async () => {
      const agent = createTestAgent('agent1', 'hello world');
      
      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('end', NodeType.END)
        .addEdge('start', 'agent1')
        .addEdge('agent1', 'end')
        .build();

      const result = await graph.execute('test input', [agent]);

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello world');
      expect(result.executionPath).toContain('start');
      expect(result.executionPath).toContain('agent1');
    });

    it('should execute parallel nodes', async () => {
      const agents = [
        createTestAgent('agent1', 'response1'),
        createTestAgent('agent2', 'response2'),
      ];

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('parallel', NodeType.PARALLEL, { agentIds: ['agent1', 'agent2'] })
        .addNode('end', NodeType.END)
        .addEdge('start', 'parallel')
        .addEdge('parallel', 'end')
        .build();

      const result = await graph.execute('test', agents);

      expect(result.success).toBe(true);
      expect(result.output).toContain('response1');
      expect(result.output).toContain('response2');
    });

    it('should execute conditional branching', async () => {
      const agent = createTestAgent('agent1', 'valid result');

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('condition', NodeType.CONDITION, {
          condition: (result) => result.includes('valid'),
        })
        .addNode('success', NodeType.TRANSFORM, {
          transformer: () => 'Success path',
        })
        .addNode('failure', NodeType.TRANSFORM, {
          transformer: () => 'Failure path',
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'agent1')
        .addEdge('agent1', 'condition')
        .addConditionalEdge({
          from: 'condition',
          condition: (result) => result.includes('valid'),
          truePath: 'success',
          falsePath: 'failure',
        })
        .addEdge('success', 'end')
        .addEdge('failure', 'end')
        .build();

      const result = await graph.execute('test', [agent]);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Success path');
    });

    it('should execute transform nodes', async () => {
      const agent = createTestAgent('agent1', 'hello');

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('transform', NodeType.TRANSFORM, {
          transformer: (result: string) => result.toUpperCase(),
        })
        .addNode('end', NodeType.END)
        .addEdge('start', 'agent1')
        .addEdge('agent1', 'transform')
        .addEdge('transform', 'end')
        .build();

      const result = await graph.execute('test', [agent]);

      expect(result.success).toBe(true);
      expect(result.output).toBe('HELLO');
    });
  });

  describe('Graph Visualization', () => {
    it('should generate visualization string', () => {
      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('end', NodeType.END)
        .addEdge('start', 'agent1')
        .addEdge('agent1', 'end')
        .build();

      const viz = graph.visualize();

      expect(viz).toContain('Graph Structure');
      expect(viz).toContain('start');
      expect(viz).toContain('agent1');
      expect(viz).toContain('end');
    });
  });

  describe('Error Handling', () => {
    it('should handle agent errors gracefully', async () => {
      class ErrorModel extends StandardModelBase {
        constructor() {
          super({ name: 'error' }, async () => {
            throw new Error('Agent failed');
          });
        }
      }

      const role = RoleBuilder.create()
        .withId('agent1')
        .withName('agent1')
        .withSystemPrompt('test')
        .build();

      const agent = AgentBuilder.create()
        .withId('agent1')
        .withRole(role)
        .withModel(new ErrorModel())
        .build();

      const graph = GraphBuilder.create()
        .addNode('start', NodeType.START)
        .addNode('agent1', NodeType.AGENT, { agentId: 'agent1' })
        .addNode('end', NodeType.END)
        .addEdge('start', 'agent1')
        .addEdge('agent1', 'end')
        .build();

      const result = await graph.execute('test', [agent]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});
