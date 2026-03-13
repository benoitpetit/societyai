// src/__tests__/execution/graph-visualizer.test.ts

import { GraphVisualizer } from '../../execution/graph-visualizer';
import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';

describe('GraphVisualizer', () => {
  test('should generate mermaid diagram for simple graph', () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('agent', NodeType.AGENT, { agentId: 'agent1' })
      .addNode('end', NodeType.END)
      .addEdge('start', 'agent')
      .addEdge('agent', 'end')
      .build();

    const mermaid = GraphVisualizer.toMermaid(graph);

    expect(mermaid).toContain('graph TD');
    // Visualizer prefixes IDs with n_ and uses generic syntax
    expect(mermaid).toContain('n_start("start\\nStart")');
    expect(mermaid).toContain('n_agent["agent\\nAgent: agent1"]');
    expect(mermaid).toContain('n_end("end\\nEnd")');
    expect(mermaid).toContain('n_start --> n_agent');
    expect(mermaid).toContain('n_agent --> n_end');
  });

  test('should handle conditional edges styling', () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('decision', NodeType.CONDITION, {
        condition: (r: string) => r === 'ok',
        // Add maxIterations to satisfy cycle detection
        maxIterations: 5,
      })
      .addNode('end', NodeType.END)
      .addEdge('start', 'decision')
      .addConditionalEdge({
        from: 'decision',
        condition: (r: string) => r === 'ok',
        truePath: 'end',
        falsePath: 'start',
      })
      .build();

    const mermaid = GraphVisualizer.toMermaid(graph);

    expect(mermaid).toContain('n_decision{"decision\\nCondition"}');
    expect(mermaid).toContain('n_decision -->|true| n_end');
    expect(mermaid).toContain('n_decision -->|false| n_start');
  });

  test('should render all node types with correct shapes and class assignments', () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('par', NodeType.PARALLEL, { agentIds: ['a1', 'a2'] })
      .addNode('loop', NodeType.LOOP, { maxIterations: 3, agentId: 'loopAgent' })
      .addNode('human', NodeType.HUMAN)
      .addNode('collab', NodeType.COLLABORATIVE, { agentIds: ['a1', 'a2'] })
      .addNode('agg', NodeType.AGGREGATE, {
        agentIds: ['a1'],
        aggregator: () => 'aggregated',
      })
      .addNode('xform', NodeType.TRANSFORM, { transformer: (input: string) => input })
      .addNode('end', NodeType.END)
      .addEdge('start', 'par')
      .addEdge('par', 'loop')
      .addEdge('loop', 'human')
      .addEdge('human', 'collab')
      .addEdge('collab', 'agg')
      .addEdge('agg', 'xform')
      .addEdge('xform', 'end')
      .build();

    const mermaid = GraphVisualizer.toMermaid(graph, { direction: 'LR' });

    expect(mermaid).toContain('graph LR');
    // Parallel node — double-brace shape
    expect(mermaid).toContain('n_par{{"par\\nParallel (2 agents)"}}');
    // Loop node — double-paren shape
    expect(mermaid).toContain('n_loop(("loop\\nLoop"))');
    // Human node — trapezoid shape
    expect(mermaid).toContain('n_human["human\\nHuman"]');
    // Collaborative node — subroutine shape
    expect(mermaid).toContain('n_collab[["collab\\nCollaborative (2 agents)"]]');
    // Aggregate — rectangular
    expect(mermaid).toContain('n_agg["agg\\nAggregate"]');
    // Transform — rectangular
    expect(mermaid).toContain('n_xform["xform\\nTransform"]');

    // Class assignments
    expect(mermaid).toContain('class n_par parallel');
    expect(mermaid).toContain('class n_loop loop');
    expect(mermaid).toContain('class n_human human');
    expect(mermaid).toContain('class n_collab collaborative');
  });

  test('should handle default node type with fallback shape', () => {
    const graph = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('end', NodeType.END)
      .addEdge('start', 'end')
      .build();

    // Manually inject a node with an unknown type to hit the default branch
    // by accessing the internal nodes map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = (graph as any).nodes as Map<string, { id: string; type: string }>;
    nodes.set('custom', { id: 'custom', type: 'unknown_type' as NodeType });

    const mermaid = GraphVisualizer.toMermaid(graph);
    expect(mermaid).toContain('n_custom["custom\\nUnknown_type"]');
  });
});
