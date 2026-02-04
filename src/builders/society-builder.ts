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
  private _nextTasks?: string[]; // Renamed from _nextSteps
  private _nextTaskResolver?: (results: TaskResult[]) => string | null; // Renamed from _nextStepResolver
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
   * Define dependencies (steps that must be completed before this one)
   */
  dependsOn(stepIds: string | string[]): this {
    const ids = Array.isArray(stepIds) ? stepIds : [stepIds];
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
   * Create a loop: repeatedly execute agents until a condition is met or max iterations reached
   * @param maxIterations Maximum number of iterations
   * @param completionCondition Optional condition to exit loop early
   *
   * Note: Currently implemented using collaborative execution type with iteration control.
   * For more complex loop patterns, consider using the graph API directly.
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
   * Define static next steps
   */
  thenGoto(stepIds: string[]): this {
    this._nextTasks = stepIds;
    return this;
  }

  /**
   * Define static next steps (alias for thenGoto)
   */
  withNextSteps(stepIds: string[]): this {
    this._nextTasks = stepIds;
    return this;
  }

  /**
   * Create a conditional branch: execute different next steps based on a condition
   *
   * @param condition Function that evaluates previous results
   * @param trueSteps Steps to execute if condition is true
   * @param falseSteps Steps to execute if condition is false
   *
   * @example
   * ```typescript
   * .addTask(s => s
   *   .withId('check')
   *   .withAgents(['validator'])
   *   .sequential()
   *   .withBranch(
   *     (results) => results.get('analyze')?.[0].output.includes('valid'),
   *     ['approve'],
   *     ['reject']
   *   )
   * )
   * ```
   */
  withBranch(
    condition: (previousResults: Map<string, TaskResult[]>) => boolean,
    trueSteps: string[],
    falseSteps: string[]
  ): this {
    this._condition = condition;
    // NOTE: We keep the existing executionType (usually 'sequential')
    // The step itself executes normally, and nextStepResolver handles the routing

    // Store both paths - we'll need to handle this in the executor
    // For now, we use nextTaskResolver to dynamically choose
    this._nextTaskResolver = (results: TaskResult[]) => {
      // Convert results array to Map format expected by condition
      const resultsMap = new Map<string, TaskResult[]>();
      for (const result of results) {
        const taskId = result.taskId;
        if (!resultsMap.has(taskId)) {
          resultsMap.set(taskId, []);
        }
        resultsMap.get(taskId)!.push(result);
      }

      const conditionMet = condition(resultsMap);
      const targetSteps = conditionMet ? trueSteps : falseSteps;
      return targetSteps[0] || null;
    };

    return this;
  }

  /**
   * Create a conditional next step (simpler than withBranch)
   * @param condition Function that evaluates to determine next step
   * @param nextStepId Step ID to go to if condition is true
   * @param fallbackStepId Optional step ID if condition is false
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
    nextStepId: string,
    fallbackStepId?: string
  ): this {
    return this.withBranch(condition, [nextStepId], fallbackStepId ? [fallbackStepId] : []);
  }

  /**
   * Dynamically determine next step based on results
   */
  thenResolve(resolver: (results: TaskResult[]) => string | null): this {
    this._nextTaskResolver = resolver;
    return this;
  }

  /**
   * Set a timeout for this step
   */
  withTimeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Build the step configuration
   */
  build(): Task & { timeout?: number; dependencies?: string[] } {
    if (!this._id) throw new InvalidConfigurationError('Step id is required');
    if (!this._name) throw new InvalidConfigurationError('Step name is required');
    if (this._agentIds.length === 0)
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
      nextTasks: this._nextTasks, // New property name
      nextTaskResolver: this._nextTaskResolver, // New property name
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
        steps.push({
          id: 'fallback',
          name: 'Fallback Execution',
          agentIds: this._agentIds,
          executionType: 'sequential',
          // Fallback logic is handled by the executor
        });
        break;

      case 'race':
        steps.push({
          id: 'race',
          name: 'Race Execution',
          agentIds: this._agentIds,
          executionType: 'parallel',
          // Race logic: first result wins
        });
        break;

      case 'router':
        steps.push({
          id: 'router',
          name: 'Router',
          agentIds: this._agentIds,
          executionType: 'conditional',
          // Router logic is handled by the executor
        });
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
  if (options?.priority) builder.withPriority(options.priority);
  if (options?.canCommunicateWith) {
    builder.canCommunicateWith(options.canCommunicateWith);
  }

  return builder;
}
