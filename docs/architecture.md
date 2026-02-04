# SocietyAI Architecture

SocietyAI is a **model-agnostic** multi-agent orchestration framework with zero runtime dependencies. Its architecture is built upon a powerful and flexible **graph-based execution engine**.

## 🏗️ Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Fluent API                          │
│        (Society, Builders, Patterns)                    │
├─────────────────────────────────────────────────────────┤
│              Middleware System                          │
│        (Pre/Post processing, Logging)                   │
├─────────────────────────────────────────────────────────┤
│          ExecutionEngine (Graph)                        │
│       ┌─────────┬─────────┬──────────┬─────────┐        │
│       │  Agent  │Parallel │Condition │ Collab  │        │
│       │  Nodes  │  Nodes  │  Nodes   │ Nodes   │        │
│       └─────────┴─────────┴──────────┴─────────┘        │
├─────────────────────────────────────────────────────────┤
│      Memory System  │  Tool Registry  │  Validation     │
├─────────────────────────────────────────────────────────┤
│              Model Abstraction (AIModel)                │
├─────────────────────────────────────────────────────────┤
│           Your AI Models (OpenAI, Claude, etc.)         │
└─────────────────────────────────────────────────────────┘
```

## 🎯 The Graph Execution Engine (ExecutionEngine)

At the heart of SocietyAI lies an execution engine based on graphs. When a workflow is executed, it is converted into a directed graph (DAG or cyclic) where:
- **Nodes** represent operations (agents, decisions, loops).
- **Edges** define the flow of data and control.

### 📊 Understanding the Two API Levels

SocietyAI provides **two distinct levels of abstraction** for building multi-agent workflows:

#### 🔵 **High-Level API** (Recommended)
- **Entry Point**: `Society.create()`
- **Building Blocks**: `Task` with `TaskExecutionType`
- **Execution Types**: `sequential`, `parallel`, `collaborative`, `conditional`
- **Features**: Fluent builder functions, direct execution, built-in patterns, middleware support
- **Best For**: Standard workflows, quick prototyping, most use cases
- **Learning Curve**: 🟢 Low

#### 🔴 **Low-Level API** (Advanced Users)
- **Entry Point**: `GraphBuilder.create()`
- **Building Blocks**: `GraphNode` with `NodeType` (8 types available)
- **Node Types**: `START`, `END`, `AGENT`, `PARALLEL`, `AGGREGATE`, `CONDITION`, `TRANSFORM`, `LOOP`, `COLLABORATIVE`
- **Best For**: Complex patterns (cycles, transforms, custom aggregations)
- **Learning Curve**: 🟡 Medium-High

> **💡 Decision Guide**: Start with the High-Level API. Only use the Low-Level API when you need features like:
> - Self-correction loops (cycles)
> - Custom data transformations between steps
> - Advanced aggregation strategies
> - Fine-grained control over message routing

### Workflow → Graph Mapping

When you use the High-Level API, `SocietyExecutor` automatically converts your workflow configuration into a graph:

| TaskExecutionType | Resulting Graph Structure | Description |
|---------------------------|--------------------------|-------------|
| `sequential` | `START` → `AGENT` → `AGENT` → ... → `END` | Agents execute one after another, each receives previous output |
| `parallel` | `START` → `PARALLEL(agents)` → `END` | All agents execute simultaneously, results aggregated |
| `collaborative` | `START` → `COLLABORATIVE(agents, loops)` → `END` | Agents exchange messages across multiple iterations |
| `conditional` | `START` → `CONDITION` → `[AGENT_A | AGENT_B]` → `END` | Dynamic routing based on previous results |

**Example Conversion**:
```typescript
// High-Level Workflow
Society.create()
  .addAgent(agent1)
  .addAgent(agent2)
  .addTask(s => s
    .withId('analyze')
    .withAgents(['agent1', 'agent2'])
    .parallel()  // TaskExecutionType
  )

// Is converted internally to:
GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('analyze', NodeType.PARALLEL, {
    agentIds: ['agent1', 'agent2']
  })
  .addNode('end', NodeType.END)
  .addEdge('start', 'analyze')
  .addEdge('analyze', 'end')
```

**Important Notes**: 
- ⚠️ The high-level API is automatically converted to a graph by the `SocietyExecutor`
- ⚠️ For advanced scenarios (cycles, transforms, aggregations), use `GraphBuilder` directly
- ⚠️ You cannot mix high-level and low-level APIs in the same workflow (choose one approach)

### Advanced Routing Conversion

The `SocietyExecutor` handles complex routing scenarios when converting workflows to graphs:

#### Static Routing (nextTasks)
When you use `.thenGoto()` or `.withNextSteps()`, explicit edges are created:

```typescript
// Workflow with explicit routing
Society.create()
  .addTask(t => t.withId('analyze').thenGoto(['review', 'validate']))
  .addTask(t => t.withId('review')...)
  .addTask(t => t.withId('validate')...)

// Converted to graph edges:
// analyze → review
// analyze → validate
```

#### Dynamic Routing (nextTaskResolver)
When you use `.thenResolve()`, the executor creates an intermediate CONDITION node:

```typescript
// Workflow with dynamic routing
Society.create()
  .addTask(t => t
    .withId('classify')
    .thenResolve((results) => {
      if (results[0].output.includes('urgent')) return 'priority';
      return 'normal';
    })
  )

// Converted to graph:
// classify → classify_resolver (CONDITION) → [priority | normal]
//
// The resolver evaluates nextTaskResolver and routes accordingly
```

#### Conditional Branching
When you use `.withBranch()` or `.withConditionalNext()`, conditional edges are created:

```typescript
// Workflow with branching
Society.create()
  .addTask(t => t
    .withId('check')
    .withBranch(
      (results) => results.get('score')?.[0].output > '50',
      ['success'],
      ['retry']
    )
  )

// Converted to graph:
// check → check_resolver (CONDITION) → [success | retry]
//
// The condition is evaluated at runtime using previous task results
```

#### Implicit Sequential Routing
In permissive mode (default), tasks without explicit routing are automatically chained:

```typescript
// Workflow without explicit routing
Society.create()
  .withStrictRouting(false)  // Default
  .addTask(t => t.withId('step1'))
  .addTask(t => t.withId('step2'))
  .addTask(t => t.withId('step3'))

// Converted to graph:
// step1 → step2 → step3 → end
```

**Strict Routing Mode**: When enabled, all intermediate tasks MUST define explicit routing:

```typescript
Society.create()
  .withStrictRouting(true)
  .addTask(t => t.withId('step1').thenGoto(['step2']))  // ✅ Required
  .addTask(t => t.withId('step2'))  // ❌ Error: no explicit routing
```

### Supported Node Types

The execution engine supports 8 node types for building complex workflows:

#### 1. **START / END**
Entry and exit points of the graph. Always required.

**Workflow Mapping**: Automatically added during conversion.

#### 2. **AGENT** (Agent Execution)
Executes a single agent with native support for the **ReAct loop** (Reason + Act).

**Workflow Mapping**: `sequential` → Sequence of `AGENT` nodes.

**Execution Flow**:
1. **Prompt Construction**: Injection of context, history, available tools.
2. **ReAct Loop**:
   - The model generates a response or a tool call (`<tool_code>`).
   - If a tool is called, the engine executes it and returns the result.
   - The cycle repeats until a final response is obtained or limits are reached.
3. **Validation**: If an output schema is defined, the response is validated via JSON Schema.
4. **Memory Storage**: The interaction is saved to long-term memory.

#### 3. **PARALLEL** (Parallel Execution)
Executes multiple agents simultaneously using a worker pool.

**Workflow Mapping**: `parallel` → A `PARALLEL` node with a list of agents.

**Usage**:
```typescript
.addNode('parallel-analysis', NodeType.PARALLEL, {
  agentIds: ['analyst-1', 'analyst-2', 'analyst-3']
})
```

#### 4. **CONDITION** (Conditional Branching)
Allows creating conditional flows based on previous results.

**Workflow Mapping**: `conditional` → `CONDITION` node + branches.

**Example**:
```typescript
graphBuilder.addConditionalEdge('validator', {
  condition: (result) => result.includes('valid'),
  truePath: 'output',
  falsePath: 'retry'
});
```

#### 5. **COLLABORATIVE** (Collaboration Loop)
Mode where multiple agents exchange messages in a loop until a condition is met.

**Workflow Mapping**: `collaborative` → A `COLLABORATIVE` node.

**Message Routing System**:

Collaborative mode supports **advanced message routing**:

1. **Broadcast (default)**: All agents receive all messages.
2. **Explicit Targeting**: Agents can address specific agents using `@agentId: message`.
3. **Custom Router**: Define your own routing logic.

**Basic Example**:
```typescript
.addNode('team-discussion', NodeType.COLLABORATIVE, {
  agentIds: ['analyst', 'reviewer', 'expert'],
  maxIterations: 5,
  completionCondition: (results, iteration) => {
    return results.some(r => r.output.includes('CONSENSUS'));
  }
})
```

**Example with Custom Router**:
```typescript
.addNode('hierarchical-review', NodeType.COLLABORATIVE, {
  agentIds: ['junior', 'senior', 'manager'],
  maxIterations: 10,
  messageRouter: (message, sender, allAgents, context) => {
    // Hierarchy: junior → senior → manager
    if (sender.id === 'junior') return ['senior'];
    if (sender.id === 'senior') return ['manager'];
    if (sender.id === 'manager') return ['junior', 'senior']; // Feedback to all
    return [];
  }
})
```

**Format of Targeted Messages**:
```
@senior: Can you validate this analysis?
```

The system will automatically extract the recipient and filter the message history for each agent.

#### 6. **LOOP** (Iterative Loop)
Repeats the execution of a subgraph with a termination condition.

**Workflow Mapping**: Not available in Workflow API - only via `GraphBuilder`.

**Note**: For complex loops, use `GraphBuilder` directly.

#### 7. **AGGREGATE** (Aggregation)
Merges results from multiple parallel nodes.

**Workflow Mapping**: Not available in Workflow API - only via `GraphBuilder`.

#### 8. **TRANSFORM** (Transformation)
Applies a data transformation between nodes.

**Workflow Mapping**: Not available in Workflow API - only via `GraphBuilder`.

### Cyclic Graphs

The engine supports cyclic graphs for scenarios like:
- Iterative Validation: Agent → Validator → (back to Agent if invalid).
- Progressive Refinement: Generation → Critique → Improvement → (loop).
- Adaptive Learning: Execution → Analysis → Adjustment → (repeat).

## 🧠 Memory System

SocietyAI integrates a complete memory system:

### Short-Term Memory
Stores recent interactions for immediate context.

### Long-Term Memory
Uses a vector system for semantic search in history.

```typescript
const memory = MemoryBuilder.create()
  .withShortTerm({ maxSize: 100 })
  .withLongTerm({
    vectorProvider: myVectorDB,
    maxResults: 5
  })
  .build();
```

### Entity Memory
Tracks information about specific entities over time.

## 🛠️ Tool System

Agents can use external tools via a **ToolRegistry**.

### Defining a Tool

```typescript
const calculator = {
  name: 'calculate',
  description: 'Perform mathematical calculations',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string' }
    },
    required: ['expression']
  },
  execute: async (params) => {
    return eval(params.expression).toString();
  }
};
```

### Automatic ReAct Loop

When an agent has access to tools, the engine:
1. Automatically injects tool definitions into the prompt.
2. Detects `<tool_code>` tags in the response.
3. Executes the requested tool.
4. Returns the result to the model.
5. Repeats until a final response is obtained.

## ⚙️ Middleware System

Middleware allows intercepting and modifying calls to agents.

### Middleware Types

#### Model-Level Middleware
Intercepts calls at the model level:

```typescript
const loggingMiddleware: Middleware = async (prompt, next, context) => {
  console.log('Calling model with:', prompt);
  const result = await next(prompt);
  console.log('Model responded:', result);
  return result;
};
```

#### Step-Level Middleware
Intercepts at the workflow step level:

```typescript
const stepMiddleware: StepMiddleware = async (step, next, context) => {
  console.log(`Executing step: ${step.id}`);
  const result = await next(step);
  // Post-processing
  return result;
};
```

### Built-in Middlewares

- **Rate Limiting**: Limits the number of calls.
- **Caching**: Caches identical results.
- **Retry**: Automatically retries on failure.
- **Logging**: Logs all interactions.
- **Content Filtering**: Filters inappropriate content.
- **Token Counting**: Counts used tokens.

## ✅ Output Validation

Use JSON Schema to ensure agents return valid structured data.

```typescript
const outputSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['success', 'failure'] },
    data: { type: 'object' }
  },
  required: ['status']
};

agent.withOutputSchema(outputSchema);
```

## 📊 Event System and Observability

### Event Emitter

```typescript
const eventEmitter = SocietyEventEmitter.create();

eventEmitter.on('agent:complete', (event) => {
  console.log(`Agent ${event.agentId} completed in ${event.duration}ms`);
});
```

### Progress Tracker

```typescript
const tracker = createProgressTracker();

tracker.on('progress', (event) => {
  console.log(`Progress: ${event.completed}/${event.total}`);
});
```

### Event Types

- **Society**: `society:start`, `society:complete`, `society:error`
- **Task**: `task:start`, `task:complete`, `task:error`, `task:skipped`
- **Agent**: `agent:start`, `agent:complete`, `agent:error`, `agent:retry`
- **Messages**: `message:sent`, `message:received`
- **Progress**: `progress:update`

## 🎨 Prompt Templates

Agent roles support customizable prompt templates with the following placeholders:

- `{system}`: Role system instructions.
- `{input}`: The input being processed.
- `{context}`: Data shared between nodes (JSON).
- `{history}`: Execution history of previous nodes.
- `{sharedData}`: Alias for {context}.
- `{memory}`: Agent memory context.
- `{tools}`: Tools available to the agent.
- `{instructions}`: Step-specific instructions.
- `{messages}`: Message history (collaborative nodes).

## 🔄 Recursion: Societies of Societies

Via `EngineAsModel`, you can encapsulate a complete execution graph as if it were a simple AI model, allowing you to create orchestration hierarchies.

```typescript
const innerGraph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent1', NodeType.AGENT, { agentId: 'inner-agent' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent1')
  .addEdge('agent1', 'end')
  .build();

const innerModel = new EngineAsModel(innerGraph, [innerAgent]);

const outerSociety = Society.create()
  .addAgent(a => a
    .withId('meta-agent')
    .withModel(innerModel) // An entire graph as a model!
    .withRole(r => r.withSystemPrompt('You orchestrate the inner agents'))
  )
  .addTask(s => s.withId('meta').withAgents(['meta-agent']).sequential())
  .execute(input);
```

## 🎯 Predefined Pipeline Patterns

SocietyAI offers ready-to-use composition patterns:

- **Sequential**: Linear execution of agents.
- **Parallel**: Simultaneous execution.
- **Scatter-Gather**: Distribution then aggregation.
- **Router**: Conditional routing to different agents.
- **Fallback**: Tries multiple agents until success.
- **Race**: Takes the first available result.
- **Chain**: Chaining with transformation between steps.

## 📝 Key Concepts Summary

| Concept | Description |
|---------|-------------|
| **ExecutionEngine** | Graph engine at the heart of orchestration. |
| **NodeType** | Node types: AGENT, PARALLEL, CONDITION, COLLABORATIVE, LOOP, etc. |
| **TaskResult** | Unified execution result format. |
| **Middleware** | Interception and transformation of calls. |
| **MemorySystem** | Short/long-term memory management. |
| **ToolRegistry** | Registration and execution of tools. |
| **Validation** | Output validation via JSON Schema. |
| **Events** | Event system for observability. |
| **Recursive Orchestration** | Multi-level society composition. |

---

**Note**: SocietyAI is designed to be **model-agnostic**. You can use any AI model by implementing the `AIModel` interface.
