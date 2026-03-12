// src/execution/graph-visualizer.ts

import { ExecutionEngine, NodeType } from './engine/execution-engine';

/**
 * Utility to visualize the Execution Graph as a Mermaid diagram
 */
export class GraphVisualizer {
  /**
   * Safe ID for Mermaid (handles keywords and special chars)
   */
  private static safeId(id: string): string {
    // Replace non-alphanumeric chars (including hyphens) with underscores
    return `n_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }

  /**
   * Convert execution engine structure to Mermaid Markdown
   */
  static toMermaid(engine: ExecutionEngine, direction: 'TD' | 'LR' = 'TD'): string {
    const nodes = engine.getNodes();
    const edges = engine.getEdges();

    let mermaid = `graph ${direction}\n`;

    // 1. Render Nodes
    for (const node of nodes.values()) {
      let shape = '';
      const safeId = GraphVisualizer.safeId(node.id);

      switch (node.type) {
        case NodeType.START:
          shape = `("${node.id} [Start]")`;
          break;
        case NodeType.END:
          shape = `("${node.id} [End]")`;
          break;
        case NodeType.AGENT:
          shape = `["${node.id}<br/>Agent: ${node.agentId}"]`;
          break;
        case NodeType.PARALLEL:
          shape = `{{"${node.id}<br/>Parallel"}}`;
          break;
        case NodeType.CONDITION:
          shape = `{"${node.id}<br/>Condition"}`;
          break;
        case NodeType.LOOP:
          shape = `(("${node.id}<br/>Loop"))`;
          break;
        case NodeType.HUMAN:
          shape = `[/"${node.id}<br/>Human Input"/]`;
          break;
        case NodeType.COLLABORATIVE:
          shape = `[["${node.id}<br/>Collaborative"]]`;
          break;
        case NodeType.AGGREGATE:
          shape = `["${node.id}<br/>Aggregate"]`;
          break;
        case NodeType.TRANSFORM:
          shape = `["${node.id}<br/>Transform"]`;
          break;
        default:
          shape = `["${node.id}<br/>${node.type}"]`;
      }

      // Add styling class if needed
      mermaid += `    ${safeId}${shape}\n`;
    }

    mermaid += '\n';

    // 2. Render Edges
    for (const [fromId, edgeList] of edges.entries()) {
      const fromSafe = GraphVisualizer.safeId(fromId);
      for (const edge of edgeList) {
        const toSafe = GraphVisualizer.safeId(edge.to);
        const arrow = '-->';
        let label = edge.label ? `|${edge.label}|` : '';

        // Special handling for conditional edges to make them clear
        if (nodes.get(fromId)?.type === NodeType.CONDITION) {
          // Usually conditional edges are handled differently in config,
          // but in engine they are just edges with 'condition'
          if (edge.metadata?.conditionType === 'true') label = '|True|';
          if (edge.metadata?.conditionType === 'false') label = '|False|';
        }

        mermaid += `    ${fromSafe} ${arrow}${label} ${toSafe}\n`;
      }
    }

    // 3. Styling
    mermaid += '\n    classDef default fill:#f9f9f9,stroke:#333,stroke-width:2px;\n';
    mermaid += '    classDef agent fill:#ffecb3,stroke:#ffb74d;\n';
    mermaid += '    classDef startNode fill:#c8e6c9,stroke:#81c784;\n';
    mermaid += '    classDef endNode fill:#ffccbc,stroke:#ff8a65;\n';
    mermaid += '    classDef condition fill:#e1bee7,stroke:#ab47bc;\n';
    mermaid += '    classDef parallel fill:#bbdefb,stroke:#42a5f5;\n';
    mermaid += '    classDef loop fill:#fff9c4,stroke:#f9a825;\n';
    mermaid += '    classDef human fill:#d7ccc8,stroke:#8d6e63;\n';
    mermaid += '    classDef collaborative fill:#b2dfdb,stroke:#26a69a;\n';

    // Apply classes
    for (const node of nodes.values()) {
      const safeId = GraphVisualizer.safeId(node.id);
      switch (node.type) {
        case NodeType.AGENT:
          mermaid += `    class ${safeId} agent;\n`;
          break;
        case NodeType.START:
          mermaid += `    class ${safeId} startNode;\n`;
          break;
        case NodeType.END:
          mermaid += `    class ${safeId} endNode;\n`;
          break;
        case NodeType.CONDITION:
          mermaid += `    class ${safeId} condition;\n`;
          break;
        case NodeType.PARALLEL:
          mermaid += `    class ${safeId} parallel;\n`;
          break;
        case NodeType.LOOP:
          mermaid += `    class ${safeId} loop;\n`;
          break;
        case NodeType.HUMAN:
          mermaid += `    class ${safeId} human;\n`;
          break;
        case NodeType.COLLABORATIVE:
          mermaid += `    class ${safeId} collaborative;\n`;
          break;
      }
    }

    return mermaid;
  }
}
