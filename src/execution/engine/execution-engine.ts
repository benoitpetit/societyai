/**
 * @fileoverview ExecutionEngine - Graph-based Execution Engine
 *
 * This module provides a flexible graph-based execution engine that unifies
 * workflows and pipelines into a single DAG/Cyclic graph architecture.
 * Also exported as 'SocietyGraph' for backward compatibility.
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

import {
  Agent,
  ExecutionContext,
  Message,
  SocietyObserver,
  TaskResult,
  RetentionPolicy,
} from '../../core/types';
import { AgentExecutor } from '../../agents/agent-executor';
import { getLogger } from '../../observability/logger';
import { ConcurrencyLimiter } from '../../utils/worker-pool';
import { IsolatedWorkerPool } from '../../utils/isolated-worker-pool';
import { ProcessingFailedError, InvalidConfigurationError } from '../../core/errors';
import { JSONSchema } from '../../capabilities/validation';
import { MiddlewareChain } from '../../core/middleware';
import { StorageAdapter, WorkflowState, mapToArray, arrayToMap } from '../../core/persistence';
import { RetryOptions } from '../../core/config';
import { withRetry } from '../../utils/retry';
import { randomUUID } from 'crypto';

// ============================================================================
// GRAPH TYPES
// ============================================================================

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
  /** Collaborative execution (multi-agent loop) */
  COLLABORATIVE = 'collaborative',
  /** Human interaction node (pauses execution) */
  HUMAN = 'human',
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
  aggregator?: (results: TaskResult[]) => string;
  /** Condition function for CONDITION nodes */
  condition?: (result: string, context: GraphContext) => boolean;
  /** Transform function for TRANSFORM nodes */
  transformer?: (result: string, context: GraphContext) => string;
  /** Loop termination condition for LOOP nodes */
  loopCondition?: (iteration: number, result: string, context: GraphContext) => boolean;
  /** Completion condition for COLLABORATIVE nodes */
  completionCondition?: (results: TaskResult[], iteration: number) => boolean;
  /** Maximum iterations for LOOP nodes */
  maxIterations?: number;
  /** Message router for COLLABORATIVE nodes - determines message recipients */
  messageRouter?: (
    message: Message,
    senderAgent: Agent,
    allAgents: Agent[],
    context: GraphContext
  ) => string[]; // Returns array of recipient agent IDs
  /** Node metadata */
  metadata?: Record<string, unknown>;
  /** Schema for output validation */
  outputSchema?: JSONSchema;

  /** Retry options for this node */
  retryOptions?: RetryOptions;
  /** Loop configuration — used by AGENT nodes to drive iteration */
  loopConfig?: import('../../core/types').LoopConfig;
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
  /** Unique ID for this execution */
  executionId: string;
  /** Original input */
  input: string;
  /** Current result */
  currentResult: string;
  /** All node results */
  nodeResults: Map<string, TaskResult>;
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
  /** Message history for collaborative nodes */
  messageHistory: Message[];
  /** Dead Letter Queue for failed nodes */
  deadLetterQueue: string[];
}

/**
 * Graph execution result
 */
export interface GraphResult {
  /** Execution Status */
  status: 'completed' | 'failed' | 'paused';
  /** Final output */
  output: string;
  /** Success status (true if completed successfully) */
  success: boolean;
  /** All node results */
  nodeResults: Map<string, TaskResult>;
  /** Execution path taken */
  executionPath: string[];
  /** Execution duration in ms */
  duration: number;
  /** Errors if any */
  errors?: Error[];
  /** Message history from collaborative sessions */
  messages?: Message[];
  /** Metadata */
  metadata: Record<string, unknown>;
  /** ID of the node waiting for input (if paused) */
  waitingForNodeId?: string;
  /** Execution ID */
  executionId?: string;
}

// ============================================================================
// OPTIONS INTERFACES
// ============================================================================

/** Options object for {@link ExecutionEngine.execute} */
export interface ExecuteOptions {
  input: string;
  agents: Agent[];
  signal?: AbortSignal;
  observer?: SocietyObserver;
  middlewareChain?: MiddlewareChain;
  initialContext?: Record<string, unknown>;
  storageAdapter?: StorageAdapter;
  executionId?: string;
  retentionPolicy?: RetentionPolicy;
}

/** Options object for {@link ExecutionEngine.resume} */
export interface ResumeOptions {
  state: WorkflowState;
  agents: Agent[];
  humanInput?: string;
  signal?: AbortSignal;
  observer?: SocietyObserver;
  middlewareChain?: MiddlewareChain;
  storageAdapter?: StorageAdapter;
  retentionPolicy?: RetentionPolicy;
}

// ============================================================================
// EXECUTION ENGINE
// ============================================================================

import { GraphVisualizer } from '../graph-visualizer';

/**
 * Graph-based execution engine
 */
export interface ExecutionEngineOptions {
  /** Maximum number of parallel tasks (default: 10) */
  maxParallelism?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export class ExecutionEngine {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();
  private logger = getLogger();
  /** Engine-level isolated worker pool — created once and reused (#8) */
  private isolatedPool: IsolatedWorkerPool | null = null;
  /** Engine-level parallel pool — created once and reused */
  private parallelPool: ConcurrencyLimiter;

  /**
   * Get all nodes in the graph (read-only)
   */
  getNodes(): ReadonlyMap<string, GraphNode> {
    return this.nodes;
  }

  /**
   * Get all edges in the graph (read-only)
   */
  getEdges(): ReadonlyMap<string, GraphEdge[]> {
    return this.edges;
  }

  constructor(nodes: GraphNode[], edges: GraphEdge[], options?: ExecutionEngineOptions) {
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

    // Initialize parallel pool
    this.parallelPool = new ConcurrencyLimiter(options?.maxParallelism ?? 10, options?.signal);

    this.validateGraph();
  }

  /**
   * Validate that all agent references in nodes point to existing agents
   */
  validateAgentReferences(agents: Agent[]): void {
    const agentIds = new Set(agents.map((a) => a.id));
    const errors: string[] = [];

    for (const node of this.nodes.values()) {
      if (node.type === NodeType.AGENT && node.agentId) {
        if (!agentIds.has(node.agentId)) {
          errors.push(`Node '${node.id}' references unknown agent '${node.agentId}'`);
        }
      }
      if (node.type === NodeType.PARALLEL && node.agentIds) {
        for (const agentId of node.agentIds) {
          if (!agentIds.has(agentId)) {
            errors.push(`Node '${node.id}' references unknown agent '${agentId}'`);
          }
        }
      }
      if (node.type === NodeType.COLLABORATIVE && node.agentIds) {
        for (const agentId of node.agentIds) {
          if (!agentIds.has(agentId)) {
            errors.push(`Node '${node.id}' references unknown agent '${agentId}'`);
          }
        }
      }
    }

    if (errors.length > 0) {
      const availableAgents = Array.from(agentIds);
      throw new InvalidConfigurationError(
        `Agent validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
        {
          availableIds: availableAgents,
          suggestion: 'Ensure all agents are defined before building the graph',
        }
      );
    }
  }

  /**
   * Export the graph structure as a Mermaid diagram
   */
  toMermaid(direction: 'TD' | 'LR' = 'TD'): string {
    return GraphVisualizer.toMermaid(this, { direction });
  }

  /**
   * Validate graph structure
   */

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
   * Apply retention policy to prevent memory exhaustion in long-running executions
   * This should be called periodically during execution loop
   */
  private applyRetentionPolicy(
    context: GraphContext,
    retentionPolicy?: RetentionPolicy,
    storageAdapter?: StorageAdapter
  ): void {
    if (!retentionPolicy) return;

    // Apply node results retention
    if (
      retentionPolicy.maxNodeResults &&
      context.nodeResults.size > retentionPolicy.maxNodeResults
    ) {
      const keepCritical = retentionPolicy.keepCriticalNodes !== false;
      const criticalNodes = new Set<string>();

      // Identify critical nodes to keep
      if (keepCritical) {
        for (const [nodeId, result] of context.nodeResults) {
          const node = this.nodes.get(nodeId);
          if (
            node &&
            (node.type === NodeType.START || node.type === NodeType.END || !result.success)
          ) {
            criticalNodes.add(nodeId);
          }
        }
      }

      // Sort nodes by timestamp (oldest first)
      const sortedNodes = Array.from(context.nodeResults.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      );

      const toRemove = sortedNodes.length - retentionPolicy.maxNodeResults;
      let removed = 0;

      for (const [nodeId] of sortedNodes) {
        if (removed >= toRemove) break;
        if (criticalNodes.has(nodeId)) continue;

        // Archive or discard based on strategy
        if (retentionPolicy.overflowStrategy === 'archive' && storageAdapter) {
          // Archive to storage (implementation would depend on storage adapter capabilities)
          this.logger.debug(`Archiving node result: ${nodeId}`);
        }

        context.nodeResults.delete(nodeId);
        removed++;
      }

      if (removed > 0) {
        this.logger.info(`Retention policy applied: removed ${removed} node results`);
      }
    }

    // Apply message history retention
    if (
      retentionPolicy.maxMessages &&
      context.messageHistory.length > retentionPolicy.maxMessages
    ) {
      const toRemove = context.messageHistory.length - retentionPolicy.maxMessages;

      if (retentionPolicy.overflowStrategy === 'archive' && storageAdapter) {
        this.logger.debug(`Archiving ${toRemove} messages`);
      }

      // Remove oldest messages
      context.messageHistory.splice(0, toRemove);
      this.logger.info(`Retention policy applied: removed ${toRemove} messages`);
    }
  }

  /**
   * Execute the graph
   *
   * @example New (preferred) style:
   * ```typescript
   * await graph.execute({ input: 'hello', agents: [...], signal, observer });
   * ```
   *
   * @example Legacy (deprecated) style:
   * ```typescript
   * await graph.execute(input, agents, signal, observer, ...);
   * ```
   */
  async execute(options: ExecuteOptions): Promise<GraphResult>;
  /** @deprecated Use `execute(ExecuteOptions)` instead */
  async execute(
    input: string,
    agents: Agent[],
    signal?: AbortSignal,
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    initialContext?: Record<string, unknown>,
    storageAdapter?: StorageAdapter,
    executionId?: string,
    retentionPolicy?: RetentionPolicy
  ): Promise<GraphResult>;
  async execute(
    inputOrOptions: string | ExecuteOptions,
    agents?: Agent[],
    signal?: AbortSignal,
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    initialContext?: Record<string, unknown>,
    storageAdapter?: StorageAdapter,
    executionId?: string,
    retentionPolicy?: RetentionPolicy
  ): Promise<GraphResult> {
    // Normalise arguments — support both options-object and positional styles
    let _input: string;
    let _agents: Agent[];
    let _signal: AbortSignal | undefined;
    let _observer: SocietyObserver | undefined;
    let _middlewareChain: MiddlewareChain | undefined;
    let _initialContext: Record<string, unknown> | undefined;
    let _storageAdapter: StorageAdapter | undefined;
    let _executionId: string | undefined;
    let _retentionPolicy: RetentionPolicy | undefined;

    if (typeof inputOrOptions === 'object' && 'input' in inputOrOptions) {
      const opts = inputOrOptions as ExecuteOptions;
      _input = opts.input;
      _agents = opts.agents;
      _signal = opts.signal;
      _observer = opts.observer;
      _middlewareChain = opts.middlewareChain;
      _initialContext = opts.initialContext;
      _storageAdapter = opts.storageAdapter;
      _executionId = opts.executionId;
      _retentionPolicy = opts.retentionPolicy;
    } else {
      _input = inputOrOptions as string;
      _agents = agents!;
      _signal = signal;
      _observer = observer;
      _middlewareChain = middlewareChain;
      _initialContext = initialContext;
      _storageAdapter = storageAdapter;
      _executionId = executionId;
      _retentionPolicy = retentionPolicy;
    }

    const startTime = Date.now();
    const execId = _executionId || `exec-${randomUUID()}`;

    // Validate agent references before execution
    this.validateAgentReferences(_agents);

    // Initialize sharedData with initialContext (globalContext from workflow)
    const sharedData = new Map<string, unknown>();
    if (_initialContext) {
      for (const [key, value] of Object.entries(_initialContext)) {
        sharedData.set(key, value);
      }
    }

    const context: GraphContext = {
      executionId: execId,
      input: _input,
      currentResult: _input,
      nodeResults: new Map(),
      sharedData,
      iterationCounts: new Map(),
      executionPath: [],
      startTime,
      signal: _signal,
      messageHistory: [],
      deadLetterQueue: [],
    };

    // Find START nodes
    const startNodes = Array.from(this.nodes.values()).filter((n) => n.type === NodeType.START);

    // Queue for iterative execution
    const queue: GraphNode[] = [...startNodes];

    // Save initial state
    if (_storageAdapter) {
      await this.saveState(context, queue, 'active', _storageAdapter);
    }

    return this.runExecutionLoop(
      context,
      queue,
      _agents,
      startTime,
      _observer,
      _middlewareChain,
      _storageAdapter,
      _retentionPolicy
    );
  }

  /**
   * Resume execution from a saved state
   *
   * @example New (preferred) style:
   * ```typescript
   * await graph.resume({ state, agents, humanInput, signal, observer });
   * ```
   *
   * @example Legacy (deprecated) style:
   * ```typescript
   * await graph.resume(state, agents, humanInput, signal, ...);
   * ```
   */
  async resume(options: ResumeOptions): Promise<GraphResult>;
  /** @deprecated Use `resume(ResumeOptions)` instead */
  async resume(
    state: WorkflowState,
    agents: Agent[],
    humanInput?: string,
    signal?: AbortSignal,
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    storageAdapter?: StorageAdapter,
    retentionPolicy?: RetentionPolicy
  ): Promise<GraphResult>;
  async resume(
    stateOrOptions: WorkflowState | ResumeOptions,
    agents?: Agent[],
    humanInput?: string,
    signal?: AbortSignal,
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    storageAdapter?: StorageAdapter,
    retentionPolicy?: RetentionPolicy
  ): Promise<GraphResult> {
    let _state: WorkflowState;
    let _agents: Agent[];
    let _humanInput: string | undefined;
    let _signal: AbortSignal | undefined;
    let _observer: SocietyObserver | undefined;
    let _middlewareChain: MiddlewareChain | undefined;
    let _storageAdapter: StorageAdapter | undefined;
    let _retentionPolicy: RetentionPolicy | undefined;

    if ('state' in stateOrOptions && 'agents' in stateOrOptions) {
      const opts = stateOrOptions as ResumeOptions;
      _state = opts.state;
      _agents = opts.agents;
      _humanInput = opts.humanInput;
      _signal = opts.signal;
      _observer = opts.observer;
      _middlewareChain = opts.middlewareChain;
      _storageAdapter = opts.storageAdapter;
      _retentionPolicy = opts.retentionPolicy;
    } else {
      _state = stateOrOptions as WorkflowState;
      _agents = agents!;
      _humanInput = humanInput;
      _signal = signal;
      _observer = observer;
      _middlewareChain = middlewareChain;
      _storageAdapter = storageAdapter;
      _retentionPolicy = retentionPolicy;
    }

    const startTime = Date.now(); // Reset timer or calculate generic delta

    // Hydrate Context
    const context: GraphContext = {
      executionId: _state.executionId,
      input: _state.input ?? '', // Restore original input from persisted state (#4)
      currentResult: '', // Will be updated below
      nodeResults: arrayToMap(_state.results),
      sharedData: arrayToMap(_state.sharedData),
      iterationCounts: arrayToMap(_state.iterationCounts),
      executionPath: _state.executionPath,
      startTime: _state.timestamp,
      signal: _signal,
      messageHistory: _state.messageHistory,
      deadLetterQueue: _state.deadLetterQueue || [],
    };

    // Reconstruct Queue
    const queue: GraphNode[] = [];
    for (const nodeId of _state.queue) {
      const node = this.nodes.get(nodeId);
      if (node) queue.push(node);
    }

    // If resuming from HUMAN pause, inject input
    if (_state.status === 'paused' && _state.waitingForNodeId && _humanInput) {
      const waitingNode = queue[0]; // Should be the first
      if (waitingNode && waitingNode.id === _state.waitingForNodeId) {
        // Treat human input as the result of this node
        context.currentResult = _humanInput;
        context.nodeResults.set(waitingNode.id, {
          agentId: 'human',
          taskId: waitingNode.id,
          output: _humanInput,
          success: true,
          timestamp: Date.now(),
          duration: 0,
        });

        // Remove human node from queue as it's "done"
        queue.shift();

        // Queue next nodes
        this.queueNextNodes(waitingNode, context, queue);
      }
    } else {
      // Just restore current result from last executed node
      if (context.executionPath.length > 0) {
        const lastNodeId = context.executionPath[context.executionPath.length - 1];
        const lastResult = context.nodeResults.get(lastNodeId);
        if (lastResult) context.currentResult = lastResult.output;
      }
    }

    // Continue Execution Loop (shared logic with execute)
    return this.runExecutionLoop(
      context,
      queue,
      _agents,
      startTime,
      _observer,
      _middlewareChain,
      _storageAdapter,
      _retentionPolicy
    );
  }

  /**
   * Helper to save state
   */
  private async saveState(
    context: GraphContext,
    queue: GraphNode[],
    status: WorkflowState['status'],
    adapter: StorageAdapter,
    waitingForNodeId?: string
  ): Promise<void> {
    const state: WorkflowState = {
      executionId: context.executionId,
      status,
      input: context.input, // Persist original input so resume() can restore it (#4)
      queue: queue.map((n) => n.id),
      results: mapToArray(context.nodeResults),
      sharedData: mapToArray(context.sharedData),
      iterationCounts: mapToArray(context.iterationCounts),
      executionPath: context.executionPath,
      messageHistory: context.messageHistory,
      deadLetterQueue: context.deadLetterQueue,
      timestamp: Date.now(),
      waitingForNodeId,
    };
    await adapter.save(context.executionId, state);
  }

  /**
   * Shared execution loop used by both execute() and resume()
   *
   * Processes the node queue, handles HUMAN pause nodes,
   * saves intermediate state, and returns the final result.
   */
  private async runExecutionLoop(
    context: GraphContext,
    queue: GraphNode[],
    agents: Agent[],
    startTime: number,
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    storageAdapter?: StorageAdapter,
    retentionPolicy?: RetentionPolicy
  ): Promise<GraphResult> {
    try {
      while (queue.length > 0) {
        const node = queue[0];

        // Handle HUMAN node — pause execution
        if (node.type === NodeType.HUMAN) {
          if (storageAdapter) {
            await this.saveState(context, queue, 'paused', storageAdapter, node.id);
          }
          return {
            status: 'paused',
            success: true,
            output: context.currentResult,
            nodeResults: context.nodeResults,
            executionPath: context.executionPath,
            duration: Date.now() - startTime,
            messages: context.messageHistory,
            metadata: { totalNodes: this.nodes.size },
            waitingForNodeId: node.id,
            executionId: context.executionId,
          };
        }

        await this.processNode(node, context, agents, observer, middlewareChain, queue);
        queue.shift();

        // Apply retention policy to prevent memory exhaustion
        this.applyRetentionPolicy(context, retentionPolicy, storageAdapter);

        // Save state after processing (granular snapshot)
        if (storageAdapter) {
          await this.saveState(context, queue, 'active', storageAdapter);
        }
      }

      // Mark completion
      if (storageAdapter) {
        await this.saveState(context, [], 'completed', storageAdapter);
      }

      return {
        status: 'completed',
        output: context.currentResult,
        success: true,
        nodeResults: context.nodeResults,
        executionPath: context.executionPath,
        duration: Date.now() - startTime,
        messages: context.messageHistory,
        metadata: { totalNodes: this.nodes.size },
        executionId: context.executionId,
      };
    } catch (error) {
      if (storageAdapter) {
        try {
          await this.saveState(context, [], 'failed', storageAdapter);
        } catch (_e) {
          // Ignore save error during failure
        }
      }
      return {
        status: 'failed',
        output: context.currentResult,
        success: false,
        nodeResults: context.nodeResults,
        executionPath: context.executionPath,
        duration: Date.now() - startTime,
        errors: [error as Error],
        messages: context.messageHistory,
        metadata: { totalNodes: this.nodes.size },
        executionId: context.executionId,
      };
    }
  }

  /**
   * Process a single node and queue next ones
   */
  private async processNode(
    node: GraphNode,
    context: GraphContext,
    agents: Agent[],
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    queue?: GraphNode[]
  ): Promise<void> {
    // Check cancellation
    if (context.signal?.aborted) {
      throw new Error('Execution cancelled');
    }

    // Add to execution path
    context.executionPath.push(node.id);
    this.logger.debug(`Processing node: ${node.id} (${node.type})`);

    // Trace Hook: Node Start
    if (observer?.onNodeStart) {
      observer.onNodeStart(node.id, node.type, context.currentResult);
    }
    const startTime = Date.now();

    let result: string = context.currentResult;

    try {
      switch (node.type) {
        case NodeType.START:
          result = context.input;
          break;

        case NodeType.END:
          context.currentResult = result;
          if (observer?.onNodeEnd) {
            observer.onNodeEnd(node.id, result, Date.now() - startTime);
          }
          return;

        case NodeType.AGENT:
          result = await this.executeAgentNode(node, context, agents, observer, middlewareChain);
          break;

        case NodeType.PARALLEL:
          result = await this.executeParallelNode(node, context, agents, observer, middlewareChain);
          break;

        case NodeType.AGGREGATE:
          result = await this.executeAggregateNode(node, context);
          break;

        case NodeType.CONDITION:
          await this.executeConditionNode(node, context, agents, observer, middlewareChain, queue);
          if (observer?.onNodeEnd) {
            observer.onNodeEnd(node.id, context.currentResult, Date.now() - startTime);
          }
          return; // Condition node handles its own queueing

        case NodeType.TRANSFORM:
          result = this.executeTransformNode(node, context);
          break;

        case NodeType.LOOP:
          result = await this.executeLoopNode(
            node,
            context,
            agents,
            observer,
            middlewareChain,
            queue
          );
          if (observer?.onNodeEnd) {
            observer.onNodeEnd(node.id, result, Date.now() - startTime);
          }
          return; // Loop node handles its own queueing

        case NodeType.COLLABORATIVE:
          result = await this.executeCollaborativeNode(node, context, agents, middlewareChain);
          break;
      }

      // Store result
      context.currentResult = result;
      context.nodeResults.set(node.id, {
        agentId: node.agentId || node.id,
        taskId: node.id,
        output: result,
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      });

      if (observer?.onNodeEnd) {
        observer.onNodeEnd(node.id, result, Date.now() - startTime);
      }

      // Queue next nodes
      if (queue) {
        this.queueNextNodes(node, context, queue);
      }
    } catch (error) {
      if (observer?.onNodeError) {
        observer.onNodeError(node.id, error as Error);
      }
      throw error;
    }
  }

  /**
   * Execute an AGENT node
   */
  private async executeAgentNode(
    node: GraphNode,
    context: GraphContext, // Need to make sure GraphContext matches ExecutionContext requirements or adapt
    agents: Agent[],
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain
  ): Promise<string> {
    const agent = agents.find((a) => a.id === node.agentId);
    if (!agent) {
      throw new ProcessingFailedError(`Agent not found: ${node.agentId}`);
    }

    // Observer: Agent Start
    if (observer) observer.onAgentStart(agent.id, agent.model.name(), context.currentResult);

    // Adapt GraphContext to ExecutionContext
    const taskResults = new Map<string, TaskResult[]>();
    for (const [, result] of context.nodeResults) {
      const existing = taskResults.get(result.agentId) || [];
      existing.push(result);
      taskResults.set(result.agentId, existing);
    }

    const execContext = {
      input: context.input,
      sharedData: context.sharedData,
      taskResults,
      messageHistory: context.messageHistory,
      metadata: {},
    };

    let taskResult: TaskResult;

    // Check if agent should execute in isolated worker thread
    if (agent.executionMode === 'isolated') {
      // Use the engine-level IsolatedWorkerPool — created once, not per-call (#8)
      const workerPool = this.getIsolatedPool();

      taskResult = await withRetry(
        async () => {
          const result = await workerPool.execute({
            agent,
            input: context.currentResult,
            context: execContext,
            options: {
              taskId: node.id,
              instructions: node.metadata?.instructions as string,
              promptTemplate: node.metadata?.promptTemplate as string,
            },
          });

          if (!result.result.success) {
            throw result.result.error || new Error('Agent execution failed in isolated worker');
          }

          return result.result;
        },
        node.retryOptions,
        context.signal
      );
    } else {
      // Standard execution using AgentExecutor
      const executor = new AgentExecutor(agent);

      taskResult = await withRetry(
        async () => {
          const result = await executor.execute(context.currentResult, execContext, {
            taskId: node.id,
            instructions: node.metadata?.instructions as string,
            promptTemplate: node.metadata?.promptTemplate as string,
            outputSchema: node.outputSchema,
            loopConfig:
              node.loopConfig ??
              (node.maxIterations ? { maxIterations: node.maxIterations } : undefined),
            signal: context.signal,
            middlewareChain,
          });

          if (!result.success) {
            throw result.error || new Error('Agent execution failed');
          }

          return result;
        },
        node.retryOptions,
        context.signal
      );
    }

    if (!taskResult.success) {
      if (observer) observer.onAgentError(agent.id, agent.model.name(), taskResult.error!);
      throw taskResult.error!;
    }

    if (observer) observer.onAgentComplete(agent.id, agent.model.name(), taskResult.output);
    if (observer?.onTaskEnd) observer.onTaskEnd(node.id, taskResult);

    return taskResult.output;
  }

  /**
   * Clone sharedData for isolation in parallel execution
   * Uses structuredClone for deep copy to prevent race conditions
   */
  private cloneSharedData(sharedData: Map<string, unknown>): Map<string, unknown> {
    const cloned = new Map<string, unknown>();
    for (const [key, value] of sharedData.entries()) {
      try {
        // Use structuredClone if available (Node.js 17+), otherwise fallback to JSON
        cloned.set(
          key,
          typeof structuredClone !== 'undefined'
            ? structuredClone(value)
            : JSON.parse(JSON.stringify(value))
        );
      } catch (error) {
        // If value is not cloneable, use as-is (but log warning)
        this.logger.info(`Cannot clone sharedData key '${key}': ${(error as Error).message}`);
        cloned.set(key, value);
      }
    }
    return cloned;
  }

  /**
   * Merge sharedData modifications from parallel branches
   * Implements Last-Write-Wins strategy for conflict resolution
   */
  private mergeSharedData(
    target: Map<string, unknown>,
    sources: Map<string, unknown>[],
    detectConflicts: boolean = false
  ): void {
    const modifications = new Map<string, { count: number; values: unknown[] }>();

    // Track all modifications
    for (const source of sources) {
      for (const [key, value] of source.entries()) {
        if (!target.has(key) || target.get(key) !== value) {
          const existing = modifications.get(key) || { count: 0, values: [] };
          existing.count++;
          existing.values.push(value);
          modifications.set(key, existing);
        }
      }
    }

    // Apply modifications and detect conflicts
    for (const [key, mod] of modifications.entries()) {
      if (detectConflicts && mod.count > 1) {
        // Multiple branches modified the same key - potential conflict
        this.logger.info(
          `Conflict detected for sharedData key '${key}': ${mod.count} branches modified it`
        );
      }
      // Last-Write-Wins: use the last value
      target.set(key, mod.values[mod.values.length - 1]);
    }
  }

  /**
   * Execute a PARALLEL node with concurrency control.
   * Each parallel branch gets an isolated copy of sharedData to prevent race conditions.
   * Uses AgentExecutor (not agent.model.process directly) so middleware, tools,
   * memory, schema validation and retry logic all apply (#9).
   */
  private async executeParallelNode(
    node: GraphNode,
    context: GraphContext,
    agents: Agent[],
    _observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain
  ): Promise<string> {
    const nodeAgents = node.agentIds!.map((id) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) {
        throw new ProcessingFailedError(`Agent not found: ${id}`);
      }
      return agent;
    });

    const results: TaskResult[] = [];
    const sharedDataSnapshots: Map<string, unknown>[] = [];

    // Submit all tasks to the engine-level pool with isolated contexts
    await Promise.all(
      nodeAgents.map((agent) => {
        // Create isolated snapshot of sharedData for this branch
        const isolatedSharedData = this.cloneSharedData(context.sharedData);

        return this.parallelPool.submit(() =>
          withRetry(
            async () => {
              // Create isolated context for this parallel branch
              const isolatedContext = {
                ...context,
                sharedData: isolatedSharedData,
              };

              // Adapt GraphContext to ExecutionContext
              const taskResultsMap = new Map<string, TaskResult[]>();
              for (const [, r] of isolatedContext.nodeResults) {
                const existing = taskResultsMap.get(r.agentId) || [];
                existing.push(r);
                taskResultsMap.set(r.agentId, existing);
              }

              const execContext = {
                input: isolatedContext.input,
                sharedData: isolatedSharedData,
                taskResults: taskResultsMap,
                messageHistory: isolatedContext.messageHistory,
                metadata: {},
              };

              // Use AgentExecutor so all agent capabilities apply (#9)
              const executor = new AgentExecutor(agent);
              const stepResult = await executor.execute(
                isolatedContext.currentResult,
                execContext,
                {
                  taskId: node.id,
                  instructions: node.metadata?.instructions as string,
                  promptTemplate: node.metadata?.promptTemplate as string,
                  outputSchema: node.outputSchema,
                  signal: isolatedContext.signal,
                  middlewareChain,
                }
              );

              if (!stepResult.success) {
                throw stepResult.error || new Error(`Parallel agent ${agent.id} failed`);
              }

              results.push(stepResult);
              sharedDataSnapshots.push(isolatedSharedData);

              return stepResult;
            },
            node.retryOptions,
            context.signal
          )
        );
      })
    );

    // Merge all sharedData modifications back to main context
    // Enable conflict detection to warn about potential race conditions
    this.mergeSharedData(context.sharedData, sharedDataSnapshots, true);

    // Concatenate results
    return results.map((r) => r.output).join('\n\n');
  }

  /**
   * Execute an AGGREGATE node.
   * Only collects results from nodes that have a direct edge into this node (#5).
   * Collecting all nodeResults would include unrelated branches.
   */
  private async executeAggregateNode(node: GraphNode, context: GraphContext): Promise<string> {
    // Find the set of direct predecessors by scanning every node's outgoing edges
    const predecessorIds = new Set<string>();
    for (const [fromId, edgeList] of this.edges) {
      for (const edge of edgeList) {
        if (edge.to === node.id) {
          predecessorIds.add(fromId);
        }
      }
    }

    // Collect only the results produced by those predecessor nodes
    const results: TaskResult[] = [];
    for (const predId of predecessorIds) {
      const result = context.nodeResults.get(predId);
      if (result) results.push(result);
    }

    // Fall back to all results if no predecessors found (e.g. programmatic use)
    if (results.length === 0) {
      results.push(...Array.from(context.nodeResults.values()));
    }

    return node.aggregator!(results);
  }

  /**
   * Execute a CONDITION node.
   * Evaluates the condition, stores the result in nodeResults (#2),
   * then queues exactly one downstream branch.
   */
  private async executeConditionNode(
    node: GraphNode,
    context: GraphContext,
    _agents: Agent[],
    _observer?: SocietyObserver,
    _middlewareChain?: MiddlewareChain,
    queue?: GraphNode[]
  ): Promise<string> {
    // Track how many times this condition node has been visited (for loop guard)
    const iteration = (context.iterationCounts.get(node.id) || 0) + 1;
    context.iterationCounts.set(node.id, iteration);

    // If maxIterations is set and exceeded, force the true (exit) branch so the
    // cycle terminates gracefully instead of running forever.
    const maxIterations = node.maxIterations;
    const limitReached = maxIterations != null && iteration > maxIterations;

    if (limitReached) {
      this.logger.info(
        `Condition node ${node.id} reached maxIterations (${maxIterations}). Forcing exit (true) branch.`
      );
    }

    const conditionResult = limitReached ? true : node.condition!(context.currentResult, context);

    // Store result so downstream AGGREGATE / history nodes can reference it (#2)
    context.nodeResults.set(node.id, {
      agentId: node.id,
      taskId: node.id,
      output: String(conditionResult),
      success: true,
      timestamp: Date.now(),
      duration: 0,
    });

    // Find edges from this node
    const edges = this.edges.get(node.id) || [];

    // Check if this is a simple true/false branching node
    const trueEdge = edges.find((e) => e.label === 'true');
    const falseEdge = edges.find((e) => e.label === 'false');

    if (trueEdge || falseEdge) {
      // Simple true/false branching
      const nextNodeId = conditionResult ? trueEdge?.to : falseEdge?.to;

      if (nextNodeId) {
        const nextNode = this.nodes.get(nextNodeId);
        if (nextNode && queue) {
          queue.push(nextNode);
        }
      }
    } else {
      // Complex conditional routing with edge conditions
      if (queue) {
        this.queueNextNodes(node, context, queue);
      }
    }

    return context.currentResult;
  }

  /**
   * Execute a COLLABORATIVE node with advanced message routing
   */
  private async executeCollaborativeNode(
    node: GraphNode,
    context: GraphContext,
    agents: Agent[],
    middlewareChain?: MiddlewareChain
  ): Promise<string> {
    const maxIterations = node.maxIterations || 5;
    const nodeAgents = (node.agentIds || [])
      .map((id) => agents.find((a) => a.id === id))
      .filter((a): a is Agent => !!a);

    if (nodeAgents.length === 0) {
      throw new ProcessingFailedError(`No valid agents found for collaborative node ${node.id}`);
    }

    let iteration = 0;

    this.logger.info(
      `Starting collaborative session for node ${node.id} with ${nodeAgents.length} agents`
    );

    // Default router: broadcast to all except sender, unless targeted
    const defaultRouter = (message: Message, sender: Agent, allAgents: Agent[]): string[] => {
      // If message has specific target (not broadcast), route only to that target
      if (message.to && message.to !== 'broadcast') {
        const target = allAgents.find((a) => a.id === message.to);
        return target ? [target.id] : [];
      }
      // Otherwise broadcast to all other agents
      return allAgents.filter((a) => a.id !== sender.id).map((a) => a.id);
    };

    const messageRouter = node.messageRouter || defaultRouter;

    // Track results for completion condition
    const stepResults: TaskResult[] = [];

    while (iteration < maxIterations) {
      iteration++;
      this.logger.debug(`Collaborative iteration ${iteration}/${maxIterations}`);

      // Each agent speaks in turn
      for (const agent of nodeAgents) {
        if (context.signal?.aborted) throw new Error('Execution cancelled');

        // Build the collaborative prompt with relevant message history
        const relevantMessages = this.getRelevantMessages(agent.id, context.messageHistory);
        const prompt = this.buildCollaborativePrompt(
          agent,
          context.currentResult,
          context,
          node,
          relevantMessages
        );

        // Use AgentExecutor so middleware, tools, memory and validation are honoured
        const executionContext = this.buildExecutionContext(context);
        const executor = new AgentExecutor(agent);
        const agentResult = await executor.execute(prompt, executionContext, {
          taskId: node.id,
          signal: context.signal,
          middlewareChain,
        });
        const content = agentResult.output;

        // Parse message target if agent specifies one
        // Format: "@agentId: message" or just "message" for broadcast
        const targetMatch = content.match(/^@(\w+):\s*/);
        let targetAgentId = 'broadcast';
        let actualContent = content;

        if (targetMatch) {
          targetAgentId = targetMatch[1];
          actualContent = content.substring(targetMatch[0].length);
        }

        // Create message
        const message: Message = {
          messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          from: agent.id,
          to: targetAgentId,
          content: actualContent,
          type: 'data',
          timestamp: Date.now(),
        };

        // Determine recipients using router
        const recipients = messageRouter(message, agent, nodeAgents, context);

        // Store message with recipients metadata
        context.messageHistory.push({
          ...message,
          metadata: { recipients, iteration },
        });

        this.logger.debug(
          `Agent ${agent.id} → ${targetAgentId === 'broadcast' ? 'all' : targetAgentId} ` +
            `(actual: ${recipients.join(', ')})`
        );

        // Record result
        stepResults.push({
          agentId: agent.id,
          taskId: node.id,
          output: content,
          success: true,
          timestamp: Date.now(),
          duration: 0,
          metadata: { iteration, recipients, targetAgentId },
        });

        // Update shared data (only for broadcast messages to respect privacy)
        if (targetAgentId === 'broadcast') {
          context.sharedData.set(`last_message_${agent.id}`, content);
        }

        // Check completion condition immediately after each agent
        if (node.completionCondition) {
          if (node.completionCondition(stepResults, iteration)) {
            this.logger.info(`Collaborative node ${node.id} completion condition met`);
            // Break the agent loop
            return context.messageHistory[context.messageHistory.length - 1]?.content || '';
          }
        }
      }

      // Check completion condition at end of iteration (fallback if needed, but redundant if checked inside)
      if (node.completionCondition) {
        if (node.completionCondition(stepResults, iteration)) {
          this.logger.info(
            `Collaborative node ${node.id} completion condition met (end of iteration)`
          );
          break;
        }
      }
    }

    // Return the last message as the result
    return context.messageHistory[context.messageHistory.length - 1]?.content || '';
  }

  /**
   * Adapt a GraphContext to the ExecutionContext shape expected by AgentExecutor.
   */
  private buildExecutionContext(context: GraphContext): ExecutionContext {
    const taskResults = new Map<string, TaskResult[]>();
    for (const result of context.nodeResults.values()) {
      const existing = taskResults.get(result.agentId) || [];
      existing.push(result);
      taskResults.set(result.agentId, existing);
    }
    return {
      input: context.input,
      sharedData: context.sharedData,
      taskResults,
      messageHistory: context.messageHistory,
      metadata: {},
    };
  }

  /**
   * Get relevant messages for an agent (messages sent to them or broadcast)
   */
  private getRelevantMessages(agentId: string, messageHistory: Message[]): Message[] {
    return messageHistory.filter((msg) => {
      // Include if message is to this agent specifically
      if (msg.to === agentId) return true;
      // Include if message is broadcast and not from this agent
      if (msg.to === 'broadcast' && msg.from !== agentId) return true;
      // Include if recipients metadata includes this agent
      if (msg.metadata?.recipients && (msg.metadata.recipients as string[]).includes(agentId))
        return true;
      return false;
    });
  }

  /**
   * Build a collaborative prompt with message history
   */
  private buildCollaborativePrompt(
    agent: Agent,
    input: string,
    context: GraphContext,
    node: GraphNode,
    relevantMessages: Message[]
  ): string {
    const basePrompt = this.buildPrompt(agent, input, context, node, { includeHistory: false });

    if (relevantMessages.length === 0) {
      return basePrompt + '\n\nYou are starting a collaborative discussion. Share your thoughts.';
    }

    const messageLog = relevantMessages
      .map((msg) => {
        const prefix =
          msg.to === agent.id
            ? `[${msg.from} → you]`
            : msg.to === 'broadcast'
              ? `[${msg.from} → all]`
              : `[${msg.from} → ${msg.to}]`;
        return `${prefix}: ${msg.content}`;
      })
      .join('\n');

    return (
      basePrompt +
      '\n\n=== Message History ===\n' +
      messageLog +
      '\n\n=== Your Turn ===\n' +
      'Respond to the discussion. To address a specific agent, start with "@agentId: your message"'
    );
  }

  /**
   * Execute a TRANSFORM node
   */
  private executeTransformNode(node: GraphNode, context: GraphContext): string {
    return node.transformer!(context.currentResult, context);
  }

  /**
   * Execute a LOOP node.
   *
   * Design: a LOOP node acts as a gatekeeper.
   *   - On each visit it checks whether to continue iterating.
   *   - If yes: queue the loop body (outgoing edges) AND re-queue the LOOP node
   *     itself so it will be visited again after the body completes (#1).
   *   - If no: let execution fall through to whatever follows the loop body's
   *     terminal path (handled by queueNextNodes on the final body node).
   */
  private async executeLoopNode(
    node: GraphNode,
    context: GraphContext,
    _agents: Agent[],
    _observer?: SocietyObserver,
    _middlewareChain?: MiddlewareChain,
    queue?: GraphNode[]
  ): Promise<string> {
    const maxIterations = node.maxIterations || 10;
    let iteration = context.iterationCounts.get(node.id) || 0;

    // Check user-defined loop termination condition first
    if (node.loopCondition && !node.loopCondition(iteration, context.currentResult, context)) {
      this.logger.info(
        `Loop node ${node.id} terminated by loopCondition at iteration ${iteration}`
      );
      return context.currentResult;
    }

    if (iteration < maxIterations) {
      iteration++;
      context.iterationCounts.set(node.id, iteration);

      if (queue) {
        // Queue loop body (child nodes)
        this.queueNextNodes(node, context, queue);
        // Re-queue the LOOP node itself so it runs again after the body (#1)
        queue.push(node);
      }
    } else {
      this.logger.info(`Loop node ${node.id} reached maxIterations (${maxIterations})`);
    }

    return context.currentResult;
  }

  /**
   * Queue next nodes based on edge conditions
   */
  private queueNextNodes(node: GraphNode, context: GraphContext, queue: GraphNode[]): void {
    const edges = this.edges.get(node.id) || [];

    for (const edge of edges) {
      // Check edge condition if present
      if (edge.condition && !edge.condition(context.currentResult, context)) {
        continue;
      }

      const nextNode = this.nodes.get(edge.to);
      if (nextNode) {
        queue.push(nextNode);
      }
    }
  }

  /**
   * Build prompt for an agent
   *
   * This method constructs the final prompt by:
   * 1. Starting with a template (node > role > default)
   * 2. Injecting instructions, memory, and tools context
   * 3. Replacing all placeholders with actual values
   * 4. Cleaning up any unused placeholders
   */
  private buildPrompt(
    agent: Agent,
    input: string,
    context: GraphContext,
    node?: GraphNode,
    options: { includeHistory?: boolean } = { includeHistory: true }
  ): string {
    // Priority: Node metadata template > Agent role template > Default
    let template =
      (node?.metadata?.promptTemplate as string) ||
      agent.role.promptTemplate ||
      `System: {system}
Context: {context}
Memory: {memory}
Tools: {tools}
Shared Data: {sharedData}

History:
{history}

Input: {input}`;

    // Inject instructions if present in metadata
    if (node?.metadata?.instructions) {
      if (template.includes('{instructions}')) {
        template = template.replace(/{instructions}/g, node.metadata.instructions as string);
      } else {
        template = `${node.metadata.instructions}\n\n${template}`;
      }
    }

    // Memory contextualization
    const memoryContext = (node?.metadata?.memoryContext as string) || '';
    if (template.includes('{memory}')) {
      template = template.replace(/{memory}/g, memoryContext);
    } else if (memoryContext) {
      template = `Relevant Memory:\n${memoryContext}\n\n${template}`;
    }

    // Tools contextualization
    const toolsContext = (node?.metadata?.toolsContext as string) || '';
    if (template.includes('{tools}')) {
      template = template.replace(/{tools}/g, toolsContext);
    } else if (toolsContext) {
      template = `Available Tools:\n${toolsContext}\n\n${template}`;
    }

    // Replace main placeholders
    let prompt = template
      .replace(/{input}/g, input)
      .replace(/{system}/g, agent.role.systemPrompt)
      .replace(/{context}/g, JSON.stringify(Object.fromEntries(context.sharedData)))
      .replace(/{sharedData}/g, JSON.stringify(Object.fromEntries(context.sharedData)))
      .replace(
        /{history}/g,
        Array.from(context.nodeResults.entries())
          .map(([id, result]) => `[${id}]: ${result.output}`)
          .join('\n') || '(no previous results)'
      );

    // Handle message history for collaborative nodes
    if (options.includeHistory && context.messageHistory && context.messageHistory.length > 0) {
      const messages = context.messageHistory
        .map((msg) => `[${msg.from} -> ${msg.to}]: ${msg.content}`)
        .join('\n');
      if (prompt.includes('{messages}')) {
        prompt = prompt.replace(/{messages}/g, messages);
      } else {
        prompt += `\n\nRecent messages:\n${messages}`;
      }
    }

    // Clean up any remaining unused placeholders to avoid confusing the model
    // This handles cases where custom templates have placeholders that weren't replaced
    prompt = prompt
      .replace(/{instructions}/g, '')
      .replace(/{memory}/g, '')
      .replace(/{tools}/g, '')
      .replace(/{messages}/g, '')
      // Remove empty sections created by cleaning placeholders
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple+ newlines with double
      .trim();

    return prompt;
  }

  /**
   * Get (or lazily create) the engine-level IsolatedWorkerPool (#8).
   */
  private getIsolatedPool(): IsolatedWorkerPool {
    if (!this.isolatedPool) {
      this.isolatedPool = new IsolatedWorkerPool(4);
    }
    return this.isolatedPool;
  }

  /**
   * Release engine-level resources (e.g. the IsolatedWorkerPool).
   * Call this when you are done with the engine to avoid resource leaks (#8).
   */
  async dispose(): Promise<void> {
    if (this.isolatedPool) {
      await this.isolatedPool.shutdown();
      this.isolatedPool = null;
    }
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
  build(): ExecutionEngine {
    this.validateGraph();
    return new ExecutionEngine(this.nodes, this.edges);
  }

  /**
   * Validate graph structure (Cycles, Orphans)
   */
  private validateGraph(): void {
    // 1. Build Adjacency List
    const adj = new Map<string, string[]>();
    this.edges.forEach((e) => {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from)!.push(e.to);
    });

    const nodesMap = new Map(this.nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // DFS for Cycle Detection
    const detectCycle = (nodeId: string, path: string[]): string[] | null => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const res = detectCycle(neighbor, path);
          if (res) return res;
        } else if (recursionStack.has(neighbor)) {
          // Cycle detected, extract the loop
          const startIndex = path.indexOf(neighbor);
          return path.slice(startIndex);
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return null;
    };

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        const cycle = detectCycle(node.id, []);
        if (cycle) {
          // Check if cycle is safe. A cycle is bounded (safe) when:
          //   1. It contains a dedicated LOOP node (which always has maxIterations), OR
          //   2. It contains a CONDITION node whose maxIterations property is set
          //      (the CONDITION node acts as the loop guard and will break the cycle).
          const isSafe = cycle.some((id) => {
            const n = nodesMap.get(id);
            if (!n) return false;
            if (n.type === NodeType.LOOP) return true;
            if (n.type === NodeType.CONDITION && n.maxIterations != null) return true;
            return false;
          });

          if (!isSafe) {
            throw new Error(
              `Potential Infinite Loop Detected: ${cycle.join(' -> ')} -> ${cycle[0]}. ` +
                `To fix, ensure at least one node in the cycle has 'maxIterations' set or is a LOOP node.`
            );
          }
        }
      }
    }
  }
}
