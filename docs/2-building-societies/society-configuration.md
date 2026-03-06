# Society Configuration (High-Level API)

The `Society` class provides a fluent API to build complex multi-agent systems
without worrying about the underlying graph theory. It is the **recommended
entry point** for all workflows.

For low-level graph control, see
[GraphBuilder & ExecutionEngine](../5-architecture/execution-engine.md).

---

## `Society`

Main entry point for creating multi-agent workflows.

```typescript
import { Society } from 'societyai';

const result = await Society.create()
  .withId('review-team')
  .addAgent((a) =>
    a
      .withId('writer')
      .withRole((r) => r.withSystemPrompt('You are a technical writer.'))
      .withModel(myModel)
  )
  .addAgent((a) =>
    a
      .withId('editor')
      .withRole((r) => r.withSystemPrompt('You review style and clarity.'))
      .withModel(myModel)
  )
  .addTask((t) =>
    t.withId('draft').withAgents(['writer']).sequential()
  )
  .addTask((t) =>
    t
      .withId('review')
      .dependsOn('draft')
      .withAgents(['editor'])
      .sequential()
  )
  .execute('Write a blog post about TypeScript');

console.log(result.output);
```

---

## Methods

### Configuration

| Method | Description |
|---|---|
| `create(id?: string)` | Creates a new `Society` builder. Optional `id` sets both ID and name. |
| `withId(id: string)` | Sets the society ID. |
| `withName(name: string)` | Sets the society display name. |
| `withDescription(desc: string)` | Sets a free-text description. |
| `withTimeout(ms: number)` | Sets a global execution timeout in milliseconds. |
| `withStrictRouting(strict?: boolean)` | When `true`, throws `InvalidWorkflowRoutingError` if a task has no explicit routing. Defaults to `false`. |

### Agent Management

| Method | Description |
|---|---|
| `addAgent(builderFn)` | Adds an agent via a builder callback: `(a: FluentAgentBuilder) => FluentAgentBuilder`. |
| `useAgent(agent)` | Adds a pre-built `Agent` object or `FluentAgentBuilder` instance directly. |
| `useAgents(agents[])` | Adds multiple pre-built agents at once. |

### Task Management

| Method | Description |
|---|---|
| `addTask(builderFn)` | Adds a task via a builder callback: `(t: FluentTaskBuilder) => FluentTaskBuilder`. |
| `useTask(task)` | Adds a pre-built `Task` object directly. |
| `useTasks(tasks[])` | Adds multiple pre-built tasks at once. |
| `withEntryTask(taskId: string)` | Overrides the auto-detected entry task. |

### Context

| Method | Description |
|---|---|
| `withGlobalContext(context: Record<string, unknown>)` | Sets (replaces) the global context object available to all agents via `{context}` in prompt templates. |
| `addGlobalContext(key: string, value: unknown)` | Adds a single key/value pair to the existing global context. |

### Middleware & Observability

| Method | Description |
|---|---|
| `addMiddleware(middleware)` | Adds a `Middleware` object, a `MiddlewareFn`, or a `MiddlewareChain` to the execution pipeline. Applied to every agent call. |
| `withObserver(observer: SocietyObserver)` | Sets an observer for lifecycle hooks (`onAgentStart`, `onAgentComplete`, etc.). |

### Lifecycle Hooks

| Method | Description |
|---|---|
| `beforeTask(handler)` | Registers a callback invoked before each task executes. |
| `afterTask(handler)` | Registers a callback invoked after each task completes. |
| `withFinalResultGenerator(generator)` | Overrides the default logic that selects the final `output` from all task results. |

### Quick Patterns

| Method | Description |
|---|---|
| `chain()` | Wires all added agents into a sequential chain in declaration order. |
| `scatterGather(aggregator?)` | Runs all agents in parallel on the same input and aggregates results. |
| `collaborate(maxIterations?)` | Creates a collaborative (multi-round debate) workflow across all agents. |
| `usePipeline(builderFn)` | Configures a pipeline pattern via `FluentPipelineBuilder`. |

### Build & Execute

| Method | Description |
|---|---|
| `build()` | Returns the `SocietyConfig` object without executing. Useful for inspection or serialisation. |
| `execute(input: string, signal?: AbortSignal)` | Validates configuration, builds the execution graph, runs it, and returns a `SocietyResult`. |

---

## Types

### `SocietyResult`

Returned by `Society.execute()`.

```typescript
interface SocietyResult {
  /** Whether the workflow completed without unhandled errors */
  success: boolean;

  /** Final aggregated output string */
  output: string;

  /** Per-task results, keyed by task ID */
  taskResults: Map<string, TaskResult[]>;

  /** All messages exchanged during collaborative steps */
  messages: Message[];

  /** Total wall-clock execution time in milliseconds */
  duration: number;

  /** Non-fatal errors encountered during execution (if any) */
  errors?: Error[];
}
```

**Accessing results:**

```typescript
const result = await Society.create()
  /* ... */
  .execute('Start');

// Final output (last task result by default)
console.log(result.output);

// Per-task breakdown
const draftResults = result.taskResults.get('draft');
console.log(draftResults?.[0].output);

// Collaborative message history
result.messages.forEach((m) => {
  console.log(`[${m.from} → ${m.to ?? 'all'}]: ${m.content}`);
});

// Timing
console.log(`Completed in ${result.duration}ms`);
```

---

### `TaskResult`

Result of a single agent execution within a task step.

```typescript
interface TaskResult {
  /** ID of the agent that produced this result */
  agentId: string;

  /** ID of the task step this result belongs to */
  taskId: string;

  /** The agent's text response */
  output: string;

  /** Whether this individual agent call succeeded */
  success: boolean;

  /** Unix timestamp (ms) when this result was produced */
  timestamp: number;

  /** Wall-clock time for this agent call in milliseconds */
  duration?: number;

  /** Iteration number (collaborative / loop tasks only) */
  iteration?: number;

  /** Error object if the agent call failed */
  error?: Error;

  /** Arbitrary metadata attached by middlewares or the agent */
  metadata?: Record<string, unknown>;
}
```

> **Tip:** `TaskResult.output` is the agent's textual response. Do not confuse
> it with `Message.content`, which holds a single collaborative turn message.
> Use `output` when reading task results and `content` when iterating over
> `result.messages`.

---

### `Message`

Represents a single message exchanged during a collaborative step.

```typescript
interface Message {
  /** ID of the sending agent */
  from: string;

  /** ID of the target agent, or undefined for broadcast */
  to?: string;

  /** Message content */
  content: string;

  /** Unix timestamp */
  timestamp: number;
}
```

---

### `SocietyObserver`

Interface for observing execution lifecycle events. Pass an implementation to
`.withObserver()`.

```typescript
interface SocietyObserver {
  // Required hooks
  onAgentStart(agentId: string, modelName: string, prompt: unknown): void;
  onAgentComplete(agentId: string, modelName: string, result: string): void;
  onAgentError(agentId: string, modelName: string, error: Error): void;
  onPhaseStart(phase: string): void;
  onPhaseComplete(phase: string): void;
  onSocietyStart(prompt: string, agentCount: number): void;
  onSocietyComplete(finalResult: string): void;

  // Optional hooks
  onTaskEnd?(taskId: string, result: TaskResult): void;
  onNodeStart?(nodeId: string, type: string, input: string): void;
  onNodeEnd?(nodeId: string, output: string, duration: number): void;
  onNodeError?(nodeId: string, error: Error): void;
}
```

**Example — simple console observer:**

```typescript
import { SocietyObserver, Society } from 'societyai';

const observer: SocietyObserver = {
  onAgentStart: (id, model, prompt) =>
    console.log(`[${id}] Starting with model ${model}`),
  onAgentComplete: (id, model, result) =>
    console.log(`[${id}] Done → ${result.slice(0, 80)}...`),
  onAgentError: (id, _model, err) =>
    console.error(`[${id}] Error: ${err.message}`),
  onPhaseStart: (phase) => console.log(`Phase start: ${phase}`),
  onPhaseComplete: (phase) => console.log(`Phase end: ${phase}`),
  onSocietyStart: (prompt, n) =>
    console.log(`Society started — ${n} agents — prompt: ${prompt.slice(0, 60)}`),
  onSocietyComplete: (result) =>
    console.log(`Society complete → ${result.slice(0, 80)}`),
};

await Society.create()
  .withObserver(observer)
  .addAgent(/* ... */)
  .addTask(/* ... */)
  .execute('Start');
```

---

## Full Example

```typescript
import {
  Society,
  MiddlewareChain,
  Middlewares,
  AggregationStrategies,
} from 'societyai';

const result = await Society.create()
  .withId('analysis-pipeline')
  .withName('Market Analysis Pipeline')
  .withTimeout(120_000) // 2-minute global timeout

  // Global data injected into every agent prompt via {context}
  .withGlobalContext({ market: 'EMEA', language: 'en' })

  // Middleware applied to every agent call
  .addMiddleware(
    MiddlewareChain.create()
      .use(Middlewares.logging())
      .use(Middlewares.retry({ maxAttempts: 3 }))
      .use(Middlewares.timeout(30_000))
  )

  // Agents
  .addAgent((a) =>
    a
      .withId('analyst-1')
      .withRole((r) => r.withSystemPrompt('You analyse market data.'))
      .withModel(myModel)
  )
  .addAgent((a) =>
    a
      .withId('analyst-2')
      .withRole((r) => r.withSystemPrompt('You identify market risks.'))
      .withModel(myModel)
  )
  .addAgent((a) =>
    a
      .withId('synthesiser')
      .withRole((r) =>
        r.withSystemPrompt('You synthesise findings into an executive summary.')
      )
      .withModel(myModel)
  )

  // Tasks
  .addTask((t) =>
    t
      .withId('parallel-analysis')
      .withAgents(['analyst-1', 'analyst-2'])
      .parallel()                                  // both analysts run simultaneously
      .transformResults(AggregationStrategies.concat('\n---\n'))
  )
  .addTask((t) =>
    t
      .withId('synthesise')
      .dependsOn('parallel-analysis')
      .withAgents(['synthesiser'])
      .withInstructions('Produce a concise executive summary from the analyses above.')
      .sequential()
  )

  .execute('Analyse Q2 market conditions');

console.log('Summary:', result.output);
console.log('Duration:', result.duration, 'ms');
```
