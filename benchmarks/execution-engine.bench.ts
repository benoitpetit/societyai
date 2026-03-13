import { bench, describe } from 'vitest';
import { ExecutionEngine, GraphBuilder, NodeType } from '../src/execution/engine/execution-engine';
import { MockModel } from '../src/__tests__/utils/mock-model';
import { Agent } from '../src/core/types';

// Helper to create mock agents
function createMockAgent(id: string): Agent {
  return {
    id,
    name: `Agent ${id}`,
    role: { systemPrompt: 'Test' },
    model: new MockModel(),
    executionMode: 'inline',
  };
}

describe('ExecutionEngine - Sequential Execution', () => {
  bench('2 agents sequential', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('agent1', NodeType.AGENT, { agentId: 'a1' })
      .addNode('agent2', NodeType.AGENT, { agentId: 'a2' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'agent1')
      .addEdge('agent1', 'agent2')
      .addEdge('agent2', 'end')
      .build();

    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: [createMockAgent('a1'), createMockAgent('a2')],
    });
  });

  bench('5 agents sequential', async () => {
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('end', NodeType.END);

    for (let i = 1; i <= 5; i++) {
      builder.addNode(`agent${i}`, NodeType.AGENT, { agentId: `a${i}` });
    }

    builder.addEdge('start', 'agent1');
    for (let i = 1; i < 5; i++) {
      builder.addEdge(`agent${i}`, `agent${i + 1}`);
    }
    builder.addEdge('agent5', 'end');

    const graph = builder.build();
    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: Array.from({ length: 5 }, (_, i) => createMockAgent(`a${i + 1}`)),
    });
  });

  bench('10 agents sequential', async () => {
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('end', NodeType.END);

    for (let i = 1; i <= 10; i++) {
      builder.addNode(`agent${i}`, NodeType.AGENT, { agentId: `a${i}` });
    }

    builder.addEdge('start', 'agent1');
    for (let i = 1; i < 10; i++) {
      builder.addEdge(`agent${i}`, `agent${i + 1}`);
    }
    builder.addEdge('agent10', 'end');

    const graph = builder.build();
    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: Array.from({ length: 10 }, (_, i) => createMockAgent(`a${i + 1}`)),
    });
  });
});

describe('ExecutionEngine - Parallel Execution', () => {
  bench('5 agents parallel', async () => {
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('parallel', NodeType.PARALLEL, { agentIds: ['a1', 'a2', 'a3', 'a4', 'a5'] })
      .addNode('end', NodeType.END);

    builder.addEdge('start', 'parallel').addEdge('parallel', 'end');

    const graph = builder.build();
    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: Array.from({ length: 5 }, (_, i) => createMockAgent(`a${i + 1}`)),
    });
  });

  bench('10 agents parallel', async () => {
    const agentIds = Array.from({ length: 10 }, (_, i) => `a${i + 1}`);
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('parallel', NodeType.PARALLEL, { agentIds })
      .addNode('end', NodeType.END);

    builder.addEdge('start', 'parallel').addEdge('parallel', 'end');

    const graph = builder.build();
    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: agentIds.map((id) => createMockAgent(id)),
    });
  });

  bench('20 agents parallel', async () => {
    const agentIds = Array.from({ length: 20 }, (_, i) => `a${i + 1}`);
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('parallel', NodeType.PARALLEL, { agentIds })
      .addNode('end', NodeType.END);

    builder.addEdge('start', 'parallel').addEdge('parallel', 'end');

    const graph = builder.build();
    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: agentIds.map((id) => createMockAgent(id)),
    });
  });
});

describe('ExecutionEngine - Complex Workflows', () => {
  bench('diamond pattern (conditional)', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('condition', NodeType.CONDITION, {
        condition: (input) => input.length > 5,
      })
      .addNode('branchA', NodeType.AGENT, { agentId: 'agentA' })
      .addNode('branchB', NodeType.AGENT, { agentId: 'agentB' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'condition')
      .addEdge('condition', 'branchA', { label: 'true' })
      .addEdge('condition', 'branchB', { label: 'false' })
      .addEdge('branchA', 'end')
      .addEdge('branchB', 'end')
      .build();

    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test input',
      agents: [createMockAgent('agentA'), createMockAgent('agentB')],
    });
  });

  bench('fan-out fan-in pattern', async () => {
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('split', NodeType.PARALLEL, { agentIds: ['a1', 'a2', 'a3', 'a4'] })
      .addNode('aggregate', NodeType.AGGREGATE)
      .addNode('end', NodeType.END);

    builder.addEdge('start', 'split').addEdge('split', 'aggregate').addEdge('aggregate', 'end');

    const graph = builder.build();
    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: Array.from({ length: 4 }, (_, i) => createMockAgent(`a${i + 1}`)),
    });
  });

  bench('loop pattern (5 iterations)', async () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('loop', NodeType.LOOP, {
        maxIterations: 5,
        condition: () => true,
      })
      .addNode('agent', NodeType.AGENT, { agentId: 'loopAgent' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'loop')
      .addEdge('loop', 'agent')
      .addEdge('agent', 'loop')
      .addEdge('loop', 'end')
      .build();

    const engine = new ExecutionEngine(graph.nodes, graph.edges);
    await engine.execute({
      input: 'test',
      agents: [createMockAgent('loopAgent')],
    });
  });
});

describe('Memory System', () => {
  bench('short-term memory operations', async () => {
    const { MemorySystem } = await import('../src/capabilities/memory');
    const memory = new MemorySystem();

    for (let i = 0; i < 100; i++) {
      await memory.addToShortTerm(`key${i}`, `value${i}`);
    }

    for (let i = 0; i < 100; i++) {
      await memory.getFromShortTerm(`key${i}`);
    }
  });

  bench('long-term memory with embeddings', async () => {
    const { MemorySystem } = await import('../src/capabilities/memory');
    const memory = new MemorySystem();

    for (let i = 0; i < 50; i++) {
      await memory.addToLongTerm(`Document ${i}: This is a test document for benchmarking.`);
    }

    await memory.searchLongTerm('test document', { limit: 10 });
  });
});

describe('Middleware Chain', () => {
  bench('empty chain', async () => {
    const { MiddlewareChain } = await import('../src/core/middleware');
    const chain = MiddlewareChain.create().build();
    await chain.execute('test input');
  });

  bench('chain with 5 middlewares', async () => {
    const { MiddlewareChain, Middlewares } = await import('../src/core/middleware');
    const chain = MiddlewareChain.create()
      .use(Middlewares.logging({ logInput: false, logOutput: false }))
      .use(Middlewares.timing())
      .use(Middlewares.transformInput((input) => String(input).toUpperCase()))
      .use(Middlewares.transformOutput((output) => output.toLowerCase()))
      .use(Middlewares.validation({ validateInput: () => true }))
      .forModel(new MockModel())
      .build();

    await chain.execute('test input');
  });

  bench('chain with caching', async () => {
    const { MiddlewareChain, Middlewares } = await import('../src/core/middleware');
    const chain = MiddlewareChain.create()
      .use(Middlewares.cache({ ttl: 60000 }))
      .forModel(new MockModel())
      .build();

    // First call (cache miss)
    await chain.execute('test input');
    // Second call (cache hit)
    await chain.execute('test input');
  });
});
