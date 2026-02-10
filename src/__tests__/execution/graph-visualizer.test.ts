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
    expect(mermaid).toContain('n_start("start [Start]")');
    expect(mermaid).toContain('n_agent["agent<br/>Agent: agent1"]');
    expect(mermaid).toContain('n_end("end [End]")');
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

    expect(mermaid).toContain('n_decision{"decision<br/>Condition"}');
    expect(mermaid).toContain('n_decision -->|true| n_end');
    expect(mermaid).toContain('n_decision -->|false| n_start');
  });
});
