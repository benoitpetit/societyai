# API Reference

This is the central index for the SocietyAI API documentation. All items listed
here are public exports from `societyai`.

## 📦 Core Modules

- **[Society & Workflows](../2-building-societies/society-builder.md)**
  - `Society` — Main entry point (`Society.create()`)
  - `SocietyPatterns` — Pre-built workflow patterns (`chain`, `parallel`,
    `collaborative`, `review`)
  - `AggregationStrategies` — Result aggregation (`concat`, `first`, `last`,
    `best`, `reduce`, `structured`)
  - `FluentTaskBuilder` (`TaskBuilder`) — Task configuration with execution
    types
  - `SocietyResult`, `TaskResult`, `Message` — Result types
- **[Context Management](../2-building-societies/context.md)**
  - `createContextToken<T>()` — Create typed context tokens
  - `ContextProvider`, `ContextProviderBuilder` — Provide values to the context
  - `ContextScope` — Scoping levels (`GLOBAL`, `WORKFLOW`, `STEP`, `AGENT`)
  - `ContextStore`, `ContextMap` — Low-level context storage
  - `selectContext`, `fromObject`, `toObject`, `mergeContexts` — Context utility
    functions
  - `AgentContextInjector` — Inject context into agent prompts
  - `ContextAwarePromptBuilder` — Build prompts with context awareness

- **[Middleware](../4-advanced/middleware.md)**
  - `Middlewares` — 13 built-in middlewares (`logging`, `timing`, `retry`,
    `cache`, `rateLimit`, `timeout`, `transformInput`, `transformOutput`,
    `validation`, `fallback`, `metrics`, `circuitBreaker`, `dedupe`)
  - `StepMiddlewares` — 4 step-level middlewares (`logging`, `timing`,
    `filterResults`, `enrichResults`)
  - `MiddlewareChain` — Composable middleware chain with priority ordering
  - `ComposedMiddleware` — Pre-composed middleware
  - `MiddlewareWrappedModel` — Wrap a model with middleware
  - `InMemoryMetricsCollector` — In-memory metrics collection for
    `Middlewares.metrics()`

- **[Patterns](../5-architecture/patterns.md)**
  - `SocietyPatterns` — `chain()`, `parallel()`, `collaborative()`, `review()`
  - `AggregationStrategies` — `concat()`, `first()`, `last()`, `best()`,
    `reduce()`, `structured()`

## 🤖 Agents & Builders

- **[Agent Construction](../2-building-societies/agents-roles.md)**
  - `FluentAgentBuilder` (`AgentBuilder`) — Configure agents
  - `FluentRoleBuilder` (`RoleBuilder`) — Configure roles
  - `createAgent()`, `createRole()` — Quick helper functions

- **[Agent Interfaces](../5-architecture/agent-interfaces.md)**
  - `AIModel` — Interface for LLM integration (`process()`, `name()`,
    `supportsPromptType()`)
  - `Role` — Agent role definition
  - `Agent` — Full agent configuration

## 🛠️ Capabilities

- **[Tools & Function Calling](../3-capabilities/tools-functions.md)**
  - `ToolRegistry` — Register and manage tools
  - `ToolExecutor` — Execute tool calls
  - `ToolBuilder` — Fluent tool definition
  - `BuiltInTools` — Pre-built utility tools
  - `Tool`, `ToolCall`, `ToolResult`, `ToolContext`, `ToolParameterSchema` —
    Types

- **[Memory System](../3-capabilities/memory.md)**
  - `MemorySystem`, `MemoryBuilder` — Memory configuration
  - `ShortTermMemory` — Working memory (recent interactions)
  - `LongTermMemory` — Semantic/vector memory
  - `EntityMemory` — Entity-based memory
  - `MemoryEntry`, `MemoryQuery`, `MemoryRetrievalResult`, `VectorProvider`,
    `Entity` — Types

- **[Validation](../3-capabilities/validation.md)**
  - `StructuredOutputValidator` — JSON Schema validation
  - `StructuredOutputBuilder` — Fluent schema builder
  - `validateJSON`, `createSchema` — Helper functions
  - `JSONSchema`, `ValidationError`, `ValidationResult` — Types

- **[Self-Correcting Validation](../6-advanced-features/advanced-features.md)**
  - `SelfCorrectingValidator` — Auto-correcting validation with LLM feedback
  - `createSelfCorrectingValidator()` — Factory function
  - Strategies: `'guided'`, `'aggressive'`, `'minimal'`

- **[Vector Store](../6-advanced-features/advanced-features.md)**
  - `InMemoryVectorStore` — In-memory vector store for prototyping
  - `VectorStoreAdapter` — Bridge between `InMemoryVectorStore` and
    `VectorProvider`
  - `EmbeddingFunction` — Type for embedding functions
  - `VectorEntry`, `VectorStoreConfig`, `SearchOptions`, `SearchResult`,
    `DistanceMetric` — Types

- **[Persistence](../3-capabilities/persistence.md)**
  - `StorageAdapter` — Abstract storage interface
  - `FileStorageAdapter` — File-based storage (zero dependencies)
  - `WorkflowState` — Serializable execution state

- **[Storage Adapters](../6-advanced-features/advanced-features.md)** (require
  peer dependencies)
  - `RedisStorageAdapter` — Redis storage (`ioredis`)
  - `PostgresStorageAdapter` — PostgreSQL storage (`pg`)

## ⚡ Execution Engine

- **[Execution Engine](../5-architecture/execution-engine.md)**
  - `ExecutionEngine` (`SocietyGraph`) — Core graph execution engine
  - `GraphBuilder` — Low-level graph construction API
  - `NodeType` — 10 node types (`START`, `END`, `AGENT`, `HUMAN`, `PARALLEL`,
    `AGGREGATE`, `CONDITION`, `TRANSFORM`, `LOOP`, `COLLABORATIVE`)
  - `GraphNode`, `GraphEdge`, `ConditionalEdge`, `GraphContext`, `GraphResult` —
    Types

- **[Hierarchical Societies](../6-advanced-features/advanced-features.md)**
  - `EngineAsModel` — Wrap an execution engine as an `AIModel`
  - `wrapEngineAsModel()` — Helper factory function

- **[Graph Transformation](../5-architecture/graph-transformation.md)**
  - Three transformation mechanisms: Middlewares, Transform Nodes, Step Result
    Transformers

## 👁️ Observability

- **[Observability](../4-advanced/observability.md)**
  - `SocietyEventEmitter` — Core event emitter
  - `FilteredEventEmitter` — Event emitter with built-in filtering
  - `ProgressTracker` — Track execution progress
  - `EventLogger` — Log events to console or custom targets
  - `EventAggregator` — Aggregate events into summaries
  - `createEventEmitter()`, `createProgressTracker()`, `createEventLogger()` —
    Factory functions
  - Event types: `WorkflowStartEvent`, `WorkflowCompleteEvent`,
    `StepStartEvent`, `StepCompleteEvent`, `AgentStartEvent`,
    `AgentCompleteEvent`, `ProgressEvent`, `DebugEvent`, `CustomEvent`, etc.

## 🔧 Utilities

- **Logger** — Built-in logging system
  - `Logger` — Configurable logger
  - `LogLevel` — Log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`)

- **Retry** — Retry mechanism with exponential backoff
  - Configurable via `RetryOptions` (`maxRetries`, `initialBackoff`,
    `maxBackoff`, `backoffFactor`, `jitter`)

- **Worker Pool** — Parallel execution utilities
  - `WorkerPool` — Task-based worker pool
  - `CpuWorkerPool` — CPU-bound worker pool

- **Graph Visualizer**
  - `GraphVisualizer` — Visualize execution graphs

## 🚨 Error Classes

- `SocietyError` — Base error class
- `ModelNotSupportedError` — Model does not support requested operation
- `ProcessingFailedError` — Agent processing failed (with context)
- `InvalidAgentCountError` — Invalid number of agents
- `NoModelsSpecifiedError` — No models specified for society
- `SynthesisModelRequiredError` — Synthesis model required
- `OperationCancelledError` — Operation was cancelled
- `TimeoutError` — Operation timed out (with context)
- `InvalidConfigurationError` — Invalid configuration (with suggestions)
- `InvalidWorkflowRoutingError` — Invalid workflow routing
- `isAbortError(error)` — Check if error is an abort/cancellation error
- `wrapError(error, code?, context?)` — Wrap unknown error as `SocietyError`

## 🔧 Configuration Types

- `RetryOptions` — Retry configuration (`maxRetries`, `initialBackoff`,
  `maxBackoff`, `backoffFactor`, `jitter`)
- `ChatMessage` — Chat message format
- `StructuredPrompt` — Structured prompt format
- `StandardModelOptions` — Standard model options
- `TaskExecutionType` —
  `'sequential' | 'parallel' | 'collaborative' | 'conditional' | 'human'`
