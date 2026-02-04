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

import { Agent, AIModel, Message, SocietyObserver, TaskResult } from '../../core/types';
import { getLogger } from '../../observability/logger';
import { WorkerPool } from '../../utils/worker-pool';
import { ProcessingFailedError } from '../../core/errors';
import { StructuredOutputValidator, JSONSchema } from '../../capabilities/validation';
import { MiddlewareChain, MiddlewareContext } from '../../core/middleware';

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
}

// ============================================================================
// EXECUTION ENGINE (Recursive)
// ============================================================================

/**
 * Adapter allowing a ExecutionEngine to be used as an AI Model (Agent).
 * This enables hierarchical societies (societies within societies).
 */
export class EngineAsModel implements AIModel {
  private logger = getLogger();

  constructor(
    private graph: ExecutionEngine,
    private agents: Agent[],
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
    this.logger.info(`Recursive Engine '${this.name()}' started execution`);

    try {
      // Execute without initialContext by default (can be extended later)
      const result = await this.graph.execute(
        input,
        this.agents,
        signal,
        undefined,
        undefined,
        undefined
      );

      if (!result.success) {
        const error = result.errors?.[0] || new Error('Unknown error in recursive engine');
        throw error;
      }

      this.logger.info(`Recursive Engine '${this.name()}' completed execution`);
      return result.output;
    } catch (error) {
      this.logger.error(`Recursive Engine '${this.name()}' failed: ${(error as Error).message}`);
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
// EXECUTION ENGINE
// ============================================================================

/**
 * Graph-based execution engine
 */
export class ExecutionEngine {
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
  async execute(
    input: string,
    agents: Agent[],
    signal?: AbortSignal,
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain,
    initialContext?: Record<string, unknown>
  ): Promise<GraphResult> {
    const startTime = Date.now();

    // Initialize sharedData with initialContext (globalContext from workflow)
    const sharedData = new Map<string, unknown>();
    if (initialContext) {
      for (const [key, value] of Object.entries(initialContext)) {
        sharedData.set(key, value);
      }
    }

    const context: GraphContext = {
      input,
      currentResult: input,
      nodeResults: new Map(),
      sharedData,
      iterationCounts: new Map(),
      executionPath: [],
      startTime,
      signal,
      messageHistory: [],
    };

    try {
      // Find START nodes
      const startNodes = Array.from(this.nodes.values()).filter((n) => n.type === NodeType.START);

      // Execute from each START node (usually just one)
      for (const startNode of startNodes) {
        await this.executeNode(startNode, context, agents, observer, middlewareChain);
      }

      const duration = Date.now() - startTime;

      return {
        output: context.currentResult,
        success: true,
        nodeResults: context.nodeResults,
        executionPath: context.executionPath,
        duration,
        messages: context.messageHistory,
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
        messages: context.messageHistory,
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
    agents: Agent[],
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain
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
        result = await this.executeAgentNode(node, context, agents, observer, middlewareChain);
        break;

      case NodeType.PARALLEL:
        result = await this.executeParallelNode(node, context, agents);
        break;

      case NodeType.AGGREGATE:
        result = await this.executeAggregateNode(node, context);
        break;

      case NodeType.CONDITION:
        result = await this.executeConditionNode(node, context, agents, observer, middlewareChain);
        return; // Condition node handles its own routing

      case NodeType.TRANSFORM:
        result = this.executeTransformNode(node, context);
        break;

      case NodeType.LOOP:
        result = await this.executeLoopNode(node, context, agents, observer, middlewareChain);
        break;

      case NodeType.COLLABORATIVE:
        result = await this.executeCollaborativeNode(node, context, agents);
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
      duration: 0,
    });

    // Find and execute next nodes
    await this.executeNextNodes(node, context, agents, observer, middlewareChain);
  }

  /**
   * Execute an AGENT node
   */
  private async executeAgentNode(
    node: GraphNode,
    context: GraphContext,
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

    // Middleware Context
    const mwContext: MiddlewareContext = {
      input: context.currentResult,
      processedInput: context.currentResult,
      metadata: new Map(),
      agentId: agent.id,
      signal: context.signal,
      startTime: Date.now(),
    };

    // Core Logic Wrapped for Middleware
    const coreExecution = async (
      mwCtx: MiddlewareContext
    ): Promise<{ output: string; continue: boolean }> => {
      const input =
        typeof mwCtx.processedInput === 'string'
          ? mwCtx.processedInput
          : String(mwCtx.processedInput || '');

      // 1. Memory Retrieval
      if (agent.memory) {
        const summary = await agent.memory.retrieve(input);
        if (!node.metadata) node.metadata = {};
        const summaryArray = Array.isArray(summary) ? summary : [summary];
        node.metadata.memoryContext = summaryArray
          .map((m: string | { content?: string }) => (typeof m === 'string' ? m : m.content || ''))
          .join('\n---\n');
      }

      // 2. Tool Definitions Injection
      if (agent.tools && agent.tools.length > 0) {
        if (!node.metadata) node.metadata = {};
        node.metadata.toolsContext =
          JSON.stringify(
            agent.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
            null,
            2
          ) +
          '\n\nTo use a tool, output a JSON block wrapped in <tool_code> tags, like this:\n<tool_code>\n{"name": "tool_name", "arguments": {"param1": "value"}}\n</tool_code>\nWait for the tool result before continuing.';
      }

      let prompt = this.buildPrompt(agent, input, context, node);
      let result = await agent.model.process(prompt, context.signal);

      // 3. Tool Execution Loop
      const MAX_TOOL_ITERATIONS = 5;
      let iterations = 0;

      while (
        iterations < MAX_TOOL_ITERATIONS &&
        agent.tools &&
        agent.tools.length > 0 &&
        typeof result === 'string'
      ) {
        const toolMatch = result.match(/<tool_code>([\s\S]*?)<\/tool_code>/);
        if (!toolMatch) break;

        iterations++;
        const toolBlock = toolMatch[1];
        let toolOutputInfo = '';

        try {
          const toolCall = JSON.parse(toolBlock);
          const toolName = toolCall.name;
          const tool = agent.tools.find((t) => t.name === toolName);

          if (!tool) {
            toolOutputInfo = `System: Error: Tool "${toolName}" not found. Available tools: ${agent.tools.map((t) => t.name).join(', ')}`;
          } else {
            this.logger.info(`Agent ${agent.id} executing tool ${toolName}`);
            try {
              const output = await tool.execute(toolCall.arguments || {}, {
                agentId: agent.id,
                sharedData: context.sharedData,
                signal: context.signal,
              });
              toolOutputInfo = `System: Tool "${toolName}" returned: ${JSON.stringify(output)}`;
            } catch (err) {
              toolOutputInfo = `System: Error executing tool "${toolName}": ${(err as Error).message}`;
            }
          }
        } catch (err) {
          toolOutputInfo = `System: Error parsing tool call JSON. Please use format: {"name": "tool_name", "arguments": {...}}`;
        }

        prompt += `\n${result}\n${toolOutputInfo}`;
        result = await agent.model.process(prompt, context.signal);
      }

      // 4. Validation
      if (node.outputSchema) {
        const validator = new StructuredOutputValidator(node.outputSchema);
        try {
          const validationResult = validator.validate(result);
          if (!validationResult.valid) {
            const errorMsg = validationResult.errors
              ? validationResult.errors.map((e) => e.message).join(', ')
              : 'Unknown validation error';
            throw new ProcessingFailedError(`Validation failed for node ${node.id}: ${errorMsg}`);
          }
        } catch (e) {
          this.logger.error(`Validation error in node ${node.id}: ${(e as Error).message}`);
          throw e;
        }
      }

      // 5. Memory Storage
      if (agent.memory) {
        await agent.memory.add(`User Input: ${mwCtx.input}`);
        await agent.memory.add(`Assistant Response: ${result}`);
      }

      return { output: result as string, continue: true };
    };

    let output: string;
    try {
      if (middlewareChain) {
        const res = await middlewareChain.execute(mwContext, coreExecution);
        output = res.output;
      } else {
        const res = await coreExecution(mwContext);
        output = res.output;
      }
    } catch (err) {
      if (observer) observer.onAgentError(agent.id, agent.model.name(), err as Error);
      throw err;
    }

    if (observer) observer.onAgentComplete(agent.id, agent.model.name(), output);
    if (observer?.onTaskEnd)
      observer.onTaskEnd(node.id, {
        taskId: node.id,
        agentId: agent.id,
        output: output,
        success: true,
        timestamp: Date.now(),
      });

    return output;
  }

  /**
   * Execute a PARALLEL node
   */
  private async executeParallelNode(
    node: GraphNode,
    context: GraphContext,
    agents: Agent[]
  ): Promise<string> {
    const nodeAgents = node.agentIds!.map((id) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) {
        throw new ProcessingFailedError(`Agent not found: ${id}`);
      }
      return agent;
    });

    const pool = new WorkerPool(nodeAgents.length);
    const results: TaskResult[] = [];

    // Submit all tasks to the pool
    await Promise.all(
      nodeAgents.map((agent) =>
        pool.submit(async () => {
          const prompt = this.buildPrompt(agent, context.currentResult, context, node);
          const result = await agent.model.process(prompt, context.signal);

          const stepResult: TaskResult = {
            agentId: agent.id,
            taskId: node.id,
            output: result,
            success: true,
            timestamp: Date.now(),
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
    agents: Agent[],
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain
  ): Promise<string> {
    const conditionResult = node.condition!(context.currentResult, context);

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
        if (nextNode) {
          await this.executeNode(nextNode, context, agents, observer, middlewareChain);
        }
      }
    } else {
      // Complex conditional routing with edge conditions
      // Use executeNextNodes which checks edge conditions
      await this.executeNextNodes(node, context, agents, observer, middlewareChain);
    }

    return context.currentResult;
  }

  /**
   * Execute a COLLABORATIVE node with advanced message routing
   */
  private async executeCollaborativeNode(
    node: GraphNode,
    context: GraphContext,
    agents: Agent[]
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

        // Build prompt with relevant message history for this agent
        const relevantMessages = this.getRelevantMessages(agent.id, context.messageHistory);
        const prompt = this.buildCollaborativePrompt(
          agent,
          context.currentResult,
          context,
          node,
          relevantMessages
        );

        const content = await agent.model.process(prompt, context.signal);

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
   * Execute a LOOP node
   */
  private async executeLoopNode(
    node: GraphNode,
    context: GraphContext,
    agents: Agent[],
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain
  ): Promise<string> {
    const maxIterations = node.maxIterations || 10;
    let iteration = context.iterationCounts.get(node.id) || 0;

    while (iteration < maxIterations) {
      iteration++;
      context.iterationCounts.set(node.id, iteration);

      // Execute loop body (next nodes)
      await this.executeNextNodes(node, context, agents, observer, middlewareChain);

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
    agents: Agent[],
    observer?: SocietyObserver,
    middlewareChain?: MiddlewareChain
  ): Promise<void> {
    const edges = this.edges.get(node.id) || [];

    for (const edge of edges) {
      // Check edge condition if present
      if (edge.condition && !edge.condition(context.currentResult, context)) {
        continue;
      }

      const nextNode = this.nodes.get(edge.to);
      if (nextNode) {
        await this.executeNode(nextNode, context, agents, observer, middlewareChain);
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
  build(): ExecutionEngine {
    return new ExecutionEngine(this.nodes, this.edges);
  }
}
