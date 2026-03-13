// src/execution/graph-visualizer.ts

import { ExecutionEngine, NodeType, GraphNode } from './engine/execution-engine';

/**
 * Options for Mermaid diagram generation
 */
export interface MermaidOptions {
  /** Direction of the graph: TD (top-down), LR (left-right), RL (right-left), BT (bottom-top) */
  direction?: 'TD' | 'LR' | 'RL' | 'BT';
  /** Show agent names in node labels */
  showAgentNames?: boolean;
  /** Color nodes by their type */
  colorByType?: boolean;
  /** Highlight a specific execution path */
  highlightPath?: string[];
  /** Include node metadata in tooltips */
  includeMetadata?: boolean;
  /** Theme: 'default', 'dark', 'forest', 'neutral' */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

/**
 * Options for DOT (GraphViz) export
 */
export interface DOTOptions {
  /** Graph direction */
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Node shape style */
  nodeShape?: string;
  /** Include edge labels */
  edgeLabels?: boolean;
  /** Cluster nodes by type */
  clusterByType?: boolean;
}

/**
 * JSON export structure for interactive visualization
 */
export interface GraphJSON {
  nodes: Array<{
    id: string;
    type: NodeType;
    label: string;
    metadata?: Record<string, unknown>;
    agentId?: string;
    agentIds?: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    condition?: boolean;
  }>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
  };
}

/**
 * Utility to visualize the Execution Graph in multiple formats
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
  static toMermaid(engine: ExecutionEngine, options: MermaidOptions = {}): string {
    const {
      direction = 'TD',
      showAgentNames = true,
      colorByType = true,
      highlightPath = [],
      includeMetadata = false,
      theme = 'default',
    } = options;

    const nodes = engine.getNodes();
    const edges = engine.getEdges();
    const pathSet = new Set(highlightPath);

    let mermaid = `%%{init: {'theme': '${theme}'}}%%\n`;
    mermaid += `graph ${direction}\n`;

    // 1. Render Nodes
    for (const node of nodes.values()) {
      let shape = '';
      const safeId = GraphVisualizer.safeId(node.id);
      const isHighlighted = pathSet.has(node.id);
      const label = GraphVisualizer.getNodeLabel(node, showAgentNames);

      switch (node.type) {
        case NodeType.START:
          shape = `("${label}")`;
          break;
        case NodeType.END:
          shape = `("${label}")`;
          break;
        case NodeType.AGENT:
          shape = `["${label}"]`;
          break;
        case NodeType.PARALLEL:
          shape = `{{"${label}"}}`;
          break;
        case NodeType.CONDITION:
          shape = `{"${label}"}`;
          break;
        case NodeType.LOOP:
          shape = `(("${label}"))`;
          break;
        case NodeType.HUMAN:
          shape = `["${label}"]`;
          break;
        case NodeType.COLLABORATIVE:
          shape = `[["${label}"]]`;
          break;
        case NodeType.AGGREGATE:
          shape = `["${label}"]`;
          break;
        case NodeType.TRANSFORM:
          shape = `["${label}"]`;
          break;
        default:
          shape = `["${label}"]`;
      }

      // Add styling class if needed
      mermaid += `    ${safeId}${shape}`;

      // Add tooltip with metadata if requested
      if (includeMetadata && node.metadata) {
        const tooltip = JSON.stringify(node.metadata).substring(0, 100);
        mermaid += `:::tip(${tooltip})`;
      }

      mermaid += '\n';

      // Add highlight class
      if (isHighlighted) {
        mermaid += `    class ${safeId} highlight;\n`;
      }
    }

    mermaid += '\n';

    // 2. Render Edges
    for (const [fromId, edgeList] of edges.entries()) {
      const fromSafe = GraphVisualizer.safeId(fromId);
      const fromHighlighted = pathSet.has(fromId);

      for (const edge of edgeList) {
        const toSafe = GraphVisualizer.safeId(edge.to);
        const toHighlighted = pathSet.has(edge.to);
        const isPathEdge = fromHighlighted && toHighlighted;

        const arrow = isPathEdge ? '==>' : '-->';
        let label = '';

        if (edge.label) {
          label = `|${edge.label}|`;
        }

        // Special handling for conditional edges
        if (nodes.get(fromId)?.type === NodeType.CONDITION) {
          if (edge.metadata?.conditionType === 'true') label = '|True|';
          if (edge.metadata?.conditionType === 'false') label = '|False|';
        }

        mermaid += `    ${fromSafe} ${arrow}${label} ${toSafe}`;

        if (isPathEdge) {
          mermaid += ':::highlight';
        }

        mermaid += '\n';
      }
    }

    // 3. Styling
    if (colorByType) {
      mermaid += '\n    classDef default fill:#f9f9f9,stroke:#333,stroke-width:2px;\n';
      mermaid += '    classDef agent fill:#ffecb3,stroke:#ffb74d;\n';
      mermaid += '    classDef startNode fill:#c8e6c9,stroke:#81c784;\n';
      mermaid += '    classDef endNode fill:#ffccbc,stroke:#ff8a65;\n';
      mermaid += '    classDef condition fill:#e1bee7,stroke:#ab47bc;\n';
      mermaid += '    classDef parallel fill:#bbdefb,stroke:#42a5f5;\n';
      mermaid += '    classDef loop fill:#fff9c4,stroke:#f9a825;\n';
      mermaid += '    classDef human fill:#d7ccc8,stroke:#8d6e63;\n';
      mermaid += '    classDef collaborative fill:#b2dfdb,stroke:#26a69a;\n';
      mermaid += '    classDef aggregate fill:#ffe0b2,stroke:#ff9800;\n';
      mermaid += '    classDef transform fill:#e8f5e9,stroke:#4caf50;\n';
      mermaid += '    classDef highlight fill:#fff59d,stroke:#f57f17,stroke-width:4px;\n';

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
          case NodeType.AGGREGATE:
            mermaid += `    class ${safeId} aggregate;\n`;
            break;
          case NodeType.TRANSFORM:
            mermaid += `    class ${safeId} transform;\n`;
            break;
        }
      }
    }

    return mermaid;
  }

  /**
   * Export graph to GraphViz DOT format
   */
  static toDOT(engine: ExecutionEngine, options: DOTOptions = {}): string {
    const { rankdir = 'TB', nodeShape = 'box', edgeLabels = true, clusterByType = false } = options;

    const nodes = engine.getNodes();
    const edges = engine.getEdges();

    let dot = `digraph G {\n`;
    dot += `  rankdir=${rankdir};\n`;
    dot += `  node [shape=${nodeShape}, style=rounded];\n`;
    dot += `  edge [fontname="Arial", fontsize=10];\n\n`;

    if (clusterByType) {
      // Group nodes by type in clusters
      const nodesByType = new Map<NodeType, GraphNode[]>();
      for (const node of nodes.values()) {
        const list = nodesByType.get(node.type) || [];
        list.push(node);
        nodesByType.set(node.type, list);
      }

      let clusterId = 0;
      for (const [type, typeNodes] of nodesByType) {
        dot += `  subgraph cluster_${clusterId} {\n`;
        dot += `    label="${type}";\n`;
        dot += `    style=filled;\n`;
        dot += `    color=${GraphVisualizer.getTypeColor(type)};\n`;

        for (const node of typeNodes) {
          const shape = GraphVisualizer.getDOTShape(node.type);
          const label = GraphVisualizer.getNodeLabel(node, true).replace(/"/g, '\\"');
          dot += `    "${node.id}" [shape=${shape}, label="${label}"];\n`;
        }

        dot += `  }\n\n`;
        clusterId++;
      }
    } else {
      // Simple node definitions
      for (const node of nodes.values()) {
        const shape = GraphVisualizer.getDOTShape(node.type);
        const label = GraphVisualizer.getNodeLabel(node, true).replace(/"/g, '\\"');
        const color = GraphVisualizer.getTypeColor(node.type);
        dot += `  "${node.id}" [shape=${shape}, label="${label}", fillcolor="${color}", style=filled];\n`;
      }
    }

    dot += '\n';

    // Edges
    for (const [fromId, edgeList] of edges.entries()) {
      for (const edge of edgeList) {
        const label = edgeLabels && edge.label ? ` [label="${edge.label}"]` : '';
        dot += `  "${fromId}" -> "${edge.to}"${label};\n`;
      }
    }

    dot += '}';
    return dot;
  }

  /**
   * Export graph to JSON for interactive visualization
   */
  static toJSON(engine: ExecutionEngine): GraphJSON {
    const nodes = engine.getNodes();
    const edges = engine.getEdges();

    const nodeTypes: Record<string, number> = {};

    const jsonNodes = Array.from(nodes.values()).map((node) => {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;

      return {
        id: node.id,
        type: node.type,
        label: GraphVisualizer.getNodeLabel(node, true),
        metadata: node.metadata,
        agentId: node.agentId,
        agentIds: node.agentIds,
      };
    });

    const jsonEdges = Array.from(edges.entries()).flatMap(([fromId, edgeList]) =>
      edgeList.map((edge) => ({
        from: fromId,
        to: edge.to,
        label: edge.label,
        condition: !!edge.condition,
      }))
    );

    return {
      nodes: jsonNodes,
      edges: jsonEdges,
      stats: {
        totalNodes: nodes.size,
        totalEdges: jsonEdges.length,
        nodeTypes,
      },
    };
  }

  /**
   * Generate an ASCII art representation of the graph
   */
  static toASCII(engine: ExecutionEngine): string {
    const nodes = engine.getNodes();
    const edges = engine.getEdges();

    const lines: string[] = ['Graph Structure:', ''];

    // Build adjacency info
    const incoming = new Map<string, string[]>();
    for (const [fromId, edgeList] of edges) {
      for (const edge of edgeList) {
        const list = incoming.get(edge.to) || [];
        list.push(fromId);
        incoming.set(edge.to, list);
      }
    }

    // Render nodes with their connections
    for (const node of nodes.values()) {
      const symbol = GraphVisualizer.getTypeSymbol(node.type);
      const label = GraphVisualizer.getNodeLabel(node, false);
      lines.push(`${symbol} ${label}`);

      const outgoing = edges.get(node.id) || [];
      for (let i = 0; i < outgoing.length; i++) {
        const edge = outgoing[i];
        const isLast = i === outgoing.length - 1;
        const prefix = isLast ? '└──' : '├──';
        const arrow = edge.label ? `──[${edge.label}]──▶` : '──▶';
        lines.push(`   ${prefix}${arrow} ${edge.to}`);
      }

      if (outgoing.length > 0) {
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a PlantUML diagram
   */
  static toPlantUML(engine: ExecutionEngine, _direction: 'TD' | 'LR' = 'TD'): string {
    const nodes = engine.getNodes();
    const edges = engine.getEdges();

    let uml = '@startuml\n';
    uml += `skinparam backgroundColor #FEFEFE\n`;
    uml += `skinparam handwritten false\n\n`;

    // Define nodes
    for (const node of nodes.values()) {
      const color = GraphVisualizer.getTypeColor(node.type);
      const label = GraphVisualizer.getNodeLabel(node, true).replace(/"/g, '\\"');

      switch (node.type) {
        case NodeType.START:
        case NodeType.END:
          uml += `circle "${label}" as ${node.id} #${color}\n`;
          break;
        case NodeType.CONDITION:
          uml += `diamond "${label}" as ${node.id} #${color}\n`;
          break;
        default:
          uml += `rectangle "${label}" as ${node.id} #${color}\n`;
      }
    }

    uml += '\n';

    // Define edges
    for (const [fromId, edgeList] of edges.entries()) {
      for (const edge of edgeList) {
        const label = edge.label ? ` : ${edge.label}` : '';
        uml += `${fromId} --> ${edge.to}${label}\n`;
      }
    }

    uml += '\n@enduml';
    return uml;
  }

  /**
   * Generate HTML with embedded Mermaid diagram
   */
  static toHTML(engine: ExecutionEngine, options: MermaidOptions = {}): string {
    const mermaid = GraphVisualizer.toMermaid(engine, options);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SocietyAI Graph Visualization</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .mermaid { text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Execution Graph</h1>
    <div class="mermaid">
${mermaid}
    </div>
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>`;
  }

  // Helper methods

  private static getNodeLabel(node: GraphNode, showAgentNames: boolean): string {
    const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);

    if (node.type === NodeType.AGENT && showAgentNames && node.agentId) {
      return `${node.id}\\nAgent: ${node.agentId}`;
    }

    if (node.type === NodeType.PARALLEL && showAgentNames && node.agentIds) {
      return `${node.id}\\nParallel (${node.agentIds.length} agents)`;
    }

    if (node.type === NodeType.COLLABORATIVE && showAgentNames && node.agentIds) {
      return `${node.id}\\nCollaborative (${node.agentIds.length} agents)`;
    }

    return `${node.id}\\n${typeLabel}`;
  }

  private static getDOTShape(type: NodeType): string {
    switch (type) {
      case NodeType.START:
      case NodeType.END:
        return 'circle';
      case NodeType.CONDITION:
        return 'diamond';
      case NodeType.PARALLEL:
        return 'box3d';
      case NodeType.LOOP:
        return 'doublecircle';
      case NodeType.HUMAN:
        return 'house';
      case NodeType.COLLABORATIVE:
        return 'component';
      default:
        return 'box';
    }
  }

  private static getTypeColor(type: NodeType): string {
    switch (type) {
      case NodeType.START:
        return '#c8e6c9';
      case NodeType.END:
        return '#ffccbc';
      case NodeType.AGENT:
        return '#ffecb3';
      case NodeType.PARALLEL:
        return '#bbdefb';
      case NodeType.CONDITION:
        return '#e1bee7';
      case NodeType.LOOP:
        return '#fff9c4';
      case NodeType.HUMAN:
        return '#d7ccc8';
      case NodeType.COLLABORATIVE:
        return '#b2dfdb';
      case NodeType.AGGREGATE:
        return '#ffe0b2';
      case NodeType.TRANSFORM:
        return '#e8f5e9';
      default:
        return '#f5f5f5';
    }
  }

  private static getTypeSymbol(type: NodeType): string {
    switch (type) {
      case NodeType.START:
        return '▶️';
      case NodeType.END:
        return '⏹️';
      case NodeType.AGENT:
        return '🤖';
      case NodeType.PARALLEL:
        return '⚡';
      case NodeType.CONDITION:
        return '❓';
      case NodeType.LOOP:
        return '🔄';
      case NodeType.HUMAN:
        return '👤';
      case NodeType.COLLABORATIVE:
        return '👥';
      case NodeType.AGGREGATE:
        return '📊';
      case NodeType.TRANSFORM:
        return '⚙️';
      default:
        return '📦';
    }
  }
}

// Re-export for backward compatibility
export { NodeType };
