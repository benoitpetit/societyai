/**
 * @fileoverview Workflow Builder for SocietyAI
 *
 * Provides fluent builder API for configuring workflows, pipelines, and societies
 */

import {
  AIModel,
  AgentConfig,
  AgentRole,
  WorkflowConfig,
  WorkflowStep,
  WorkflowStepExecutionType,
  StepResult,
  WorkflowContext,
  WorkflowResult,
  SocietyObserver,
} from '../core/types';
import { DefaultWorkflowExecutor } from '../agents/society';
import { InvalidConfigurationError } from '../core/errors';
import { FluentRoleBuilder } from './role-builder';
import { FluentAgentBuilder } from './agent-builder';
// ============================================================================
// FLUENT STEP BUILDER
// ============================================================================

/**
 * Fluent builder for creating workflow steps
 */
export class FluentStepBuilder {
  private _id: string = '';
  private _name: string = '';
  private _description?: string;
  private _agentIds: string[] = [];
  private _executionType: WorkflowStepExecutionType = 'sequential';
  private _instructions?: string;
  private _promptTemplate?: string;
  private _maxIterations?: number;
  private _completionCondition?: (results: StepResult[], iteration: number) => boolean;
  private _resultTransformer?: (results: StepResult[] | StepResult) => unknown;
  private _condition?: (previousResults: Map<string, StepResult[]>) => boolean;
  private _nextSteps?: string[];
  private _nextStepResolver?: (results: StepResult[]) => string | null;
  private _timeout?: number;
  private _dependencies: string[] = [];

  /**
   * Create a new instance of FluentStepBuilder
   */
  static create(): FluentStepBuilder {
    return new FluentStepBuilder();
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
  withExecutionType(type: WorkflowStepExecutionType): this {
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
  conditional(condition: (previousResults: Map<string, StepResult[]>) => boolean): this {
    this._executionType = 'conditional';
    this._condition = condition;
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
   * Set the condition for completing collaborative iterations
   */
  withCompletionCondition(condition: (results: StepResult[], iteration: number) => boolean): this {
    this._completionCondition = condition;
    return this;
  }

  /**
   * Transform results before passing to next step
   */
  transformResults(transformer: (results: StepResult[] | StepResult) => unknown): this {
    this._resultTransformer = transformer;
    return this;
  }

  /**
   * Define static next steps
   */
  thenGoto(stepIds: string[]): this {
    this._nextSteps = stepIds;
    return this;
  }

  /**
   * Dynamically determine next step based on results
   */
  thenResolve(resolver: (results: StepResult[]) => string | null): this {
    this._nextStepResolver = resolver;
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
   * Specify dependencies for this step
   * This step will only execute after all dependencies complete
   */
  dependsOn(stepIds: string | string[]): this {
    const ids = Array.isArray(stepIds) ? stepIds : [stepIds];
    this._dependencies.push(...ids);
    return this;
  }

  /**
   * Build the step configuration
   */
  build(): WorkflowStep & { timeout?: number; dependencies?: string[] } {
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
      nextSteps: this._nextSteps,
      nextStepResolver: this._nextStepResolver,
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
  aggregator?: (results: StepResult[]) => string;
  router?: (input: string, context: WorkflowContext) => string;
  timeout?: number;
}

/**
 * Fluent builder for creating execution pipelines
 */
export class FluentPipelineBuilder {
  private _pattern: PipelinePattern = 'chain';
  private _agentIds: string[] = [];
  private _aggregator?: (results: StepResult[]) => string;
  private _router?: (input: string, context: WorkflowContext) => string;
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
  router(agentIds: string[], routerFn: (input: string, context: WorkflowContext) => string): this {
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
  aggregate(aggregator: (results: StepResult[]) => string): this {
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
  toSteps(): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    switch (this._pattern) {
      case 'scatter-gather':
        steps.push({
          id: 'scatter',
          name: 'Parallel Execution',
          agentIds: this._agentIds,
          executionType: 'parallel',
          resultTransformer: this._aggregator
            ? (results): string => this._aggregator!(results as StepResult[])
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
            nextSteps: index < this._agentIds.length - 1 ? [`chain-${index + 1}`] : undefined,
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
    (results: StepResult[]): string => {
      return results
        .filter((r) => r.success)
        .map((r) => r.content)
        .join(separator);
    },

  /**
   * Take the first successful result
   */
  first:
    () =>
    (results: StepResult[]): string => {
      const first = results.find((r) => r.success);
      return first?.content ?? '';
    },

  /**
   * Take the last successful result
   */
  last:
    () =>
    (results: StepResult[]): string => {
      const successful = results.filter((r) => r.success);
      return successful[successful.length - 1]?.content ?? '';
    },

  /**
   * Select best result based on custom criteria
   */
  best:
    (scorer: (result: StepResult) => number) =>
    (results: StepResult[]): string => {
      const scored = results
        .filter((r) => r.success)
        .map((r) => ({ result: r, score: scorer(r) }))
        .sort((a, b) => b.score - a.score);
      return scored[0]?.result.content ?? '';
    },

  /**
   * Apply a custom reducer
   */
  reduce:
    <T>(reducer: (acc: T, result: StepResult) => T, initial: T, finalize: (acc: T) => string) =>
    (results: StepResult[]): string => {
      const accumulated = results.filter((r) => r.success).reduce(reducer, initial);
      return finalize(accumulated);
    },

  /**
   * Format results as structured output
   */
  structured:
    (format: 'json' | 'markdown' | 'list' = 'markdown') =>
    (results: StepResult[]): string => {
      const successful = results.filter((r) => r.success);

      switch (format) {
        case 'json':
          return JSON.stringify(
            successful.map((r) => ({ agent: r.agentId, content: r.content })),
            null,
            2
          );
        case 'list':
          return successful.map((r) => `- [${r.agentId}]: ${r.content}`).join('\n');
        case 'markdown':
        default:
          return successful.map((r) => `## ${r.agentId}\n\n${r.content}`).join('\n\n');
      }
    },
} as const;

/**
 * Main Society Builder - the primary entry point for creating AI agent societies
 *
 * @example
 * ```typescript
 * const result = await Society.create()
 *   .withName('Review Team')
 *   .addAgent(a => a.withId('writer').withModel(model).withRole(r => r.withSystemPrompt('...')))
 *   .addAgent(a => a.withId('editor').withModel(model).withRole(r => r.withSystemPrompt('...')))
 *   .addStep(s => s.withId('draft').withAgents(['writer']).sequential())
 *   .addStep(s => s.withId('review').withAgents(['editor']).sequential())
 *   .execute('Write a blog post about AI');
 * ```
 */
export class Society {
  private _id: string = '';
  private _name: string = '';
  private _description?: string;
  private _agents: AgentConfig[] = [];
  private _steps: WorkflowStep[] = [];
  private _entryStepId?: string;
  private _globalContext: Record<string, unknown> = {};
  private _observer?: SocietyObserver;
  private _onBeforeStep?: WorkflowConfig['onBeforeStep'];
  private _onAfterStep?: WorkflowConfig['onAfterStep'];
  private _finalResultGenerator?: WorkflowConfig['finalResultGenerator'];
  // Pipeline config is applied via usePipeline() to set steps
  private _timeout?: number;

  /**
   * Create a new Society builder
   */
  static create(id?: string): Society {
    const society = new Society();
    if (id) {
      society._id = id;
      society._name = id;
    }
    return society;
  }

  /**
   * Set the society ID
   */
  withId(id: string): this {
    this._id = id;
    if (!this._name) this._name = id;
    return this;
  }

  /**
   * Set the society name
   */
  withName(name: string): this {
    this._name = name;
    if (!this._id) this._id = name.toLowerCase().replace(/\s+/g, '-');
    return this;
  }

  /**
   * Set the society description
   */
  withDescription(description: string): this {
    this._description = description;
    return this;
  }

  /**
   * Add an agent using a builder function
   */
  addAgent(builderFn: (builder: FluentAgentBuilder) => FluentAgentBuilder): this {
    const builder = new FluentAgentBuilder();
    this._agents.push(builderFn(builder).build());
    return this;
  }

  /**
   * Add an agent directly
   */
  useAgent(agent: AgentConfig): this {
    this._agents.push(agent);
    return this;
  }

  /**
   * Add multiple agents at once
   */
  useAgents(agents: AgentConfig[]): this {
    this._agents.push(...agents);
    return this;
  }

  /**
   * Add a workflow step using a builder function
   */
  addStep(builderFn: (builder: FluentStepBuilder) => FluentStepBuilder): this {
    const builder = new FluentStepBuilder();
    this._steps.push(builderFn(builder).build());
    return this;
  }

  /**
   * Add a step directly
   */
  useStep(step: WorkflowStep): this {
    this._steps.push(step);
    return this;
  }

  /**
   * Add multiple steps at once
   */
  useSteps(steps: WorkflowStep[]): this {
    this._steps.push(...steps);
    return this;
  }

  /**
   * Configure a pipeline pattern
   */
  usePipeline(builderFn: (builder: FluentPipelineBuilder) => FluentPipelineBuilder): this {
    const builder = new FluentPipelineBuilder();
    const pipeline = builderFn(builder);
    // Pipeline config is stored implicitly through steps
    this._steps = pipeline.toSteps();
    return this;
  }

  /**
   * Set the entry step for workflow execution
   */
  startAt(stepId: string): this {
    this._entryStepId = stepId;
    return this;
  }

  /**
   * Set global context available to all agents
   */
  withGlobalContext(context: Record<string, unknown>): this {
    this._globalContext = context;
    return this;
  }

  /**
   * Add a key-value pair to global context
   */
  addGlobalContext(key: string, value: unknown): this {
    this._globalContext[key] = value;
    return this;
  }

  /**
   * Set an observer for monitoring execution
   */
  withObserver(observer: SocietyObserver): this {
    this._observer = observer;
    return this;
  }

  /**
   * Add a hook to run before each step
   */
  beforeStep(handler: WorkflowConfig['onBeforeStep']): this {
    this._onBeforeStep = handler;
    return this;
  }

  /**
   * Add a hook to run after each step
   */
  afterStep(handler: WorkflowConfig['onAfterStep']): this {
    this._onAfterStep = handler;
    return this;
  }

  /**
   * Set a custom function to generate the final result
   */
  withFinalResultGenerator(generator: WorkflowConfig['finalResultGenerator']): this {
    this._finalResultGenerator = generator;
    return this;
  }

  /**
   * Set a global timeout for execution
   */
  withTimeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Quickly create a scatter-gather workflow
   * Executes all agents in parallel and aggregates results
   */
  scatterGather(aggregator?: (results: StepResult[]) => string): this {
    const agentIds = this._agents.map((a) => a.id);
    this._steps = [
      {
        id: 'scatter-gather',
        name: 'Parallel Processing',
        agentIds,
        executionType: 'parallel',
        resultTransformer: aggregator as
          | ((results: StepResult | StepResult[]) => unknown)
          | undefined,
      },
    ];
    return this;
  }

  /**
   * Quickly create a chain workflow
   * Executes agents sequentially, passing context forward
   */
  chain(): this {
    const agentIds = this._agents.map((a) => a.id);
    this._steps = agentIds.map((agentId, index) => ({
      id: `step-${index + 1}`,
      name: `Step ${index + 1}`,
      agentIds: [agentId],
      executionType: 'sequential' as WorkflowStepExecutionType,
      nextSteps: index < agentIds.length - 1 ? [`step-${index + 2}`] : undefined,
    }));
    return this;
  }

  /**
   * Quickly create a collaborative workflow
   * Agents collaborate through multiple iterations
   */
  collaborate(maxIterations: number = 3): this {
    const agentIds = this._agents.map((a) => a.id);
    this._steps = [
      {
        id: 'collaborate',
        name: 'Collaborative Processing',
        agentIds,
        executionType: 'collaborative',
        maxIterations,
      },
    ];
    return this;
  }

  /**
   * Build the workflow configuration
   */
  build(): WorkflowConfig {
    // Auto-generate ID if not set
    if (!this._id) {
      this._id = `society-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    if (!this._name) this._name = this._id;
    if (this._agents.length === 0)
      throw new InvalidConfigurationError('Society must have at least one agent');
    if (this._steps.length === 0)
      throw new InvalidConfigurationError('Society must have at least one step');

    return {
      id: this._id,
      name: this._name,
      description: this._description,
      agents: this._agents,
      steps: this._steps,
      entryStepId: this._entryStepId ?? this._steps[0].id,
      globalContext: this._globalContext,
      onBeforeStep: this._onBeforeStep,
      onAfterStep: this._onAfterStep,
      finalResultGenerator: this._finalResultGenerator,
    };
  }

  /**
   * Build and execute the society with the given input
   */
  async execute(input: string, signal?: AbortSignal): Promise<WorkflowResult> {
    const workflow = this.build();
    const executor = new DefaultWorkflowExecutor(this._observer);

    // Handle timeout
    let timeoutSignal: AbortSignal | undefined = signal;
    let timeoutId: NodeJS.Timeout | undefined;

    if (this._timeout) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), this._timeout);

      // Combine with external signal if provided
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }
      timeoutSignal = controller.signal;
    }

    try {
      const result = await executor.execute(workflow, input, timeoutSignal);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  }
}

// ============================================================================
// QUICK HELPERS
// ============================================================================

/**
 * Quick factory for common society patterns
 */
export const SocietyPatterns = {
  /**
   * Create a simple parallel processing society
   */
  parallel: (agents: AgentConfig[]) => {
    return Society.create('parallel')
      .withName('Parallel Society')
      .useAgents(agents)
      .scatterGather(AggregationStrategies.concat('\n\n---\n\n'));
  },

  /**
   * Create a sequential chain society
   */
  chain: (agents: AgentConfig[]) => {
    return Society.create('chain').withName('Chain Society').useAgents(agents).chain();
  },

  /**
   * Create a collaborative society
   */
  collaborative: (agents: AgentConfig[], maxIterations: number = 3) => {
    return Society.create('collaborative')
      .withName('Collaborative Society')
      .useAgents(agents)
      .collaborate(maxIterations);
  },

  /**
   * Create a review pipeline (draft -> review -> revise)
   */
  review: (writer: AgentConfig, reviewer: AgentConfig) => {
    return Society.create('review')
      .withName('Review Pipeline')
      .useAgents([writer, reviewer])
      .addStep((s) =>
        s.withId('draft').withName('Create Draft').withAgents([writer.id]).sequential()
      )
      .addStep((s) =>
        s
          .withId('review')
          .withName('Review Draft')
          .withAgents([reviewer.id])
          .sequential()
          .withInstructions('Review the previous draft and provide feedback')
      )
      .addStep((s) =>
        s
          .withId('revise')
          .withName('Revise Draft')
          .withAgents([writer.id])
          .sequential()
          .withInstructions('Revise the draft based on the review feedback')
      );
  },
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Quick helper to create a role
 */
export function createRole(
  id: string,
  systemPrompt: string,
  options?: {
    name?: string;
    description?: string;
    capabilities?: string[];
    constraints?: string[];
    promptTemplate?: string;
  }
): AgentRole {
  const builder = new FluentRoleBuilder().withId(id).withSystemPrompt(systemPrompt);

  if (options?.name) builder.withName(options.name);
  if (options?.description) builder.withDescription(options.description);
  if (options?.capabilities) builder.withCapabilities(options.capabilities);
  if (options?.constraints) builder.withConstraints(options.constraints);
  if (options?.promptTemplate) builder.withPromptTemplate(options.promptTemplate);

  return builder.build();
}

/**
 * Quick helper to create an agent
 */
export function createAgent(
  id: string,
  role: AgentRole,
  model: AIModel,
  options?: {
    name?: string;
    priority?: number;
    canCommunicateWith?: string[];
  }
): AgentConfig {
  const builder = new FluentAgentBuilder().withId(id).useRole(role).withModel(model);

  if (options?.name) builder.withName(options.name);
  if (options?.priority) builder.withPriority(options.priority);
  if (options?.canCommunicateWith) {
    builder.canCommunicateWith(options.canCommunicateWith);
  }

  return builder.build();
}

// Note: FluentRoleBuilder, FluentAgentBuilder, FluentStepBuilder, FluentPipelineBuilder
// are exported directly. The legacy RoleBuilder, AgentBuilder, StepBuilder from society.ts
// are preserved for backward compatibility.
