# 🏗️ SocietyAI Architecture

## Overview

SocietyAI introduces a modular, DAG-based orchestration architecture that
enables complex workflow execution with dependency management, conditional
routing, and pluggable execution strategies.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       SocietyAI                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Builders   │  │ Capabilities │  │ Observability│     │
│  │              │  │              │  │              │     │
│  │  Role        │  │  Tools       │  │  Logger      │     │
│  │  Agent       │  │  Memory      │  │  Metrics     │     │
│  │  Workflow    │  │  Validation  │  │  Events      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                    ┌───────▼────────┐                       │
│                    │  Orchestrator  │                       │
│                    │                │                       │
│                    │  • Delegates   │                       │
│                    │  • Coordinates │                       │
│                    │  • Routes      │                       │
│                    └───────┬────────┘                       │
│                            │                                │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│    ┌────▼─────┐      ┌────▼─────┐      ┌────▼─────┐       │
│    │Sequential│      │ Parallel │      │  Router  │       │
│    │ Strategy │      │ Strategy │      │          │       │
│    └──────────┘      └──────────┘      └──────────┘       │
│                                                             │
│    ┌─────────────────────────────────────────────┐         │
│    │         Scheduler (DAG)                     │         │
│    │                                             │         │
│    │  • Dependency Graph                         │         │
│    │  • Topological Sort                         │         │
│    │  • Execution Planning                       │         │
│    └─────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Builders (`src/builders/`)

Fluent API for constructing agents and workflows:

- **RoleBuilder**: Defines agent roles with system prompts and capabilities
- **AgentBuilder**: Constructs agents with roles and AI models
- **Society**: Main builder for creating complete societies/workflows with step dependencies

```typescript
const society = Society.create()
  .withId('data-pipeline')
  .addStep((step) =>
    step
      .withId('extract')
      .withName('Extract Data')
      .withAgents(['extractor'])
      .sequential()
  )
  .addStep((step) =>
    step
      .withId('transform')
      .withName('Transform Data')
      .dependsOn('extract') // DAG dependency
      .withAgents(['transformer'])
  )
  .build();
```

### 2. Orchestrator (`src/execution/orchestrator.ts`)

Central coordinator that:

- Delegates execution to appropriate strategies
- Manages workflow state and context
- Integrates conditional routing
- Determines next steps based on results

```typescript
const orchestrator = new Orchestrator({
  strategies: new Map([
    ['sequential', new SequentialStrategy()],
    ['parallel', new ParallelStrategy()],
  ]),
  router: conditionalRouter,
  logger: customLogger,
});
```

### 3. Execution Strategies (`src/execution/strategies/`)

Pluggable execution patterns implementing `ExecutionStrategy` interface:

#### Sequential Strategy

- Executes agents one after another
- Preserves order and dependencies
- Ideal for sequential workflows

#### Parallel Strategy

- Executes agents concurrently using WorkerPool
- Maximizes throughput
- Aggregates results using configured strategy

```typescript
interface ExecutionStrategy {
  execute(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    logger?: Logger
  ): Promise<StepResult>;
}
```

### 4. DAG Scheduler (`src/execution/scheduler/`)

Manages workflow dependencies:

#### DependencyGraph

- Directed Acyclic Graph (DAG) representation
- Cycle detection via DFS with recursion stack
- Identifies root nodes (no dependencies)
- Computes ready-to-execute nodes

#### Scheduler

- Topological sort for execution order
- Level-based parallel execution planning
- Execution statistics and insights

```
Example DAG:

    A (Extract)
    │
    ├─► B (Transform)
    │   │
    │   └─► D (Aggregate)
    │
    └─► C (Validate)
        │
        └─► D (Aggregate)

Execution Order: [A] → [B, C] → [D]
Levels:
  Level 0: A
  Level 1: B, C (can run in parallel)
  Level 2: D
```

### 5. Conditional Router (`src/execution/routing/`)

Enables workflow branching based on runtime conditions:

```typescript
const router = new ConditionalRouterBuilder()
  .addRoute({
    condition: RouterConditions.allSuccess(),
    nextSteps: ['success-step'],
  })
  .addRoute({
    condition: RouterConditions.anySuccess(),
    nextSteps: ['partial-success-step'],
  })
  .setDefaultRoute(['fallback-step'])
  .build();
```

**Built-in Conditions:**

- `allSuccess()` - All agents succeeded
- `anySuccess()` - At least one agent succeeded
- `contains(text)` - Output contains specific text
- `matches(pattern)` - Output matches regex pattern
- `consensus()` - Majority agreement among agents

### 6. Observability (`src/observability/`)

Comprehensive monitoring and debugging:

#### Logger

- Structured logging with levels (DEBUG, INFO, WARN, ERROR)
- Contextual metadata support
- Pluggable output destinations

#### Metrics

- Performance profiling with marks and measures
- Token usage tracking
- Request/response timing
- Custom metric recording

#### Events

- Event-driven architecture
- Lifecycle hooks (onStart, onComplete, onError)
- Custom event handling

## Data Flow

```
┌──────────────┐
│ User Request │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ WorkflowBuilder  │
│ (Define workflow)│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Scheduler      │
│ (Compute order)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Orchestrator    │
│ (Execute steps)  │
└──────┬───────────┘
       │
       ├─► Sequential Strategy
       ├─► Parallel Strategy
       └─► Router (conditional)
       │
       ▼
┌──────────────────┐
│   StepResult     │
│  (with context)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Router Evaluates │
│  Next Steps      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Final Result    │
└──────────────────┘
```

## Workflow Context

Shared state passed through workflow execution:

```typescript
interface WorkflowContext {
  input: string; // Original input
  sharedData: Record<string, any>; // Shared state
  stepResults: StepResult[]; // Step execution history
  messageHistory: Array<{
    // Conversation history
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  metadata?: Record<string, any>; // Additional metadata
}
```

## Design Patterns

### 1. Strategy Pattern

Pluggable execution strategies allow runtime selection of execution behavior
without changing orchestrator code.

### 2. Builder Pattern

Fluent API provides intuitive, type-safe workflow construction with compile-time
validation.

### 3. Observer Pattern

Event system enables decoupled monitoring and extension of workflow behavior.

### 4. Dependency Injection

Orchestrator accepts strategies, routers, and loggers via constructor, enabling
testability and flexibility.

## Key Design Decisions

### Why DAG?

- **Parallel Execution**: Independent steps run concurrently
- **Explicit Dependencies**: Clear execution order
- **Cycle Prevention**: Validates acyclic structure
- **Optimization**: Scheduler computes optimal execution plan

### Why Strategy Pattern?

- **Extensibility**: Add new execution modes without changing core
- **Testability**: Test strategies in isolation
- **Flexibility**: Runtime strategy selection
- **Maintainability**: Separate concerns, smaller files

### Why Conditional Router?

- **Dynamic Workflows**: Adapt based on runtime results
- **Error Handling**: Route to fallback steps on failure
- **Decision Logic**: Centralized branching logic
- **Reusability**: Share routing logic across workflows

## Performance Considerations

1. **Parallel Execution**: WorkerPool manages concurrency limits
2. **Memory Management**: Context pruning for long workflows
3. **Lazy Evaluation**: Steps only execute when dependencies satisfied
4. **Caching**: Reuse agent results where applicable
5. **Metrics**: Track bottlenecks via profiling

## Testing Architecture

```
Unit Tests (*.test.ts)
├── Builders
├── Execution Strategies
├── Scheduler
├── Router
└── Observability

Integration Tests (__integration__/)
└── complete-flow.test.ts
    ├── DAG execution
    ├── Conditional routing
    └── Strategy delegation
```

## Future Roadmap

- **Distributed Execution**: Multi-node workflow execution
- **Checkpoint/Resume**: Save and restore workflow state
- **Streaming**: Real-time step result streaming
- **Visual Workflow Editor**: GUI for workflow construction
- **Advanced Analytics**: Workflow performance optimization suggestions

---

**Version:** 0.0.2  
**Last Updated:** 2024
