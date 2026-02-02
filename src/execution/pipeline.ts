/**
 * @fileoverview Pipeline Patterns for SocietyAI
 *
 * This module provides composable pipeline patterns for orchestrating
 * agent execution. Pipelines define the flow and coordination of agents.
 *
 * Supported patterns:
 * - Chain: Sequential execution, output feeds next input
 * - Scatter-Gather: Parallel execution with result aggregation
 * - Router: Dynamic routing based on input or context
 * - Splitter: Divide input and process parts separately
 * - Aggregator: Combine multiple results into one
 * - Saga: Distributed transactions with compensation
 * - CircuitBreaker: Fault tolerance pattern
 *
 * Design principles:
 * - Model-agnostic: Works with any AI model
 * - Composable: Pipelines can be nested and combined
 * - Type-safe: Full TypeScript support
 * - Zero runtime deps: Pure TypeScript implementation
 *
 * @example
 * ```typescript
 * const pipeline = Pipeline.create()
 *   .scatter(['analyst-1', 'analyst-2', 'analyst-3'])
 *   .gather(Strategies.consensus(0.6))
 *   .chain(['reviewer', 'editor'])
 *   .build();
 *
 * const result = await pipeline.execute(input, agents);
 * ```
 */

import { AgentConfig, StepResult } from '../core/types';
import { AggregationStrategy, Strategies } from './strategies';
import { getLogger } from '../observability/logger';
import { WorkerPool } from '../utils/worker-pool';

// ============================================================================
// PIPELINE TYPES
// ============================================================================

/**
 * Pipeline execution context
 */
export interface PipelineContext {
  /** Original input */
  input: string;
  /** Current intermediate result */
  currentResult: string;
  /** All step results */
  stepResults: StepResult[];
  /** Shared data between steps */
  sharedData: Map<string, unknown>;
  /** Metadata */
  metadata: Map<string, unknown>;
  /** Start time */
  startTime: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Result from pipeline execution
 */
export interface PipelineResult {
  /** Final output */
  output: string;
  /** Success status */
  success: boolean;
  /** All step results */
  stepResults: StepResult[];
  /** Execution duration in ms */
  duration: number;
  /** Errors if any */
  errors?: Error[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Pipeline step definition
 */
export interface PipelineStep {
  /** Step type */
  type:
    | 'chain'
    | 'scatter'
    | 'gather'
    | 'router'
    | 'splitter'
    | 'aggregator'
    | 'transform'
    | 'condition';
  /** Agent IDs involved */
  agentIds?: string[];
  /** Aggregation strategy for gather/aggregator */
  strategy?: AggregationStrategy;
  /** Router function */
  router?: (input: string, ctx: PipelineContext) => string;
  /** Splitter function */
  splitter?: (input: string) => string[];
  /** Transform function */
  transformer?: (result: string, ctx: PipelineContext) => string;
  /** Condition function */
  condition?: (ctx: PipelineContext) => boolean;
  /** Nested pipeline for conditional execution */
  thenPipeline?: Pipeline;
  /** Alternative pipeline for false condition */
  elsePipeline?: Pipeline;
  /** Step name for debugging */
  name?: string;
}

/**
 * Pipeline interface
 */
export interface Pipeline {
  /** Execute the pipeline */
  execute(
    input: string,
    agents: Map<string, AgentConfig>,
    signal?: AbortSignal
  ): Promise<PipelineResult>;
  /** Get pipeline steps */
  getSteps(): readonly PipelineStep[];
  /** Get pipeline name */
  getName(): string;
}

// ============================================================================
// PIPELINE BUILDER
// ============================================================================

/**
 * Builder for creating pipelines with fluent API
 */
export class PipelineBuilder {
  private steps: PipelineStep[] = [];
  private _name: string = 'pipeline';
  private _timeout?: number;
  private _onStepComplete?: (step: PipelineStep, result: StepResult[]) => void;

  /**
   * Create a new pipeline builder
   */
  static create(name?: string): PipelineBuilder {
    const builder = new PipelineBuilder();
    if (name) builder._name = name;
    return builder;
  }

  /**
   * Set pipeline name
   */
  withName(name: string): this {
    this._name = name;
    return this;
  }

  /**
   * Set timeout for pipeline execution
   */
  withTimeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Set step completion handler
   */
  onStepComplete(handler: (step: PipelineStep, result: StepResult[]) => void): this {
    this._onStepComplete = handler;
    return this;
  }

  // ========================================================================
  // CHAIN PATTERN
  // ========================================================================

  /**
   * Add a chain step - execute agents sequentially, passing output forward
   */
  chain(agentIds: string[], name?: string): this {
    this.steps.push({
      type: 'chain',
      agentIds,
      name: name ?? `chain-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Add a single agent to the chain
   */
  then(agentId: string, name?: string): this {
    return this.chain([agentId], name);
  }

  // ========================================================================
  // SCATTER-GATHER PATTERN
  // ========================================================================

  /**
   * Scatter to multiple agents in parallel
   */
  scatter(agentIds: string[], name?: string): this {
    this.steps.push({
      type: 'scatter',
      agentIds,
      name: name ?? `scatter-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Gather results using a strategy
   */
  gather(strategy: AggregationStrategy = Strategies.concat('\n\n'), name?: string): this {
    this.steps.push({
      type: 'gather',
      strategy,
      name: name ?? `gather-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Convenience method: scatter then gather
   */
  scatterGather(
    agentIds: string[],
    strategy: AggregationStrategy = Strategies.concat('\n\n'),
    name?: string
  ): this {
    return this.scatter(agentIds, name ? `${name}-scatter` : undefined).gather(
      strategy,
      name ? `${name}-gather` : undefined
    );
  }

  // ========================================================================
  // ROUTER PATTERN
  // ========================================================================

  /**
   * Route to a specific agent based on input/context
   */
  route(
    agentIds: string[],
    router: (input: string, ctx: PipelineContext) => string,
    name?: string
  ): this {
    this.steps.push({
      type: 'router',
      agentIds,
      router,
      name: name ?? `router-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Route based on content matching
   */
  routeByContent(
    routes: Array<{ match: RegExp | string; agentId: string }>,
    defaultAgentId: string,
    name?: string
  ): this {
    return this.route(
      [...routes.map((r) => r.agentId), defaultAgentId],
      (input) => {
        for (const route of routes) {
          if (typeof route.match === 'string') {
            if (input.includes(route.match)) return route.agentId;
          } else {
            if (route.match.test(input)) return route.agentId;
          }
        }
        return defaultAgentId;
      },
      name
    );
  }

  // ========================================================================
  // SPLITTER PATTERN
  // ========================================================================

  /**
   * Split input and process parts separately
   */
  split(agentId: string, splitter: (input: string) => string[], name?: string): this {
    this.steps.push({
      type: 'splitter',
      agentIds: [agentId],
      splitter,
      name: name ?? `splitter-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Split by delimiter
   */
  splitByDelimiter(agentId: string, delimiter: string | RegExp, name?: string): this {
    return this.split(
      agentId,
      (input) => input.split(delimiter).filter((s) => s.trim() !== ''),
      name
    );
  }

  /**
   * Split by lines
   */
  splitByLines(agentId: string, name?: string): this {
    return this.splitByDelimiter(agentId, '\n', name);
  }

  // ========================================================================
  // AGGREGATOR PATTERN
  // ========================================================================

  /**
   * Aggregate previous results using a strategy
   */
  aggregate(strategy: AggregationStrategy, name?: string): this {
    this.steps.push({
      type: 'aggregator',
      strategy,
      name: name ?? `aggregator-${this.steps.length}`,
    });
    return this;
  }

  // ========================================================================
  // TRANSFORM PATTERN
  // ========================================================================

  /**
   * Transform the current result
   */
  transform(transformer: (result: string, ctx: PipelineContext) => string, name?: string): this {
    this.steps.push({
      type: 'transform',
      transformer,
      name: name ?? `transform-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Add prefix to result
   */
  prefix(text: string): this {
    return this.transform((result) => `${text}${result}`, 'prefix');
  }

  /**
   * Add suffix to result
   */
  suffix(text: string): this {
    return this.transform((result) => `${result}${text}`, 'suffix');
  }

  /**
   * Wrap result
   */
  wrap(before: string, after: string): this {
    return this.transform((result) => `${before}${result}${after}`, 'wrap');
  }

  // ========================================================================
  // CONDITIONAL PATTERN
  // ========================================================================

  /**
   * Conditional execution
   */
  when(
    condition: (ctx: PipelineContext) => boolean,
    thenPipeline: (builder: PipelineBuilder) => PipelineBuilder,
    elsePipeline?: (builder: PipelineBuilder) => PipelineBuilder,
    name?: string
  ): this {
    const thenBuilder = thenPipeline(PipelineBuilder.create());
    const elseBuilder = elsePipeline ? elsePipeline(PipelineBuilder.create()) : undefined;

    this.steps.push({
      type: 'condition',
      condition,
      thenPipeline: thenBuilder.build(),
      elsePipeline: elseBuilder?.build(),
      name: name ?? `condition-${this.steps.length}`,
    });
    return this;
  }

  /**
   * Execute only if condition is true
   */
  onlyIf(condition: (ctx: PipelineContext) => boolean, agentIds: string[], name?: string): this {
    return this.when(condition, (builder) => builder.chain(agentIds), undefined, name);
  }

  // ========================================================================
  // BUILD
  // ========================================================================

  /**
   * Build the pipeline
   */
  build(): Pipeline {
    return new ExecutablePipeline(this._name, [...this.steps], this._timeout, this._onStepComplete);
  }
}

// ============================================================================
// EXECUTABLE PIPELINE
// ============================================================================

/**
 * Executable pipeline implementation
 */
class ExecutablePipeline implements Pipeline {
  private logger = getLogger();

  constructor(
    private name: string,
    private steps: PipelineStep[],
    private timeout?: number,
    private onStepComplete?: (step: PipelineStep, result: StepResult[]) => void
  ) {}

  getName(): string {
    return this.name;
  }

  getSteps(): readonly PipelineStep[] {
    return this.steps;
  }

  async execute(
    input: string,
    agents: Map<string, AgentConfig>,
    signal?: AbortSignal
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const ctx: PipelineContext = {
      input,
      currentResult: input,
      stepResults: [],
      sharedData: new Map(),
      metadata: new Map(),
      startTime,
      signal,
    };

    const errors: Error[] = [];

    try {
      // Handle timeout
      let timeoutSignal = signal;
      let timeoutId: NodeJS.Timeout | undefined;

      if (this.timeout) {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), this.timeout);
        if (signal) {
          signal.addEventListener('abort', () => controller.abort());
        }
        timeoutSignal = controller.signal;
        ctx.signal = timeoutSignal;
      }

      try {
        // Execute each step
        for (const step of this.steps) {
          if (ctx.signal?.aborted) {
            throw new Error('Pipeline execution cancelled');
          }

          this.logger.debug(`Executing pipeline step: ${step.name}`);

          const stepResults = await this.executeStep(step, ctx, agents);
          ctx.stepResults.push(...stepResults);

          this.onStepComplete?.(step, stepResults);
        }

        if (timeoutId) clearTimeout(timeoutId);
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
      }

      return {
        output: ctx.currentResult,
        success: true,
        stepResults: ctx.stepResults,
        duration: Date.now() - startTime,
        metadata: Object.fromEntries(ctx.metadata),
      };
    } catch (error) {
      errors.push(error as Error);
      return {
        output: ctx.currentResult,
        success: false,
        stepResults: ctx.stepResults,
        duration: Date.now() - startTime,
        errors,
        metadata: Object.fromEntries(ctx.metadata),
      };
    }
  }

  private async executeStep(
    step: PipelineStep,
    ctx: PipelineContext,
    agents: Map<string, AgentConfig>
  ): Promise<StepResult[]> {
    switch (step.type) {
      case 'chain':
        return this.executeChain(step, ctx, agents);
      case 'scatter':
        return this.executeScatter(step, ctx, agents);
      case 'gather':
        return this.executeGather(step, ctx);
      case 'router':
        return this.executeRouter(step, ctx, agents);
      case 'splitter':
        return this.executeSplitter(step, ctx, agents);
      case 'aggregator':
        return this.executeAggregator(step, ctx);
      case 'transform':
        return this.executeTransform(step, ctx);
      case 'condition':
        return this.executeCondition(step, ctx, agents);
      default:
        throw new Error(`Unknown step type: ${(step as PipelineStep).type}`);
    }
  }

  private async executeChain(
    step: PipelineStep,
    ctx: PipelineContext,
    agents: Map<string, AgentConfig>
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    for (const agentId of step.agentIds ?? []) {
      if (ctx.signal?.aborted) throw new Error('Cancelled');

      const agent = agents.get(agentId);
      if (!agent) {
        this.logger.error(`Agent ${agentId} not found`);
        continue;
      }

      const prompt = this.buildPrompt(agent, ctx.currentResult, ctx);

      try {
        const content = await agent.model.process(prompt, ctx.signal);
        const result: StepResult = {
          agentId,
          stepId: step.name ?? 'chain',
          content,
          timestamp: Date.now(),
          success: true,
        };
        results.push(result);
        ctx.currentResult = content;
      } catch (error) {
        results.push({
          agentId,
          stepId: step.name ?? 'chain',
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error as Error,
        });
      }
    }

    return results;
  }

  private async executeScatter(
    step: PipelineStep,
    ctx: PipelineContext,
    agents: Map<string, AgentConfig>
  ): Promise<StepResult[]> {
    const pool = new WorkerPool(step.agentIds?.length ?? 5, ctx.signal);
    const results: StepResult[] = [];

    const tasks = (step.agentIds ?? []).map((agentId) => async (): Promise<StepResult> => {
      const agent = agents.get(agentId);
      if (!agent) {
        return {
          agentId,
          stepId: step.name ?? 'scatter',
          content: '',
          timestamp: Date.now(),
          success: false,
          error: new Error(`Agent ${agentId} not found`),
        };
      }

      const prompt = this.buildPrompt(agent, ctx.currentResult, ctx);

      try {
        const content = await agent.model.process(prompt, ctx.signal);
        return {
          agentId,
          stepId: step.name ?? 'scatter',
          content,
          timestamp: Date.now(),
          success: true,
        };
      } catch (error) {
        return {
          agentId,
          stepId: step.name ?? 'scatter',
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error as Error,
        };
      }
    });

    const taskResults = await Promise.all(tasks.map((task) => pool.submit(task)));
    await pool.waitAll();

    results.push(...taskResults);

    // Store scatter results for gather step
    ctx.sharedData.set('scatterResults', results);

    return results;
  }

  private async executeGather(step: PipelineStep, ctx: PipelineContext): Promise<StepResult[]> {
    const scatterResults = ctx.sharedData.get('scatterResults') as StepResult[] | undefined;
    if (!scatterResults) {
      this.logger.debug('No scatter results to gather');
      return [];
    }

    const strategy = step.strategy ?? Strategies.concat('\n\n');
    ctx.currentResult = strategy.aggregate(scatterResults);
    ctx.sharedData.delete('scatterResults');

    return [
      {
        agentId: 'gather',
        stepId: step.name ?? 'gather',
        content: ctx.currentResult,
        timestamp: Date.now(),
        success: true,
        metadata: { strategy: strategy.name },
      },
    ];
  }

  private async executeRouter(
    step: PipelineStep,
    ctx: PipelineContext,
    agents: Map<string, AgentConfig>
  ): Promise<StepResult[]> {
    if (!step.router) {
      throw new Error('Router step requires a router function');
    }

    const selectedAgentId = step.router(ctx.currentResult, ctx);
    const agent = agents.get(selectedAgentId);

    if (!agent) {
      throw new Error(`Routed agent ${selectedAgentId} not found`);
    }

    const prompt = this.buildPrompt(agent, ctx.currentResult, ctx);
    const content = await agent.model.process(prompt, ctx.signal);

    ctx.currentResult = content;

    return [
      {
        agentId: selectedAgentId,
        stepId: step.name ?? 'router',
        content,
        timestamp: Date.now(),
        success: true,
        metadata: { routed: true },
      },
    ];
  }

  private async executeSplitter(
    step: PipelineStep,
    ctx: PipelineContext,
    agents: Map<string, AgentConfig>
  ): Promise<StepResult[]> {
    if (!step.splitter) {
      throw new Error('Splitter step requires a splitter function');
    }

    const parts = step.splitter(ctx.currentResult);
    const agentId = step.agentIds?.[0];
    if (!agentId) {
      throw new Error('Splitter step requires at least one agent');
    }

    const agent = agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const results: StepResult[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (ctx.signal?.aborted) throw new Error('Cancelled');

      const part = parts[i];
      const prompt = this.buildPrompt(agent, part, ctx);

      try {
        const content = await agent.model.process(prompt, ctx.signal);
        results.push({
          agentId,
          stepId: `${step.name ?? 'splitter'}-${i}`,
          content,
          timestamp: Date.now(),
          success: true,
          metadata: { partIndex: i },
        });
      } catch (error) {
        results.push({
          agentId,
          stepId: `${step.name ?? 'splitter'}-${i}`,
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error as Error,
          metadata: { partIndex: i },
        });
      }
    }

    // Combine split results
    ctx.currentResult = results
      .filter((r) => r.success)
      .map((r) => r.content)
      .join('\n\n');

    return results;
  }

  private async executeAggregator(step: PipelineStep, ctx: PipelineContext): Promise<StepResult[]> {
    const strategy = step.strategy ?? Strategies.concat('\n\n');
    ctx.currentResult = strategy.aggregate(ctx.stepResults);

    return [
      {
        agentId: 'aggregator',
        stepId: step.name ?? 'aggregator',
        content: ctx.currentResult,
        timestamp: Date.now(),
        success: true,
        metadata: { strategy: strategy.name },
      },
    ];
  }

  private async executeTransform(step: PipelineStep, ctx: PipelineContext): Promise<StepResult[]> {
    if (!step.transformer) {
      throw new Error('Transform step requires a transformer function');
    }

    ctx.currentResult = step.transformer(ctx.currentResult, ctx);

    return [
      {
        agentId: 'transform',
        stepId: step.name ?? 'transform',
        content: ctx.currentResult,
        timestamp: Date.now(),
        success: true,
      },
    ];
  }

  private async executeCondition(
    step: PipelineStep,
    ctx: PipelineContext,
    agents: Map<string, AgentConfig>
  ): Promise<StepResult[]> {
    if (!step.condition) {
      throw new Error('Condition step requires a condition function');
    }

    const conditionResult = step.condition(ctx);
    const pipeline = conditionResult ? step.thenPipeline : step.elsePipeline;

    if (!pipeline) {
      return [];
    }

    const result = await pipeline.execute(ctx.currentResult, agents, ctx.signal);
    ctx.currentResult = result.output;

    return result.stepResults;
  }

  private buildPrompt(agent: AgentConfig, input: string, ctx: PipelineContext): string {
    const template = agent.role.promptTemplate ?? '{systemPrompt}\n\n{input}';

    return template
      .replace('{systemPrompt}', agent.role.systemPrompt)
      .replace('{input}', input)
      .replace('{context}', JSON.stringify(Object.fromEntries(ctx.sharedData)));
  }
}

// ============================================================================
// PRESET PIPELINES
// ============================================================================

/**
 * Pre-built pipeline patterns for common use cases
 */
export const Pipelines = {
  /**
   * Simple chain pipeline
   */
  chain: (...agentIds: string[]) => PipelineBuilder.create('chain').chain(agentIds).build(),

  /**
   * Scatter-gather pipeline
   */
  scatterGather: (agentIds: string[], strategy?: AggregationStrategy) =>
    PipelineBuilder.create('scatter-gather').scatterGather(agentIds, strategy).build(),

  /**
   * Round-robin: each agent processes, then next
   */
  roundRobin: (agentIds: string[], rounds: number = 1) => {
    const builder = PipelineBuilder.create('round-robin');
    for (let i = 0; i < rounds; i++) {
      builder.chain(agentIds, `round-${i + 1}`);
    }
    return builder.build();
  },

  /**
   * Fan-out fan-in: scatter, process, gather
   */
  fanOutFanIn: (
    scatterAgentIds: string[],
    processAgentId: string,
    strategy?: AggregationStrategy
  ) =>
    PipelineBuilder.create('fan-out-fan-in')
      .scatter(scatterAgentIds)
      .gather(strategy)
      .then(processAgentId)
      .build(),

  /**
   * Review pipeline: draft -> review -> revise
   */
  review: (drafterId: string, reviewerId: string) =>
    PipelineBuilder.create('review')
      .then(drafterId, 'draft')
      .then(reviewerId, 'review')
      .then(drafterId, 'revise')
      .build(),

  /**
   * Consensus pipeline: scatter, vote, finalize
   */
  consensus: (agentIds: string[], finalizerId: string, threshold: number = 0.6) =>
    PipelineBuilder.create('consensus')
      .scatter(agentIds)
      .gather(Strategies.consensus(threshold))
      .then(finalizerId, 'finalize')
      .build(),

  /**
   * Expert routing: route to specialist based on content
   */
  expertRouting: (
    routes: Array<{ match: RegExp | string; agentId: string }>,
    defaultAgentId: string
  ) => PipelineBuilder.create('expert-routing').routeByContent(routes, defaultAgentId).build(),

  /**
   * Iterative refinement: agent refines its own output
   */
  iterativeRefinement: (agentId: string, iterations: number = 3) => {
    const builder = PipelineBuilder.create('iterative-refinement');
    for (let i = 0; i < iterations; i++) {
      builder.then(agentId, `iteration-${i + 1}`);
    }
    return builder.build();
  },

  /**
   * Debate pipeline: two agents debate, third judges
   */
  debate: (agent1Id: string, agent2Id: string, judgeId: string, rounds: number = 2) => {
    const builder = PipelineBuilder.create('debate');

    for (let i = 0; i < rounds; i++) {
      builder
        .scatter([agent1Id, agent2Id], `debate-round-${i + 1}`)
        .gather(Strategies.format('markdown'), `gather-round-${i + 1}`);
    }

    return builder.then(judgeId, 'judge').build();
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Compose multiple pipelines into one
 */
export function composePipelines(...pipelines: Pipeline[]): Pipeline {
  const allSteps: PipelineStep[] = [];

  for (const pipeline of pipelines) {
    allSteps.push(...pipeline.getSteps());
  }

  return {
    getName: () => 'composed-pipeline',
    getSteps: () => allSteps,
    execute: async (input, agents, signal): Promise<PipelineResult> => {
      let currentInput = input;
      const allResults: StepResult[] = [];
      const startTime = Date.now();

      for (const pipeline of pipelines) {
        const result = await pipeline.execute(currentInput, agents, signal);
        allResults.push(...result.stepResults);
        currentInput = result.output;

        if (!result.success) {
          return {
            output: currentInput,
            success: false,
            stepResults: allResults,
            duration: Date.now() - startTime,
            errors: result.errors,
            metadata: {},
          };
        }
      }

      return {
        output: currentInput,
        success: true,
        stepResults: allResults,
        duration: Date.now() - startTime,
        metadata: {},
      };
    },
  };
}

/**
 * Create a parallel pipeline that runs multiple pipelines and aggregates results
 */
export function parallelPipelines(
  pipelines: Pipeline[],
  strategy: AggregationStrategy = Strategies.concat('\n\n')
): Pipeline {
  return {
    getName: () => 'parallel-pipelines',
    getSteps: () => pipelines.flatMap((p) => p.getSteps()),
    execute: async (input, agents, signal): Promise<PipelineResult> => {
      const startTime = Date.now();

      const results = await Promise.all(pipelines.map((p) => p.execute(input, agents, signal)));

      const allStepResults: StepResult[] = results.flatMap((r) => r.stepResults);
      const stepResultsForAggregation: StepResult[] = results.map((r, i) => ({
        agentId: `pipeline-${i}`,
        stepId: pipelines[i].getName(),
        content: r.output,
        timestamp: Date.now(),
        success: r.success,
      }));

      const output = strategy.aggregate(stepResultsForAggregation);
      const success = results.every((r) => r.success);

      return {
        output,
        success,
        stepResults: allStepResults,
        duration: Date.now() - startTime,
        errors: results.flatMap((r) => r.errors ?? []),
        metadata: {},
      };
    },
  };
}
