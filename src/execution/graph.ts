/**
 * @fileoverview SocietyGraph - Graph-based Execution Engine
 *
 * This module provides a flexible graph-based execution engine that unifies
 * workflows and pipelines into a single DAG/Cyclic graph architecture.
 *
 * Features:
 * - DAG (Directed Acyclic Graph) and Cyclic graph support
 * - Conditional branching
 * - Loop support with termination conditions
 * - Parallel execution optimization
 * - Dynamic edge creation based on runtime conditions
 *
 * @example
 * ```typescript
 * const graph = GraphBuilder.create()
 *   .addNode('input', NodeType.START)
 *   .addNode('analyzer', NodeType.AGENT, { agentId: 'analyst' })
 *   .addNode('validator', NodeType.AGENT, { agentId: 'validator' })
 *   .addNode('output', NodeType.END)
 *   .addEdge('input', 'analyzer')
 *   .addConditionalEdge('analyzer', {
 *     condition: (result) => result.includes('valid'),
 *     truePath: 'output',
 *     falsePath: 'validator'
 *   })
 *   .addEdge('validator', 'analyzer', { maxIterations: 3 })
 *   .build();
 *
 * const result = await graph.execute(input, agents);
 * ```
 */

import { AgentConfig, AIModel } from '../core/types';
import { getLogger } from '../observability/logger';
import { WorkerPool } from '../utils/worker-pool';
import { ProcessingFailedError } from '../core/errors';

// ============================================================================
// GRAPH TYPES
// ============================================================================

/**
 * Step result specific to graph execution
 */
export interface GraphStepResult {
  /** ID of the agent */
  agentId: string;
  /** Output content */
  output: string;
  /** Success status */
  success: boolean;
  /** Execution duration in ms */
  duration: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Node types in the execution graph
 */
export enum NodeType {
  /** Starting point of the graph */
  START = 'start',
  /** Ending point of the graph */
  END = 'end',
  /** Agent execution node */
  AGENT = 'agent',
  /** Parallel execution of multiple agents */
  PARALLEL = 'parallel',
  /** Aggregation of multiple results */
  AGGREGATE = 'aggregate',
  /** Conditional branching */
  CONDITION = 'condition',
  /** Data transformation */
  TRANSFORM = 'transform',
  /** Loop control */
  LOOP = 'loop',
}

/**
 * Node configuration
 */
export interface GraphNode {
  /** Unique node identifier */
  id: string;
  /** Node type */
  type: NodeType;
  /** Agent ID for AGENT nodes */
  agentId?: string;
  /** Agent IDs for PARALLEL nodes */
  agentIds?: string[];
  /** Aggregation function for AGGREGATE nodes */
  aggregator?: (results: GraphStepResult[]) => string;
  /** Condition function for CONDITION nodes */
  condition?: (result: string, context: GraphContext) => boolean;
  /** Transform function for TRANSFORM nodes */
  transformer?: (result: string, context: GraphContext) => string;
  /** Loop termination condition for LOOP nodes */
  loopCondition?: (iteration: number, result: string, context: GraphContext) => boolean;
  /** Maximum iterations for LOOP nodes */
  maxIterations?: number;
  /** Node metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Edge configuration
 */
export interface GraphEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Optional condition for dynamic routing */
  condition?: (result: string, context: GraphContext) => boolean;
  /** Edge label for visualization */
  label?: string;
  /** Edge metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conditional edge configuration
 */
export interface ConditionalEdge {
  /** Source node ID */
  from: string;
  /** Condition function */
  condition: (result: string, context: GraphContext) => boolean;
  /** Path to take if condition is true */
  truePath: string;
  /** Path to take if condition is false */
  falsePath: string;
}

/**
 * Graph execution context
 */
export interface GraphContext {
  /** Original input */
  input: string;
  /** Current result */
  currentResult: string;
  /** All node results */
  nodeResults: Map<string, GraphStepResult>;
  /** Shared data between nodes */
  sharedData: Map<string, unknown>;
  /** Iteration counts for loop nodes */
  iterationCounts: Map<string, number>;
  /** Execution path taken */
  executionPath: string[];
  /** Start time */
  startTime: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Graph execution result
 */
export interface GraphResult {
  /** Final output */
  output: string;
  /** Success status */
  success: boolean;
  /** All node results */
  nodeResults: Map<string, GraphStepResult>;
  /** Execution path taken */
  executionPath: string[];
  /** Execution duration in ms */
  duration: number;
  /** Errors if any */
  errors?: Error[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// SOCIETY GRAPH MODEL (Recursive)
// ============================================================================

/**
 * Adapter allowing a SocietyGraph to be used as an AI Model (Agent).
 * This enables hierarchical societies (societies within societies).
 */
export class SocietyAsModel implements AIModel {
  private logger = getLogger();

  constructor(
    private graph: SocietyGraph,
    private agents: AgentConfig[],
    private options: { name?: string; description?: string } = {}
  ) {}

  /**
   * Return the name of the model
   */
  name(): string {
    return this.options.name || 'SocietyModel';
  }

  /**
   * Process a prompt by executing the encapsulated graph
   */
  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    const input = String(prompt);
    this.logger.info(`Recursive Society '${this.name()}' started execution`);

    try {
      const result = await this.graph.execute(input, this.agents, signal);

      if (!result.success) {
        const error = result.errors?.[0] || new Error('Unknown error in recursive society');
        throw error;
      }

      this.logger.info(`Recursive Society '${this.name()}' completed execution`);
      return result.output;
    } catch (error) {
      this.logger.error(`Recursive Society '${this.name()}' failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check if the model supports a specific prompt type
   */
  supportsPromptType(promptType: string): boolean {
    return promptType === 'text';
  }
}

// ============================================================================
// SOCIETY GRAPH
// ============================================================================

/**
 * Graph-based execution engine
 */
export class SocietyGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();
  private logger = getLogger();

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    // Validate and store nodes
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }

    // Validate and store edges
    for (const edge of edges) {
      if (!this.nodes.has(edge.from)) {
        throw new ProcessingFailedError(`Source node not found: ${edge.from}`);
      }
      if (!this.nodes.has(edge.to)) {
        throw new ProcessingFailedError(`Target node not found: ${edge.to}`);
      }

      if (!this.edges.has(edge.from)) {
        this.edges.set(edge.from, []);
      }
      this.edges.get(edge.from)!.push(edge);
    }

    this.validateGraph();
  }

  /**
   * Validate graph structure
   */
  private validateGraph(): void {
    // Check for START node
    const startNodes = Array.from(this.nodes.values()).filter((n) => n.type === NodeType.START);
    if (startNodes.length === 0) {
      throw new ProcessingFailedError('Graph must have at least one START node');
    }

    // Check for END node
    const endNodes = Array.from(this.nodes.values()).filter((n) => n.type === NodeType.END);
    if (endNodes.length === 0) {
      throw new ProcessingFailedError('Graph must have at least one END node');
    }

    // Validate node configurations
    for (const node of this.nodes.values()) {
      switch (node.type) {
        case NodeType.AGENT:
          if (!node.agentId) {
            throw new ProcessingFailedError(`AGENT node ${node.id} must have agentId`);
          }
          break;
        case NodeType.PARALLEL:
          if (!node.agentIds || node.agentIds.length === 0) {
            throw new ProcessingFailedError(`PARALLEL node ${node.id} must have agentIds`);
          }
          break;
        case NodeType.AGGREGATE:
          if (!node.aggregator) {
            throw new ProcessingFailedError(
              `AGGREGATE node ${node.id} must have aggregator function`
            );
          }
          break;
        case NodeType.CONDITION:
          if (!node.condition) {
            throw new ProcessingFailedError(
              `CONDITION node ${node.id} must have condition function`
            );
          }
          break;
        case NodeType.TRANSFORM:
          if (!node.transformer) {
            throw new ProcessingFailedError(
              `TRANSFORM node ${node.id} must have transformer function`
            );
          }
          break;
      }
    }
  }

  /**
   * Execute the graph
   */
  async execute(input: string, agents: AgentConfig[], signal?: AbortSignal): Promise<GraphResult> {
    const startTime = Date.now();
    const context: GraphContext = {
      input,
      currentResult: input,
      nodeResults: new Map(),
      sharedData: new Map(),
      iterationCounts: new Map(),
      executionPath: [],
      startTime,
      signal,
    };

    try {
      // Find START nodes
      const startNodes = Array.from(this.nodes.values()).filter((n) => n.type === NodeType.START);

      // Execute from each START node (usually just one)
      for (const startNode of startNodes) {
        await this.executeNode(startNode, context, agents);
      }

      const duration = Date.now() - startTime;

      return {
        output: context.currentResult,
        success: true,
        nodeResults: context.nodeResults,
        executionPath: context.executionPath,
        duration,
        metadata: { totalNodes: this.nodes.size },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        output: context.currentResult,
        success: false,
        nodeResults: context.nodeResults,
        executionPath: context.executionPath,
        duration,
        errors: [error as Error],
        metadata: { totalNodes: this.nodes.size },
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: GraphNode,
    context: GraphContext,
    agents: AgentConfig[]
  ): Promise<void> {
    // Check cancellation
    if (context.signal?.aborted) {
      throw new Error('Execution cancelled');
    }

    // Add to execution path
    context.executionPath.push(node.id);
    this.logger.debug(`Executing node: ${node.id} (${node.type})`);

    let result: string = context.currentResult;

    switch (node.type) {
      case NodeType.START:
        // START nodes just pass through
        result = context.input;
        break;

      case NodeType.END:
        // END nodes terminate execution
        return;

      case NodeType.AGENT:
        result = await this.executeAgentNode(node, context, agents);
        break;

      case NodeType.PARALLEL:
        result = await this.executeParallelNode(node, context, agents);
        break;

      case NodeType.AGGREGATE:
        result = await this.executeAggregateNode(node, context);
        break;

      case NodeType.CONDITION:
        result = await this.executeConditionNode(node, context, agents);
        return; // Condition node handles its own routing

      case NodeType.TRANSFORM:
        result = this.executeTransformNode(node, context);
        break;

      case NodeType.LOOP:
        result = await this.executeLoopNode(node, context, agents);
        break;
    }

    // Store result
    context.currentResult = result;
    context.nodeResults.set(node.id, {
      agentId: node.agentId || node.id,
      output: result,
      success: true,
      duration: 0,
    });

    // Find and execute next nodes
    await this.executeNextNodes(node, context, agents);
  }

  /**
   * Execute an AGENT node
   */
  private async executeAgentNode(
    node: GraphNode,
    context: GraphContext,
    agents: AgentConfig[]
  ): Promise<string> {
    const agent = agents.find((a) => a.id === node.agentId);
    if (!agent) {
      throw new ProcessingFailedError(`Agent not found: ${node.agentId}`);
    }

    const prompt = this.buildPrompt(agent, context.currentResult, context);
    const result = await agent.model.process(prompt, context.signal);

    return result;
  }

  /**
   * Execute a PARALLEL node
   */
  private async executeParallelNode(
    node: GraphNode,
    context: GraphContext,
    agents: AgentConfig[]
  ): Promise<string> {
    const nodeAgents = node.agentIds!.map((id) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) {
        throw new ProcessingFailedError(`Agent not found: ${id}`);
      }
      return agent;
    });

    const pool = new WorkerPool(nodeAgents.length);
    const results: GraphStepResult[] = [];

    // Submit all tasks to the pool
    await Promise.all(
      nodeAgents.map((agent) =>
        pool.submit(async () => {
          const prompt = this.buildPrompt(agent, context.currentResult, context);
          const result = await agent.model.process(prompt, context.signal);

          const stepResult: GraphStepResult = {
            agentId: agent.id,
            output: result,
            success: true,
            duration: 0,
          };

          results.push(stepResult);

          return stepResult;
        })
      )
    );

    // Concatenate results
    return results.map((r) => r.output).join('\n\n');
  }

  /**
   * Execute an AGGREGATE node
   */
  private async executeAggregateNode(node: GraphNode, context: GraphContext): Promise<string> {
    // Collect previous results (assuming they're in nodeResults)
    const results = Array.from(context.nodeResults.values());
    return node.aggregator!(results);
  }

  /**
   * Execute a CONDITION node
   */
  private async executeConditionNode(
    node: GraphNode,
    context: GraphContext,
    agents: AgentConfig[]
  ): Promise<string> {
    const conditionResult = node.condition!(context.currentResult, context);

    // Find edges from this node
    const edges = this.edges.get(node.id) || [];
    const trueEdge = edges.find((e) => e.label === 'true');
    const falseEdge = edges.find((e) => e.label === 'false');

    const nextNodeId = conditionResult ? trueEdge?.to : falseEdge?.to;

    if (nextNodeId) {
      const nextNode = this.nodes.get(nextNodeId);
      if (nextNode) {
        await this.executeNode(nextNode, context, agents);
      }
    }

    return context.currentResult;
  }

  /**
   * Execute a TRANSFORM node
   */
  private executeTransformNode(node: GraphNode, context: GraphContext): string {
    return node.transformer!(context.currentResult, context);
  }

  /**
   * Execute a LOOP node
   */
  private async executeLoopNode(
    node: GraphNode,
    context: GraphContext,
    agents: AgentConfig[]
  ): Promise<string> {
    const maxIterations = node.maxIterations || 10;
    let iteration = context.iterationCounts.get(node.id) || 0;

    while (iteration < maxIterations) {
      iteration++;
      context.iterationCounts.set(node.id, iteration);

      // Execute loop body (next nodes)
      await this.executeNextNodes(node, context, agents);

      // Check termination condition
      if (node.loopCondition?.(iteration, context.currentResult, context)) {
        break;
      }
    }

    return context.currentResult;
  }

  /**
   * Execute next nodes in the graph
   */
  private async executeNextNodes(
    node: GraphNode,
    context: GraphContext,
    agents: AgentConfig[]
  ): Promise<void> {
    const edges = this.edges.get(node.id) || [];

    for (const edge of edges) {
      // Check edge condition if present
      if (edge.condition && !edge.condition(context.currentResult, context)) {
        continue;
      }

      const nextNode = this.nodes.get(edge.to);
      if (nextNode) {
        await this.executeNode(nextNode, context, agents);
      }
    }
  }

  /**
   * Build prompt for an agent
   */
  private buildPrompt(agent: AgentConfig, input: string, context: GraphContext): string {
    const template = agent.role.promptTemplate || '{input}';

    return template
      .replace('{input}', input)
      .replace('{context}', JSON.stringify(Object.fromEntries(context.sharedData)))
      .replace(
        '{history}',
        Array.from(context.nodeResults.entries())
          .map(([id, result]) => `[${id}]: ${result.output}`)
          .join('\n')
      );
  }

  /**
   * Visualize graph structure (for debugging)
   */
  visualize(): string {
    const lines: string[] = ['Graph Structure:', ''];

    for (const node of this.nodes.values()) {
      lines.push(`Node: ${node.id} (${node.type})`);
      const edges = this.edges.get(node.id) || [];
      for (const edge of edges) {
        const label = edge.label ? ` [${edge.label}]` : '';
        lines.push(`  → ${edge.to}${label}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate Mermaid diagram definition for the graph
   */
  toMermaid(): string {
    const lines: string[] = ['graph TD'];

    // Style definitions
    lines.push('  classDef start fill:#f9f,stroke:#333,stroke-width:2px;');
    lines.push('  classDef end fill:#9f9,stroke:#333,stroke-width:2px;');
    lines.push('  classDef agent fill:#bbf,stroke:#333,stroke-width:1px;');
    lines.push('  classDef condition fill:#f90,stroke:#333,stroke-width:1px;');

    // Nodes
    for (const node of this.nodes.values()) {
      let shape = '[ ' + node.id + ' ]';
      let style = '';

      switch (node.type) {
        case NodeType.START:
          shape = '((' + node.id + '))';
          style = ':::start';
          break;
        case NodeType.END:
          shape = '((' + node.id + '))';
          style = ':::end';
          break;
        case NodeType.CONDITION:
          shape = '{' + node.id + '}';
          style = ':::condition';
          break;
        case NodeType.AGENT:
          shape = '[' + (node.agentId || node.id) + ']';
          style = ':::agent';
          break;
      }

      lines.push(`  ${node.id}${shape}${style}`);
    }

    // Edges
    for (const [from, edges] of this.edges.entries()) {
      for (const edge of edges) {
        const label = edge.label ? `|${edge.label}|` : '-->';
        const arrow = edge.label ? '-->' : '-->';
        lines.push(`  ${from} ${arrow} ${label} ${edge.to}`);
      }
    }

    return lines.join('\n');
  }
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Builder for creating execution graphs
 */
export class GraphBuilder {
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];

  static create(): GraphBuilder {
    return new GraphBuilder();
  }

  /**
   * Add a node to the graph
   */
  addNode(id: string, type: NodeType, config?: Partial<Omit<GraphNode, 'id' | 'type'>>): this {
    this.nodes.push({ id, type, ...config });
    return this;
  }

  /**
   * Add an edge to the graph
   */
  addEdge(from: string, to: string, config?: Partial<Omit<GraphEdge, 'from' | 'to'>>): this {
    this.edges.push({ from, to, ...config });
    return this;
  }

  /**
   * Add a conditional edge
   */
  addConditionalEdge(config: ConditionalEdge): this {
    this.addEdge(config.from, config.truePath, {
      condition: config.condition,
      label: 'true',
    });
    this.addEdge(config.from, config.falsePath, {
      condition: (result, ctx) => !config.condition(result, ctx),
      label: 'false',
    });
    return this;
  }

  /**
   * Build the graph
   */
  build(): SocietyGraph {
    return new SocietyGraph(this.nodes, this.edges);
  }
}
