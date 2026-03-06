/**
 * @fileoverview Workflow Builder for SocietyAI
 *
 * Provides fluent builder API for configuring workflows, pipelines, and tasks
 */

import {
  AIModel,
  Role,
  Task,
  TaskExecutionType,
  TaskResult,
  ExecutionContext,
} from '../core/types';
import { JSONSchema } from '../capabilities/validation';
import { InvalidConfigurationError } from '../core/errors';
import { FluentRoleBuilder } from './role-builder';
import { FluentAgentBuilder } from './agent-builder';
// ============================================================================
// FLUENT TASK BUILDER
// ============================================================================

/**
 * Fluent builder for creating workflow tasks
 */
export class FluentTaskBuilder {
  private _id: string = '';
  private _name: string = '';
  private _description?: string;
  private _agentIds: string[] = [];
  private _executionType: TaskExecutionType = 'sequential';
  private _instructions?: string;
  private _promptTemplate?: string;
  private _maxIterations?: number;
  private _completionCondition?: (results: TaskResult[], iteration: number) => boolean;
  private _resultTransformer?: (results: TaskResult[] | TaskResult) => unknown;
  private _condition?: (previousResults: Map<string, TaskResult[]>) => boolean;
  private _outputSchema?: JSONSchema;
  private _nextTasks?: string[];
  private _nextTaskResolver?: (results: TaskResult[]) => string | null;
  private _possibleNextTasks?: string[];
  private _timeout?: number;
  private _dependencies: string[] = [];

  /**
   * Create a new instance of FluentTaskBuilder
   */
  static create(): FluentTaskBuilder {
    return new FluentTaskBuilder();
  }

  /**
   * Set the unique identifier for this step
   */
  withId(id: string): this {
    this._id = id;
    if (!this._name) this._name = id;
    return this;
  }

  /**
   * Set the display name for this step
   */
  withName(name: string): this {
    this._name = name;
    return this;
  }

  /**
   * Set the description of what this step does
   */
  withDescription(description: string): this {
    this._description = description;
    return this;
  }

  /**
   * Set the agents that will participate in this step
   */
  withAgents(agentIds: string[]): this {
    this._agentIds = agentIds;
    return this;
  }

  /**
   * Add a single agent to this step
   */
  addAgent(agentId: string): this {
    this._agentIds.push(agentId);
    return this;
  }

  /**
   * Set execution type directly
   */
  withExecutionType(type: TaskExecutionType): this {
    this._executionType = type;
    return this;
  }

  /**
   * Execute agents sequentially (one after another)
   */
  sequential(): this {
    this._executionType = 'sequential';
    return this;
  }

  /**
   * Execute agents in parallel (all at once)
   */
  parallel(): this {
    this._executionType = 'parallel';
    return this;
  }

  /**
   * Execute agents collaboratively (with inter-agent communication)
   */
  collaborative(maxIterations?: number): this {
    this._executionType = 'collaborative';
    if (maxIterations !== undefined) this._maxIterations = maxIterations;
    return this;
  }

  /**
   * Mark this task as requiring human interaction.
   * The workflow will pause at this step and wait for manual resumption.
   */
  isHuman(): this {
    this._executionType = 'human';
    // Human tasks don't necessarily need agents, but we keep the array valid
    return this;
  }

  /**
   * Make this step conditional based on previous results
   */
  withCondition(condition: (previousResults: Map<string, TaskResult[]>) => boolean): this {
    this._condition = condition;
    this._executionType = 'conditional';
    return this;
  }

  /**
   * Set specific instructions for this step
   */
  withInstructions(instructions: string): this {
    this._instructions = instructions;
    return this;
  }

  /**
   * Set schema for structured output validation
   */
  withOutputSchema(schema: JSONSchema): this {
    this._outputSchema = schema;
    return this;
  }

  /**
   * Declare that this task depends on one or more previously defined tasks.
   *
   * This creates a directed graph edge from each listed task to this one,
   * ensuring the dependency tasks complete before this task starts.
   * It is the recommended way to express ordering when you do not want to
   * rely on the implicit sequential wiring (tasks array position).
   *
   * **Note**: `dependsOn()` and implicit sequential ordering can coexist.
   * When a task has explicit dependencies, the executor will create edges
   * from those dependency tasks to this task. Implicit sequential edges
   * (based on array position) are skipped for tasks that are already
   * wired via dependency declarations.
   *
   * @param taskIds One or more task IDs that must finish before this task runs
   *
   * @example
   * ```typescript
   * .addTask(t => t.withId('draft').withAgents(['writer']).sequential())
   * .addTask(t => t
   *   .withId('review')
   *   .dependsOn('draft')      // explicit dependency — no position assumption
   *   .withAgents(['editor'])
   *   .sequential()
   * )
   * ```
   */
  dependsOn(taskIds: string | string[]): this {
    const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
    this._dependencies.push(...ids);
    return this;
  }

  /**
   * Set a custom prompt template for this step
   */
  withPromptTemplate(template: string): this {
    this._promptTemplate = template;
    return this;
  }

  /**
   * Set maximum iterations for collaborative execution
   */
  withMaxIterations(max: number): this {
    this._maxIterations = max;
    return this;
  }

  /**
   * Create a loop: repeatedly execute this task's agents until a condition is met
   * or the maximum number of iterations is reached.
   *
   * **Important**: This convenience method sets the task's execution type to
   * `'collaborative'` internally, which is the mechanism used to drive iterative
   * re-execution. If you assign `collaborative()` and `withLoop()` to the same
   * task, the last call wins.
   *
   * For more advanced loop patterns (e.g. looping over a sub-graph with
   * conditional branching), use the low-level `GraphBuilder` API with
   * `NodeType.LOOP` directly.
   *
   * @param maxIterations Maximum number of loop iterations before stopping
   * @param completionCondition Optional early-exit predicate. Return `true` to
   *   stop the loop before `maxIterations` is reached.
   *
   * @example
   * ```typescript
   * .addTask(s => s
   *   .withId('refine')
   *   .withAgents(['improver'])
   *   .withLoop(5, (results, iteration) => {
   *     const lastResult = results[results.length - 1];
   *     return lastResult.output.includes('perfect');
   *   })
   * )
   * ```
   */
  withLoop(
    maxIterations: number,
    completionCondition?: (results: TaskResult[], iteration: number) => boolean
  ): this {
    // Internally, loops are driven by the collaborative execution engine which
    // re-runs agents in sequence until the completion condition or max iterations.
    this._executionType = 'collaborative';
    this._maxIterations = maxIterations;
    if (completionCondition) {
      this._completionCondition = completionCondition;
    }
    return this;
  }

  /**
   * Set the condition for completing collaborative iterations
   */
  withCompletionCondition(condition: (results: TaskResult[], iteration: number) => boolean): this {
    this._completionCondition = condition;
    return this;
  }

  /**
   * Transform results before passing to next step
   */
  transformResults(transformer: (results: TaskResult[] | TaskResult) => unknown): this {
    this._resultTransformer = transformer;
    return this;
  }

  /**
   * Define static next tasks
   */
  thenGoto(taskIds: string[]): this {
    this._nextTasks = taskIds;
    return this;
  }

  /**
   * Define static next tasks (alias for thenGoto)
   */
  withNextSteps(taskIds: string[]): this {
    this._nextTasks = taskIds;
    return this;
  }

  /**
   * Create a conditional branch: route to different next tasks based on a
   * runtime condition evaluated against all previous task results.
   *
   * The task itself executes normally (using its existing `executionType`).
   * After it completes, the `condition` is evaluated and the workflow is routed
   * to either `trueTasks[0]` (condition is `true`) or `falseTasks[0]`
   * (condition is `false`). Only the first element of each array is used as
   * the next task — use `thenResolve()` for multi-target dynamic routing.
   *
   * **Note**: Calling `withBranch()` sets an internal `nextTaskResolver`, which
   * means any subsequent `thenGoto()` / `withNextSteps()` call will be ignored.
   *
   * @param condition Predicate function receiving a Map of all previous task results
   * @param trueTasks Task IDs to route to when condition returns `true`
   * @param falseTasks Task IDs to route to when condition returns `false`.
   *   Pass an empty array `[]` to route to `'end'` when condition is false.
   *
   * @example
   * ```typescript
   * .addTask(s => s
   *   .withId('check')
   *   .withAgents(['validator'])
   *   .sequential()
   *   .withBranch(
   *     (results) => results.get('analyze')?.[0].output.includes('valid'),
   *     ['approve'],   // → go to 'approve' if valid
   *     ['reject']     // → go to 'reject' otherwise
   *   )
   * )
   * ```
   */
  withBranch(
    condition: (previousResults: Map<string, TaskResult[]>) => boolean,
    trueTasks: string[],
    falseTasks: string[]
  ): this {
    this._condition = condition;

    // The task's own execution type is unchanged.
    // After execution, a resolver node is injected by the SocietyExecutor
    // that evaluates the condition and picks the appropriate outgoing edge.
    this._nextTaskResolver = (results: TaskResult[]): string | null => {
      // Convert results array to Map format expected by the condition predicate
      const resultsMap = new Map<string, TaskResult[]>();
      for (const result of results) {
        const taskId = result.taskId;
        if (!resultsMap.has(taskId)) {
          resultsMap.set(taskId, []);
        }
        resultsMap.get(taskId)!.push(result);
      }

      const conditionMet = condition(resultsMap);
      const targetTasks = conditionMet ? trueTasks : falseTasks;
      return targetTasks[0] || null;
    };

    // Provide the full set of reachable task IDs as a hint to the graph builder
    // so it can pre-wire all potential outgoing edges for validation purposes.
    this._possibleNextTasks = [...trueTasks, ...falseTasks];

    return this;
  }

  /**
   * Create a conditional next task (simpler than withBranch)
   * @param condition Function that evaluates to determine next task
   * @param nextTaskId Task ID to go to if condition is true
   * @param fallbackTaskId Optional task ID if condition is false
   *
   * @example
   * ```typescript
   * .addTask(s => s
   *   .withId('validate')
   *   .withAgents(['validator'])
   *   .sequential()
   *   .withConditionalNext(
   *     (results) => results.get('check')?.[0].output.includes('pass'),
   *     'success',
   *     'retry'
   *   )
   * )
   * ```
   */
  withConditionalNext(
    condition: (previousResults: Map<string, TaskResult[]>) => boolean,
    nextTaskId: string,
    fallbackTaskId?: string
  ): this {
    return this.withBranch(condition, [nextTaskId], fallbackTaskId ? [fallbackTaskId] : []);
  }

  /**
   * Dynamically determine next task based on results
   */
  thenResolve(resolver: (results: TaskResult[]) => string | null): this {
    this._nextTaskResolver = resolver;
    return this;
  }

  /**
   * Set a timeout for this task
   */
  withTimeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Build the task configuration
   */
  build(): Task & { timeout?: number } {
    if (!this._id) throw new InvalidConfigurationError('Task id is required');
    if (!this._name) throw new InvalidConfigurationError('Task name is required');

    // Agents are required unless it's a human task
    if (this._agentIds.length === 0 && this._executionType !== 'human')
      throw new InvalidConfigurationError('Step must have at least one agent');

    return {
      id: this._id,
      name: this._name,
      description: this._description,
      agentIds: this._agentIds,
      executionType: this._executionType,
      instructions: this._instructions,
      promptTemplate: this._promptTemplate,
      maxIterations: this._maxIterations,
      completionCondition: this._completionCondition,
      resultTransformer: this._resultTransformer,
      condition: this._condition,
      outputSchema: this._outputSchema,
      nextTasks: this._nextTasks,
      nextTaskResolver: this._nextTaskResolver,
      possibleNextTasks: this._possibleNextTasks,
      timeout: this._timeout,
      dependencies: this._dependencies.length > 0 ? this._dependencies : undefined,
    };
  }
}

// ============================================================================
// PIPELINE BUILDER (for common patterns)
// ============================================================================

/**
 * Common execution pipeline patterns
 */
export type PipelinePattern =
  | 'scatter-gather' // Execute in parallel, then aggregate
  | 'chain' // Sequential pipeline
  | 'router' // Route to different agents based on input
  | 'fallback' // Try agents in order until one succeeds
  | 'race'; // First result wins

/**
 * Configuration for a pipeline
 */
export interface PipelineConfig {
  pattern: PipelinePattern;
  agentIds: string[];
  aggregator?: (results: TaskResult[]) => string;
  router?: (input: string, context: ExecutionContext) => string;
  timeout?: number;
}

/**
 * Fluent builder for creating execution pipelines
 */
export class FluentPipelineBuilder {
  private _pattern: PipelinePattern = 'chain';
  private _agentIds: string[] = [];
  private _aggregator?: (results: TaskResult[]) => string;
  private _router?: (input: string, context: ExecutionContext) => string;
  private _timeout?: number;
  private _fallbackHandler?: (errors: Error[]) => string;

  /**
   * Use scatter-gather pattern: execute all agents in parallel, then aggregate results
   */
  scatterGather(agentIds: string[]): this {
    this._pattern = 'scatter-gather';
    this._agentIds = agentIds;
    return this;
  }

  /**
   * Use chain pattern: execute agents sequentially, passing results forward
   */
  chain(agentIds: string[]): this {
    this._pattern = 'chain';
    this._agentIds = agentIds;
    return this;
  }

  /**
   * Use router pattern: route input to a specific agent based on logic
   */
  router(agentIds: string[], routerFn: (input: string, context: ExecutionContext) => string): this {
    this._pattern = 'router';
    this._agentIds = agentIds;
    this._router = routerFn;
    return this;
  }

  /**
   * Use fallback pattern: try agents in order until one succeeds
   */
  fallback(agentIds: string[]): this {
    this._pattern = 'fallback';
    this._agentIds = agentIds;
    return this;
  }

  /**
   * Use race pattern: return the first successful result
   */
  race(agentIds: string[]): this {
    this._pattern = 'race';
    this._agentIds = agentIds;
    return this;
  }

  /**
   * Set the aggregation function for scatter-gather pattern
   */
  aggregate(aggregator: (results: TaskResult[]) => string): this {
    this._aggregator = aggregator;
    return this;
  }

  /**
   * Set a timeout for pipeline execution
   */
  withTimeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Set a fallback handler for when all agents fail
   */
  onAllFailed(handler: (errors: Error[]) => string): this {
    this._fallbackHandler = handler;
    return this;
  }

  /**
   * Build the pipeline configuration
   */
  build(): PipelineConfig & { fallbackHandler?: (errors: Error[]) => string } {
    return {
      pattern: this._pattern,
      agentIds: this._agentIds,
      aggregator: this._aggregator,
      router: this._router,
      timeout: this._timeout,
      fallbackHandler: this._fallbackHandler,
    };
  }

  /**
   * Convert pipeline to workflow steps
   */
  toSteps(): Task[] {
    const steps: Task[] = [];

    switch (this._pattern) {
      case 'scatter-gather':
        steps.push({
          id: 'scatter',
          name: 'Parallel Execution',
          agentIds: this._agentIds,
          executionType: 'parallel',
          resultTransformer: this._aggregator
            ? (results): string => this._aggregator!(results as TaskResult[])
            : undefined,
        });
        break;

      case 'chain':
        this._agentIds.forEach((agentId, index) => {
          steps.push({
            id: `chain-${index}`,
            name: `Chain Step ${index + 1}`,
            agentIds: [agentId],
            executionType: 'sequential',
            nextTasks: index < this._agentIds.length - 1 ? [`chain-${index + 1}`] : undefined,
          });
        });
        break;

      case 'fallback':
        // True fallback: try agents in order; if one succeeds, skip the rest (#24).
        // Each agent task uses a nextTaskResolver:
        //   - if the current agent succeeded → null (go to end)
        //   - if it failed → next agent task id
        // The graph executor will wire resolver → potentialNextTasks appropriately.
        this._agentIds.forEach((agentId, index) => {
          const taskId = `fallback-${index}`;
          const nextTaskId = index < this._agentIds.length - 1 ? `fallback-${index + 1}` : null;

          steps.push({
            id: taskId,
            name: `Fallback Attempt ${index + 1}`,
            agentIds: [agentId],
            executionType: 'sequential',
            // Route: success → end (null), failure → next agent
            nextTaskResolver: (results: TaskResult[]): string | null => {
              const myResult = results.find((r) => r.taskId === taskId);
              if (myResult?.success) return null; // done — route to 'end'
              return nextTaskId; // try next agent
            },
            possibleNextTasks: nextTaskId ? [nextTaskId] : [],
          });
        });
        break;

      case 'race':
        // True race (first-result-wins) requires engine-level Promise.race support which is
        // not available in the current PARALLEL node implementation. As the best approximation
        // using the current engine, we run all agents in parallel and return the first
        // successful result rather than concatenating all outputs (#25).
        steps.push({
          id: 'race',
          name: 'Race Execution',
          agentIds: this._agentIds,
          executionType: 'parallel',
          resultTransformer: (results: TaskResult[] | TaskResult): string => {
            const arr = Array.isArray(results) ? results : [results];
            const first = arr.find((r) => r.success);
            return first?.output ?? arr[0]?.output ?? '';
          },
        });
        break;

      case 'router':
        // Route input to a specific agent using the caller-supplied router function (#26).
        // Build a separate task per agent; a shared condition-based resolver selects one.
        if (!this._router) {
          throw new InvalidConfigurationError(
            'Router pipeline requires a router function. Use .router(agentIds, routerFn).'
          );
        }
        // Create per-agent tasks (sequential, single-agent)
        this._agentIds.forEach((agentId, index) => {
          steps.push({
            id: `route-${index}`,
            name: `Route to ${agentId}`,
            agentIds: [agentId],
            executionType: 'sequential',
          });
        });

        // Prepend a routing decision task that uses the router function to pick the target.
        // We insert it at index 0 (before the per-agent tasks) using unshift.
        {
          const routerFn = this._router;
          const agentIds = this._agentIds;
          steps.unshift({
            id: 'router',
            name: 'Router',
            agentIds: [], // no agents execute here — this is purely a routing node
            executionType: 'conditional',
            condition: (previousResults: Map<string, TaskResult[]>): boolean => {
              // We abuse the condition slot to run the router and store the result.
              // The actual routing is done via nextTaskResolver.
              void previousResults; // unused
              return true;
            },
            nextTaskResolver: (results: TaskResult[]): string | null => {
              // Reconstruct a minimal ExecutionContext-like object for the router
              const taskResults = new Map<string, TaskResult[]>();
              for (const r of results) {
                const existing = taskResults.get(r.taskId) || [];
                existing.push(r);
                taskResults.set(r.taskId, existing);
              }
              const lastResult = results[results.length - 1];
              const input = lastResult?.output ?? '';

              // ExecutionContext shape expected by router
              const ctx = {
                input,
                sharedData: new Map<string, unknown>(),
                taskResults,
                messageHistory: [],
                metadata: {},
              };

              const targetAgentId = routerFn(input, ctx as ExecutionContext);
              const idx = agentIds.indexOf(targetAgentId);
              if (idx === -1) return null;
              return `route-${idx}`;
            },
            possibleNextTasks: agentIds.map((_, i) => `route-${i}`),
          });
        }
        break;
    }

    return steps;
  }
}

// ============================================================================
// MAIN SOCIETY BUILDER
// ============================================================================

/**
 * Result aggregation strategies
 */
export const AggregationStrategies = {
  /**
   * Concatenate all results with a separator
   */
  concat:
    (separator: string = '\n\n') =>
    (results: TaskResult[]): string => {
      return results
        .filter((r) => r.success)
        .map((r) => r.output)
        .join(separator);
    },

  /**
   * Take the first successful result
   */
  first:
    () =>
    (results: TaskResult[]): string => {
      const first = results.find((r) => r.success);
      return first?.output ?? '';
    },

  /**
   * Take the last successful result
   */
  last:
    () =>
    (results: TaskResult[]): string => {
      const successful = results.filter((r) => r.success);
      return successful[successful.length - 1]?.output ?? '';
    },

  /**
   * Select best result based on custom criteria
   */
  best:
    (scorer: (result: TaskResult) => number) =>
    (results: TaskResult[]): string => {
      const scored = results
        .filter((r) => r.success)
        .map((r) => ({ result: r, score: scorer(r) }))
        .sort((a, b) => b.score - a.score);
      return scored[0]?.result.output ?? '';
    },

  /**
   * Apply a custom reducer
   */
  reduce:
    <T>(reducer: (acc: T, result: TaskResult) => T, initial: T, finalize: (acc: T) => string) =>
    (results: TaskResult[]): string => {
      const accumulated = results.filter((r) => r.success).reduce(reducer, initial);
      return finalize(accumulated);
    },

  /**
   * Format results as structured output
   */
  structured:
    (format: 'json' | 'markdown' | 'list' = 'markdown') =>
    (results: TaskResult[]): string => {
      const successful = results.filter((r) => r.success);

      switch (format) {
        case 'json':
          return JSON.stringify(
            successful.map((r) => ({ agent: r.agentId, output: r.output })),
            null,
            2
          );
        case 'list':
          return successful.map((r) => `- [${r.agentId}]: ${r.output}`).join('\n');
        case 'markdown':
        default:
          return successful.map((r) => `## ${r.agentId}\n\n${r.output}`).join('\n\n');
      }
    },
} as const;
export function createRole(
  id: string,
  systemPrompt?: string,
  options?: {
    name?: string;
    description?: string;
    capabilities?: string[];
    constraints?: string[];
    promptTemplate?: string;
  }
): FluentRoleBuilder {
  const builder = new FluentRoleBuilder().withId(id);
  if (systemPrompt) builder.withSystemPrompt(systemPrompt);

  if (options?.name) builder.withName(options.name);
  if (options?.description) builder.withDescription(options.description);
  if (options?.capabilities) builder.withCapabilities(options.capabilities);
  if (options?.constraints) builder.withConstraints(options.constraints);
  if (options?.promptTemplate) builder.withPromptTemplate(options.promptTemplate);

  return builder;
}

/**
 * Quick helper to create an agent builder
 */
export function createAgent(
  id: string,
  role: Role | FluentRoleBuilder,
  model: AIModel,
  options?: {
    name?: string;
    priority?: number;
    canCommunicateWith?: string[];
  }
): FluentAgentBuilder {
  const builder = new FluentAgentBuilder().withId(id).withRole(role).withModel(model);

  if (options?.name) builder.withName(options.name);
  if (options?.priority != null) builder.withPriority(options.priority);
  if (options?.canCommunicateWith) {
    builder.canCommunicateWith(options.canCommunicateWith);
  }

  return builder;
}
