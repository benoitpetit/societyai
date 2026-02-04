# Society Builder

## `Society`

**Primary fluent builder for creating AI agent societies.**

The `Society` class provides a complete fluent API for building and executing multi-agent workflows.

```typescript
const result = await Society.create()
  .withId('complex-workflow')
  .withName('Complex Analysis')
  .addAgent(a => a.withId('agent1').withModel(model1).withRole(role1))
  .addAgent(a => a.withId('agent2').withModel(model2).withRole(role2))
  .addTask(t => t.withId('step1').withAgents(['agent1']).sequential())
  .addTask(t => t.withId('step2').withAgents(['agent2']).sequential())
  .execute(input);
```

### Methods

#### Configuration Methods
- **`create(id?: string)`**: Creates a new Society builder with optional ID.
- **`withId(id: string)`**: Sets the society ID.
- **`withName(name: string)`**: Sets the society name.
- **`withDescription(desc: string)`**: Sets the description.
- **`withGlobalContext(context: Record<string, unknown>)`**: Sets the global context available to all agents.
- **`withTimeout(ms: number)`**: Sets a global timeout for execution.
- **`withObserver(observer: SocietyObserver)`**: Sets an observer for monitoring execution.

#### Agent Management
- **`addAgent(builderFn: (builder: FluentAgentBuilder) => FluentAgentBuilder)`**: Adds an agent using a builder function.
- **`useAgent(agent: Agent)`**: Adds a pre-configured agent directly.

#### Task Management
- **`addTask(builderFn: (builder: FluentTaskBuilder) => FluentTaskBuilder)`**: Adds a workflow task using a builder function.
- **`useTask(task: Task)`**: Adds a pre-configured task directly.
- **`withEntryTask(taskId: string)`**: Sets the entry task for execution.

#### Middleware
- **`addMiddleware(middleware: Middleware)`**: Adds a middleware to the execution chain.

#### Quick Patterns
- **`chain()`**: Quickly creates a sequential chain workflow.
- **`scatterGather(aggregator?: AggregationFunction)`**: Quickly creates a scatter-gather workflow.
- **`collaborate(maxIterations?: number)`**: Quickly creates a collaborative workflow.
- **`usePipeline(builderFn: (builder: FluentPipelineBuilder) => FluentPipelineBuilder)`**: Configures a pipeline pattern.

#### Execution
- **`execute(input: string, signal?: AbortSignal)`**: Executes the workflow and returns a SocietyResult.

---

## `FluentTaskBuilder`

Builder for creating workflow tasks.

### Methods

#### Basic Configuration
- **`withId(id: string)`**: Sets the task ID.
- **`withName(name: string)`**: Sets the task name.
- **`withAgents(agentIds: string[])`**: Sets the agent IDs that will execute this task.
- **`withInstructions(instructions: string)`**: Sets specific instructions for this task.
- **`withContext(context: Record<string, unknown>)`**: Sets task-specific context.
- **`withTimeout(ms: number)`**: Sets a timeout for this task.

#### Execution Types
- **`sequential()`**: Agents execute one after another.
- **`parallel()`**: Agents execute simultaneously.
- **`collaborative(maxIterations?: number, aggregator?: AggregationFunction)`**: Agents collaborate through multiple rounds.

#### Task Dependencies and Routing
- **`dependsOn(...taskIds: string[])`**: Specifies which tasks must complete before this task starts.
- **`thenGoto(...stepIds: string[])`**: Specifies the next tasks to execute after this one.
- **`withNextSteps(stepIds: string[])`**: Alias for `thenGoto`.
- **`withBranch(condition, trueSteps, falseSteps)`**: Creates conditional routing based on previous results.
- **`withConditionalNext(condition, nextStepId, fallbackStepId?)`**: Simpler conditional routing to one step.
- **`thenResolve(resolver)`**: Dynamically determines next step based on results.

#### Result Transformation
- **`withResultTransformer(transformer)`**: Transforms task results before passing to next tasks.

#### Build
- **`build()`**: Builds and validates the task configuration.

### Example

```typescript
Society.create()
  .addTask(t => t
    .withId('analyze')
    .withName('Analysis Phase')
    .withAgents(['analyst'])
    .withInstructions('Analyze the input data thoroughly')
    .sequential()
    .thenGoto('review')
  )
  .addTask(t => t
    .withId('review')
    .withName('Review Phase')
    .dependsOn('analyze')
    .withAgents(['reviewer'])
    .withConditionalNext(
      (results) => results.get('analyze')?.[0].output.includes('approved'),
      'finalize',
      'retry'
    )
    .sequential()
  )
```
