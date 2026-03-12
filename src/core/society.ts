import {
  Agent,
  SocietyConfig,
  Task,
  TaskExecutionType,
  TaskResult,
  SocietyResult,
  SocietyObserver,
  RetentionPolicy,
} from './types';
import { SocietyExecutor } from '../agents/society-executor';
import { InvalidConfigurationError } from './errors';
import { Middleware, MiddlewareChain, ComposedMiddleware } from './middleware';
import { FluentAgentBuilder } from '../builders/agent-builder';
import {
  FluentTaskBuilder,
  FluentPipelineBuilder,
  AggregationStrategies,
} from '../builders/society-builder';

/**
 * Main Society Builder - the primary entry point for creating AI agent societies
 *
 * @example
 * ```typescript
 * const result = await Society.create()
 *   .withName('Review Team')
 *   .addAgent(a => a.withId('writer').withModel(model).withRole(r => r.withSystemPrompt('...')))
 *   .addAgent(a => a.withId('editor').withModel(model).withRole(r => r.withSystemPrompt('...')))
 *   .addTask(s => s.withId('draft').withAgents(['writer']).sequential())
 *   .addTask(s => s.withId('review').withAgents(['editor']).sequential())
 *   .execute('Write a blog post about AI');
 * ```
 */
export class Society {
  private _id: string = '';
  private _name: string = '';
  private _description?: string;
  private _agents: Agent[] = [];
  private _tasks: Task[] = [];
  private _entryTaskId?: string;
  private _globalContext: Record<string, unknown> = {};
  private _observer?: SocietyObserver;
  private _middlewares: Middleware[] = [];
  private _onBeforeTask?: SocietyConfig['onBeforeTask'];
  private _onAfterTask?: SocietyConfig['onAfterTask'];
  private _finalResultGenerator?: SocietyConfig['finalResultGenerator'];
  // Pipeline config is applied via usePipeline() to set steps
  private _timeout?: number;
  private _strictRouting: boolean = false;
  private _retentionPolicy?: RetentionPolicy;

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
  useAgent(agent: Agent | FluentAgentBuilder): this {
    if (agent instanceof FluentAgentBuilder) {
      this._agents.push(agent.build());
    } else {
      this._agents.push(agent);
    }
    return this;
  }

  /**
   * Add multiple agents at once
   */
  useAgents(agents: (Agent | FluentAgentBuilder)[]): this {
    this._agents.push(...agents.map((a) => (a instanceof FluentAgentBuilder ? a.build() : a)));
    return this;
  }

  /**
   * Add a task via fluent builder
   */
  addTask(builderFn: (builder: FluentTaskBuilder) => FluentTaskBuilder): this {
    const builder = new FluentTaskBuilder();
    this._tasks.push(builderFn(builder).build());
    return this;
  }

  /**
   * Add a task directly
   */
  useTask(task: Task): this {
    this._tasks.push(task);
    return this;
  }

  /**
   * Add multiple tasks at once
   */
  useTasks(tasks: Task[]): this {
    this._tasks.push(...tasks);
    return this;
  }

  /**
   * Configure a pipeline pattern
   */
  usePipeline(builderFn: (builder: FluentPipelineBuilder) => FluentPipelineBuilder): this {
    if (this._tasks.length > 0) {
      throw new InvalidConfigurationError(
        `[Society] usePipeline() would overwrite ${this._tasks.length} existing task(s). ` +
          `Call usePipeline() before adding tasks individually, or use useTasks() to append.`
      );
    }
    const builder = new FluentPipelineBuilder();
    const pipeline = builderFn(builder);
    // Pipeline config is stored implicitly through tasks
    this._tasks = pipeline.toSteps();
    return this;
  }

  /**
   * Set the entry task for society execution
   */
  withEntryTask(taskId: string): this {
    this._entryTaskId = taskId;
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
   * Enable strict routing mode: requires explicit nextTasks for all intermediate steps.
   * When enabled, will throw InvalidWorkflowRoutingError if a step lacks explicit routing.
   */
  withStrictRouting(strict: boolean = true): this {
    this._strictRouting = strict;
    return this;
  }

  /**
   * Set a retention policy to limit memory usage in long-running executions.
   *
   * @example
   * ```typescript
   * Society.create()
   *   .withRetentionPolicy({ maxMessages: 50, archiveAfter: 100 })
   * ```
   */
  withRetentionPolicy(policy: RetentionPolicy): this {
    this._retentionPolicy = policy;
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
   * Add a middleware to the execution chain.
   *
   * Accepts three forms:
   * - A raw `Middleware` object (name + fn)
   * - A `MiddlewareChain` instance (will be converted to a composed middleware)
   * - A `ComposedMiddleware` instance (wrapped as a named Middleware)
   *
   * @example
   * // Option 1: raw middleware
   * .addMiddleware(Middlewares.logging())
   *
   * // Option 2: a full middleware chain
   * const chain = MiddlewareChain.create()
   *   .use(Middlewares.logging())
   *   .use(Middlewares.retry({ maxAttempts: 3 }));
   * .addMiddleware(chain)
   *
   * // Option 3: composed middleware (result of chain.build())
   * .addMiddleware(chain.build())
   */
  addMiddleware(middleware: Middleware | MiddlewareChain | ComposedMiddleware): this {
    if (middleware instanceof MiddlewareChain) {
      // Flatten the chain's middlewares directly into our list
      for (const m of middleware.getMiddlewares()) {
        this._middlewares.push(m);
      }
    } else if (middleware instanceof ComposedMiddleware) {
      // Wrap the ComposedMiddleware as a named Middleware so it fits the chain
      this._middlewares.push({
        name: 'composed-middleware',
        description: 'Pre-composed middleware chain',
        fn: async (ctx, next) => middleware.executeInChain(ctx, next),
      });
    } else {
      this._middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Add a hook to run before each task
   */
  beforeTask(handler: SocietyConfig['onBeforeTask']): this {
    this._onBeforeTask = handler;
    return this;
  }

  /**
   * Add a hook to run after each task
   */
  afterTask(handler: SocietyConfig['onAfterTask']): this {
    this._onAfterTask = handler;
    return this;
  }

  /**
   * Set a custom function to generate the final result
   */
  withFinalResultGenerator(generator: SocietyConfig['finalResultGenerator']): this {
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
  scatterGather(aggregator?: (results: TaskResult[]) => string): this {
    if (this._tasks.length > 0) {
      throw new InvalidConfigurationError(
        `[Society] scatterGather() would overwrite ${this._tasks.length} existing task(s). ` +
          `Clear tasks before calling scatterGather(), or use .useTasks() to set tasks directly.`
      );
    }
    const agentIds = this._agents.map((a) => a.id);
    this._tasks = [
      {
        id: 'scatter-gather',
        name: 'Parallel Processing',
        agentIds,
        executionType: 'parallel',
        resultTransformer: aggregator as
          | ((results: TaskResult | TaskResult[]) => unknown)
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
    if (this._tasks.length > 0) {
      throw new InvalidConfigurationError(
        `[Society] chain() would overwrite ${this._tasks.length} existing task(s). ` +
          `Clear tasks before calling chain(), or use .useTasks() to set tasks directly.`
      );
    }
    const agentIds = this._agents.map((a) => a.id);
    this._tasks = agentIds.map((agentId, index) => ({
      id: `step-${index + 1}`,
      name: `Step ${index + 1}`,
      agentIds: [agentId],
      executionType: 'sequential' as TaskExecutionType,
    }));
    return this;
  }

  /**
   * Quickly create a collaborative workflow
   * Agents collaborate through multiple iterations
   */
  collaborate(maxIterations: number = 3): this {
    if (this._tasks.length > 0) {
      throw new InvalidConfigurationError(
        `[Society] collaborate() would overwrite ${this._tasks.length} existing task(s). ` +
          `Clear tasks before calling collaborate(), or use .useTasks() to set tasks directly.`
      );
    }
    const agentIds = this._agents.map((a) => a.id);
    this._tasks = [
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
  build(): SocietyConfig {
    // Auto-generate ID if not set
    if (!this._id) {
      this._id = `society-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    if (!this._name) this._name = this._id;

    // Validate configuration
    this.validateConfiguration();

    return {
      id: this._id,
      name: this._name,
      description: this._description,
      agents: this._agents,
      tasks: this._tasks,
      entryTaskId: this._entryTaskId ?? this._tasks[0]?.id,
      globalContext: this._globalContext,
      strictRouting: this._strictRouting,
      retentionPolicy: this._retentionPolicy,
      observer: this._observer,
      middlewares: this._middlewares.length > 0 ? this._middlewares : undefined,
      timeout: this._timeout,
      onBeforeTask: this._onBeforeTask,
      onAfterTask: this._onAfterTask,
      finalResultGenerator: this._finalResultGenerator,
    };
  }

  /**
   * Validate the society configuration before building
   * @throws InvalidConfigurationError if validation fails
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // 1. Check minimum requirements
    if (this._agents.length === 0) {
      errors.push(
        `Society '${this._id || 'unnamed'}' must have at least one agent. ` +
          `Use .addAgent() or .useAgent() to add agents.`
      );
    }

    if (this._tasks.length === 0) {
      errors.push(
        `Society '${this._id || 'unnamed'}' must have at least one task. ` +
          `Use .addTask() or .useTask() to add workflow tasks.`
      );
    }

    // 2. Validate agent references in tasks
    const agentIds = new Set(this._agents.map((a) => a.id));
    for (const step of this._tasks) {
      for (const agentId of step.agentIds) {
        if (!agentIds.has(agentId)) {
          errors.push(
            `Task '${step.id}' references unknown agent '${agentId}'. ` +
              `Available agents: ${Array.from(agentIds).join(', ')}. ` +
              `Did you forget to add this agent with .addAgent()?`
          );
        }
      }
    }

    // 3. Validate task routing (nextTasks references)
    const stepIds = new Set(this._tasks.map((s) => s.id));
    for (const step of this._tasks) {
      if (step.nextTasks) {
        for (const nextId of step.nextTasks) {
          if (!stepIds.has(nextId)) {
            errors.push(
              `Task '${step.id}' routes to unknown task '${nextId}'. ` +
                `Available tasks: ${Array.from(stepIds).join(', ')}. ` +
                `Check your .withNextSteps() or .thenGoto() configuration.`
            );
          }
        }
      }
    }

    // 3b. Validate explicit dependencies references
    for (const step of this._tasks) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(
              `Task '${step.id}' declares dependency on unknown task '${depId}'. ` +
                `Available tasks: ${Array.from(stepIds).join(', ')}. ` +
                `Check your .dependsOn() configuration.`
            );
          }
        }
      }
    }

    // 4. Validate entry task
    if (this._entryTaskId && !stepIds.has(this._entryTaskId)) {
      errors.push(
        `Entry task '${this._entryTaskId}' does not exist. ` +
          `Available tasks: ${Array.from(stepIds).join(', ')}.`
      );
    }

    // 5. Check for duplicate IDs
    const duplicateAgents = this.findDuplicates(this._agents.map((a) => a.id));
    if (duplicateAgents.length > 0) {
      errors.push(
        `Duplicate agent IDs found: ${duplicateAgents.join(', ')}. ` +
          `Each agent must have a unique ID.`
      );
    }

    const duplicateSteps = this.findDuplicates(this._tasks.map((s) => s.id));
    if (duplicateSteps.length > 0) {
      errors.push(
        `Duplicate task IDs found: ${duplicateSteps.join(', ')}. ` +
          `Each task must have a unique ID.`
      );
    }

    // 6. Validate canCommunicateWith references
    for (const agent of this._agents) {
      if (agent.canCommunicateWith) {
        for (const targetId of agent.canCommunicateWith) {
          if (!agentIds.has(targetId)) {
            errors.push(
              `Agent '${agent.id}' can communicate with unknown agent '${targetId}'. ` +
                `Available agents: ${Array.from(agentIds).join(', ')}.`
            );
          }
        }
      }
    }

    // If there are errors, throw with all details
    if (errors.length > 0) {
      throw new InvalidConfigurationError(
        `Configuration validation failed for society '${this._id || 'unnamed'}':\n` +
          errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')
      );
    }
  }

  /**
   * Find duplicate values in an array
   */
  private findDuplicates(arr: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const item of arr) {
      if (seen.has(item)) {
        duplicates.add(item);
      }
      seen.add(item);
    }
    return Array.from(duplicates);
  }

  /**
   * Build and execute the society with the given input
   */
  async execute(input: string, signal?: AbortSignal): Promise<SocietyResult> {
    const workflow = this.build();
    const executor = new SocietyExecutor(this._observer);

    // Prepare Middleware Chain
    let middlewareChain: MiddlewareChain | undefined;
    if (this._middlewares.length > 0) {
      middlewareChain = MiddlewareChain.create();
      this._middlewares.forEach((m) => middlewareChain!.use(m));
    }

    // Handle timeout
    let timeoutSignal: AbortSignal | undefined = signal;
    let timeoutId: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;

    if (this._timeout) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), this._timeout);

      // Combine with external signal if provided
      if (signal) {
        abortListener = (): void => controller.abort();
        signal.addEventListener('abort', abortListener);
      }
      timeoutSignal = controller.signal;
    }

    try {
      const result = await executor.execute(workflow, input, timeoutSignal, middlewareChain);
      if (timeoutId) clearTimeout(timeoutId);
      if (abortListener && signal) signal.removeEventListener('abort', abortListener);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (abortListener && signal) signal.removeEventListener('abort', abortListener);
      throw error;
    }
  }
}

/**
 * Quick factory for common society patterns
 */
export const SocietyPatterns = {
  /**
   * Create a simple parallel processing society
   */
  parallel: (agents: Agent[]) => {
    return Society.create('parallel')
      .withName('Parallel Society')
      .useAgents(agents)
      .scatterGather(AggregationStrategies.concat('\n\n---\n\n'));
  },

  /**
   * Create a sequential chain society
   */
  chain: (agents: Agent[]) => {
    return Society.create('chain').withName('Chain Society').useAgents(agents).chain();
  },

  /**
   * Create a collaborative society
   */
  collaborative: (agents: Agent[], maxIterations: number = 3) => {
    return Society.create('collaborative')
      .withName('Collaborative Society')
      .useAgents(agents)
      .collaborate(maxIterations);
  },

  /**
   * Create a review pipeline (draft -> review -> revise)
   */
  review: (writer: Agent, reviewer: Agent) => {
    return Society.create('review')
      .withName('Review Pipeline')
      .useAgents([writer, reviewer])
      .addTask((s) =>
        s.withId('draft').withName('Create Draft').withAgents([writer.id]).sequential()
      )
      .addTask((s) =>
        s
          .withId('review')
          .withName('Review Draft')
          .withAgents([reviewer.id])
          .sequential()
          .withInstructions('Review the previous draft and provide feedback')
      )
      .addTask((s) =>
        s
          .withId('revise')
          .withName('Revise Draft')
          .withAgents([writer.id])
          .sequential()
          .withInstructions('Revise the draft based on the review feedback')
      );
  },
} as const;
