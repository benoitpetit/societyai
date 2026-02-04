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
- **`thenGoto(...taskIds: string[])`**: Specifies the next tasks to execute after this one.
- **`withNextSteps(taskIds: string[])`**: Alias for `thenGoto` for backward compatibility.
- **`withBranch(condition, trueTasks, falseTasks)`**: Creates conditional routing based on previous results.
- **`withConditionalNext(condition, nextTaskId, fallbackTaskId?)`**: Simpler conditional routing to one task.
- **`thenResolve(resolver)`**: Dynamically determines next task based on results.

#### Conditional Routing Examples

**Simple Conditional (withConditionalNext)**
```typescript
Society.create()
  .addTask(t => t
    .withId('validate')
    .withAgents(['validator'])
    .sequential()
    .withConditionalNext(
      (results) => {
        const output = results.get('analyze')?.[0].output || '';
        return output.includes('APPROVED');
      },
      'deploy',      // Go here if condition is true
      'fix-issues'   // Go here if condition is false
    )
  )
```

**Multi-Path Branching (withBranch)**
```typescript
Society.create()
  .addTask(t => t
    .withId('check-quality')
    .withAgents(['quality-checker'])
    .sequential()
    .withBranch(
      (results) => {
        const score = parseInt(results.get('analyze')?.[0].output || '0');
        return score >= 80;  // Quality threshold
      },
      ['approve', 'publish'],     // Multiple tasks if true
      ['reject', 'notify-team']   // Multiple tasks if false
    )
  )
```

**Dynamic Routing (thenResolve)**
```typescript
Society.create()
  .addTask(t => t
    .withId('classify')
    .withAgents(['classifier'])
    .sequential()
    .thenResolve((results) => {
      const category = results[results.length - 1]?.output;
      
      // Route to different experts based on category
      if (category?.includes('technical')) return 'tech-expert';
      if (category?.includes('business')) return 'biz-expert';
      if (category?.includes('legal')) return 'legal-expert';
      
      return 'general-expert';  // Default route
    })
  )
  .addTask(t => t.withId('tech-expert')...)
  .addTask(t => t.withId('biz-expert')...)
  .addTask(t => t.withId('legal-expert')...)
  .addTask(t => t.withId('general-expert')...)
```

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
