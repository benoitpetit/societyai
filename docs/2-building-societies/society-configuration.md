# Society Configuration (High-Level API)

The `Society` class provides a "Fluent API" to build complex multi-agent systems without worrying about the underlying graph theory. It is the recommended way to start.

For low-level control, see the [GraphBuilder](../5-architecture/execution-engine.md).

## `Society`

Main entry point for creating multi-agent workflows.

```typescript
const society = Society.create()
  .withName('My Society')
  .addAgent(agent => agent
    .withId('analyst')
    .withRole(analystRole)
    .withModel(myModel)
  )
  .chain()  // Creates a sequential workflow
  .execute(input);
```

### Methods

- **`create(id?: string)`**: Creates a new society builder.
- **`withId(id: string)`**: Sets the society ID.
- **`withName(name: string)`**: Sets the society name.
- **`withDescription(desc: string)`**: Sets the description.
- **`addAgent(builderFn)`**: Adds an agent using a builder function.
- **`useAgent(agent)`**: Adds an agent directly.
- **`addTask(builderFn)`**: Adds a workflow task using a builder function.
- **`useTask(task)`**: Adds a task directly.
- **`usePipeline(builderFn)`**: Configures a pipeline pattern.
- **`scatterGather(aggregator?)`**: Quickly creates a scatter-gather workflow.
- **`chain()`**: Quickly creates a sequential chain workflow.
- **`collaborate(maxIterations?)`**: Quickly creates a collaborative workflow.
- **`withEntryTask(taskId)`**: Sets the entry task for execution.
- **`withGlobalContext(context)`**: Sets global context available to all agents.
- **`withObserver(observer)`**: Sets an observer for monitoring execution.
- **`addMiddleware(middleware)`**: Adds a middleware to the execution chain.
- **`withTimeout(ms)`**: Sets a global timeout for execution.
- **`execute(input: string, signal?: AbortSignal)`**: Executes the workflow.

## Types

### `SocietyResult`

Result of a workflow execution.

```typescript
interface SocietyResult {
  success: boolean;
  output: string;  // Final aggregated output
  taskResults: Map<string, TaskResult[]>;  // Results by task ID
  duration: number;  // Total execution time in ms
  errors?: Error[];
  messages: Message[];  // Message history from collaborative steps
}
```

### `TaskResult`

Result of a single agent execution within a step.

> ✅ **v0.0.3 Update**: `TaskResult` now uses only `output` property.

> 💡 **Note**: Don't confuse `TaskResult.output` (agent's response) with `Message.content` (collaborative message content). Use `output` when accessing task results, and `content` when reading collaborative messages.

```typescript
interface TaskResult {
  agentId: string;        // ID of the agent that produced this result
  taskId: string;         // ID of the step this result belongs to
  output: string;         // ✅ The agent's response
  metadata?: Record<string, unknown>;
  timestamp: number;
  success: boolean;
  duration?: number;      // Execution time for this agent
  error?: Error;
  iteration?: number;     // For collaborative steps
}
```
