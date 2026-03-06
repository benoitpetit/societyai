/**
 * @fileoverview Core Type Definitions for SocietyAI
 *
 * This file contains all core interfaces and types used throughout the library.
 *
 * Note about imports: This file imports types from capabilities modules
 * (MemorySystem, Tool, JSONSchema). These imports are intentional and safe
 * because:
 * 1. They are type-only imports (TypeScript handles these at compile time)
 * 2. They don't create runtime circular dependencies
 * 3. The capabilities modules import from types.ts for their own type safety
 *
 * This creates a "type-level circular dependency" which is perfectly valid in
 * TypeScript and allows us to have strong type checking across the entire codebase
 * without actual runtime circular dependencies.
 */

import { MemorySystem } from '../capabilities/memory';
import { Tool } from '../capabilities/tools';
import { JSONSchema } from '../capabilities/validation';

/**
 * Interface for AI models
 * This interface must be implemented by any model
 * that developers wish to use with SocietyAI
 */
export interface AIModel {
  /**
   * Process a prompt and return a response
   * @param prompt - The prompt to process
   * @param signal - Optional cancellation signal
   * @returns A promise containing the model's response
   */
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;

  /**
   * Process a prompt and return a streaming response
   * @param prompt - The prompt to process
   * @param signal - Optional cancellation signal
   * @returns An async iterable of string chunks
   */
  stream?(prompt: unknown, signal?: AbortSignal): AsyncIterable<string>;

  /**
   * Return the name of the AI model
   */
  name(): string;

  /**
   * Check if the model supports a specific prompt type
   * @param promptType - The prompt type to check
   */
  supportsPromptType(promptType: string): boolean;

  /**
   * Check if the model supports streaming
   */
  supportsStreaming?(): boolean;
}

// ============================================================================
// CONFIGURABLE ROLES AND AGENTS SYSTEM
// ============================================================================

/**
 * Definition of a role that agents can assume
 * Roles define behaviors, capabilities, and constraints
 */
export interface Role {
  /**
   * Unique role identifier
   */
  id: string;

  /**
   * Readable role name (e.g., "Project Manager", "Developer", "Tester")
   */
  name: string;

  /**
   * Role description
   */
  description?: string;

  /**
   * System instructions for this role
   * Defines how the agent should behave
   */
  systemPrompt: string;

  /**
   * Specific capabilities of this role
   */
  capabilities?: string[];

  /**
   * Constraints or limitations for this role
   */
  constraints?: string[];

  /**
   * Template for formatting prompts for this agent
   *
   * Supported placeholders:
   * - `{system}`: System instructions for this role
   * - `{input}`: The current input being processed
   * - `{context}`: Shared data between nodes (JSON stringified)
   * - `{history}`: Execution history of previous nodes
   * - `{sharedData}`: Alias for {context}, shared state across the workflow
   * - `{memory}`: Memory context from the agent's memory system
   * - `{tools}`: Available tools for the agent
   * - `{instructions}`: Step-specific instructions from node metadata
   * - `{messages}`: Message history for collaborative nodes
   *
   * Example:
   * ```typescript
   * promptTemplate: `System: {system}
   * Context: {context}
   * Memory: {memory}
   * Tools: {tools}
   *
   * {instructions}
   *
   * Input: {input}`
   * ```
   */
  promptTemplate?: string;
}

/**
 * Agent configuration
 * Represents an autonomous entity in the society
 */
export interface Agent {
  /**
   * Unique agent ID
   */
  id: string;

  /**
   * Agent name
   */
  name?: string;

  /**
   * Agent's role
   */
  role: Role;

  /**
   * AI model to use
   */
  model: AIModel;

  /**
   * Agents with which this agent can directly communicate
   */
  canCommunicateWith?: string[];

  /**
   * Agent priority (for execution order)
   */
  priority?: number;

  /**
   * Initial context data for this agent
   */
  initialContext?: Record<string, unknown>;

  /**
   * Agent-specific retry configuration
   */
  retryConfig?: {
    maxRetries?: number;
    initialBackoff?: number;
  };

  /**
   * Memory system for this agent
   */
  memory?: MemorySystem;

  /**
   * Tools available to this agent
   */
  tools?: Tool[];

  /**
   * Execution mode for this agent
   * - 'default': Standard async execution on main event loop (IO-bound tasks)
   * - 'isolated': Execute in isolated Worker Thread (CPU-intensive tasks)
   *
   * Use 'isolated' for computationally heavy agents that might block the event loop
   * (e.g., heavy parsing, complex calculations, data processing)
   *
   * @default 'default'
   */
  executionMode?: 'default' | 'isolated';
}

/**
 * Message exchanged between agents in a society
 */
export interface Message {
  /**
   * Sender agent ID
   */
  from: string;

  /**
   * Recipient agent ID (or 'broadcast' for all)
   */
  to: string | 'broadcast';

  /**
   * Message type
   */
  type: 'request' | 'response' | 'notification' | 'data' | 'feedback' | 'validation';

  /**
   * Message content
   */
  content: string;

  /**
   * Optional structured data
   */
  data?: Record<string, unknown>;

  /**
   * Message timestamp
   */
  timestamp: number;

  /**
   * Parent message ID (for replies)
   */
  replyTo?: string;

  /**
   * Unique message identifier
   */
  messageId: string;

  /**
   * Optional metadata for routing and tracking
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SOCIETY TASK SYSTEM
// ============================================================================

/**
 * Loop configuration for auto-correction and iterative refinement
 */
export interface LoopConfig {
  /** Maximum number of iterations */
  maxIterations: number;
  /** Optional function to determine if the loop should exit early */
  exitCondition?: (result: string, context: ExecutionContext) => boolean;
  /** Strategy for aggregating results across iterations */
  historyAggregation?: 'append' | 'replace' | 'summary';
}

/**
 * Task execution type
 */
export type TaskExecutionType =
  | 'sequential' // Agents executed one by one
  | 'parallel' // Agents executed in parallel
  | 'collaborative' // Agents that communicate during execution
  | 'conditional' // Conditional execution based on previous results
  | 'human'; // Human interaction required (pause execution)

/**
 * Task to be performed by agents in a society
 */
export interface Task {
  /**
   * Step identifier
   */
  id: string;

  /**
   * Step name
   */
  name: string;

  /**
   * Step description
   */
  description?: string;

  /**
   * IDs of agents participating in this step
   */
  agentIds: string[];

  /**
   * Execution type
   */
  executionType: TaskExecutionType;

  /**
   * Specific instructions for this step
   * Injected into each agent's prompt
   */
  instructions?: string;

  /**
   * Prompt template for this step
   * Overrides the role's promptTemplate if defined
   */
  promptTemplate?: string;

  /**
   * Schema for structured output validation
   */
  outputSchema?: JSONSchema;

  /**
   * Maximum iterations for collaborative steps
   */
  maxIterations?: number;

  /**
   * Condition to proceed to next task (for collaborative tasks)
   */
  completionCondition?: (results: TaskResult[], iteration: number) => boolean;

  /**
   * Result transformation function before passing to next task
   */
  resultTransformer?: (results: TaskResult[] | TaskResult) => unknown;

  /**
   * Condition to execute this task (for 'conditional' type)
   */
  condition?: (previousResults: Map<string, TaskResult[]>) => boolean;

  /**
   * Possible next tasks (if not defined, proceeds to next task in order)
   */
  nextTasks?: string[];

  /**
   * Function to dynamically determine the next task
   */
  nextTaskResolver?: (results: TaskResult[]) => string | null;

  /**
   * Hint for the executor: List of all possible tasks this task might transition to via resolver.
   * Used for graph validation and pruning.
   */
  possibleNextTasks?: string[];

  /**
   * Explicit dependencies: list of task IDs that must complete before this task starts.
   *
   * Declaring `dependencies: ['taskA', 'taskB']` (or via `.dependsOn()` in the builder)
   * causes the executor to create directed edges `taskA → thisTask` and `taskB → thisTask`
   * in the execution graph, ensuring proper ordering.
   *
   * @example
   * ```typescript
   * .addTask(t => t.withId('review').withAgents(['editor']).dependsOn('draft'))
   * ```
   */
  dependencies?: string[];
}

/**
 * Task execution result for an agent
 */
export interface TaskResult {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Task ID
   */
  taskId: string;

  /**
   * Agent response content
   */
  output: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * Completion timestamp
   */
  timestamp: number;

  /**
   * Success or failure status
   */
  success: boolean;

  /**
   * Execution duration in milliseconds
   */
  duration?: number;

  /**
   * Error if failed
   */
  error?: Error;

  /**
   * Iteration number (for collaborative tasks)
   */
  iteration?: number;
}

/** * Retention policy for managing memory in long-running executions
 */
export interface RetentionPolicy {
  /**
   * Maximum number of node results to keep in hot memory
   * Older results are archived to storage adapter if available
   * Default: unlimited (undefined)
   */
  maxNodeResults?: number;

  /**
   * Maximum number of messages to keep in message history
   * Older messages are discarded or archived
   * Default: unlimited (undefined)
   */
  maxMessages?: number;

  /**
   * Strategy for handling excess data
   * - 'discard': Simply remove old data
   * - 'archive': Store in storage adapter if available, otherwise discard
   * Default: 'discard'
   */
  overflowStrategy?: 'discard' | 'archive';

  /**
   * Whether to keep results from important nodes (START, END, errors)
   * even if they exceed maxNodeResults
   * Default: true
   */
  keepCriticalNodes?: boolean;
}

/** * Complete society configuration
 */
export interface SocietyConfig {
  /**
   * Society identifier
   */
  id: string;

  /**
   * Society name
   */
  name: string;

  /**
   * Society description
   */
  description?: string;

  /**
   * Tasks in default execution order
   */
  tasks: Task[];

  /**

   * Entry task ID
   */
  entryTaskId?: string;

  /**
   * Agents participating in the society
   */
  agents: Agent[];

  /**
   * Global context data shared between all tasks
   */
  globalContext?: Record<string, unknown>;

  /**
   * Strict routing mode: if true, raises an error if an intermediate
   * task doesn't have nextTasks explicitly defined.
   * If false (default), automatically creates sequential links.
   */
  strictRouting?: boolean;

  /**
   * Retention policy for managing memory in long-running executions
   * Helps prevent memory exhaustion in loops and large workflows
   */
  retentionPolicy?: RetentionPolicy;

  /**
   * Function called before each task
   */
  onBeforeTask?: (task: Task, context: ExecutionContext) => Promise<void>;

  /**
   * Function called after each task
   */
  onAfterTask?: (task: Task, results: TaskResult[], context: ExecutionContext) => Promise<void>;

  /**
   * Function to generate the final result
   */
  finalResultGenerator?: (
    results: Map<string, TaskResult[]>,
    context: ExecutionContext
  ) => Promise<string>;
}

/**
 * Execution context shared during society execution
 */
export interface ExecutionContext {
  /**
   * Initial prompt/input
   */
  input: string;

  /**
   * Shared data between tasks (mutable)
   */
  sharedData: Map<string, unknown>;

  /**
   * Results of all previous tasks
   */
  taskResults: Map<string, TaskResult[]>;

  /**
   * Agent communication history
   */
  messageHistory: Message[];

  /**
   * Execution metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Final society execution result
 */
export interface SocietyResult {
  /**
   * Global success status
   */
  success: boolean;

  /**
   * Generated final result
   */
  output: string;

  /**
   * Results for each task
   */
  taskResults: Map<string, TaskResult[]>;

  /**
   * Messages exchanged during execution
   */
  messages: Message[];

  /**
   * Total duration in ms
   */
  duration: number;

  /**
   * Errors encountered
   */
  errors?: Error[];
}

/**
 * Interface for adapting prompts and responses between
 * SocietyAI generic format and specific model formats
 */
export interface ModelAdapter {
  /**
   * Convert a generic prompt to the model's specific format
   * @param genericPrompt - The generic prompt
   */
  convertPrompt(genericPrompt: unknown): Promise<unknown>;

  /**
   * Convert a model-specific response to the expected string format
   * @param specificResponse - The model-specific response
   */
  convertResponse(specificResponse: unknown): Promise<string>;

  /**
   * Return the prompt types supported by this model
   */
  getSupportedPromptTypes(): string[];
}

/**
 * Interface to observe society behavior
 */
export interface SocietyObserver {
  /**
   * Called when an agent starts processing a prompt
   */
  onAgentStart(agentId: string, modelName: string, prompt: unknown): void;

  /**
   * Called when an agent completes processing successfully
   */
  onAgentComplete(agentId: string, modelName: string, result: string): void;

  /**
   * Called when an agent encounters an error
   */
  onAgentError(agentId: string, modelName: string, error: Error): void;

  /**
   * Called when a specific task completes
   */
  onTaskEnd?(taskId: string, result: TaskResult): void;

  /**
   * Called when a graph node starts execution
   */
  onNodeStart?(nodeId: string, type: string, input: string): void;

  /**
   * Called when a graph node completes execution
   */
  onNodeEnd?(nodeId: string, output: string, duration: number): void;

  /**
   * Called when a graph node encounters an error
   */
  onNodeError?(nodeId: string, error: Error): void;

  /**
   * Called at the start of a collaboration phase
   */
  onPhaseStart(phase: string): void;

  /**
   * Called at the end of a collaboration phase
   */
  onPhaseComplete(phase: string): void;

  /**
   * Called when society starts
   */
  onSocietyStart(prompt: string, agentCount: number): void;

  /**
   * Called when society completes all processing
   */
  onSocietyComplete(finalResult: string): void;
}
