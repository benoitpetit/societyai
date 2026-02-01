# SocietyAI Documentation

Complete documentation for the SocietyAI library - a powerful TypeScript framework for building collaborative multi-agent AI systems.

## 📚 Documentation Guide

### For Beginners

Start here if you're new to SocietyAI:

1. **[Getting Started](./getting-started.md)** - Installation, setup, and your first workflow
2. **[Architecture Overview](./architecture.md)** - Core concepts and design principles
3. **[Examples Index](./examples.md)** - Browse all code examples

### Core Features

Build your own multi-agent systems:

4. **[Workflows](./workflows.md)** - Sequential, parallel, collaborative, and conditional patterns
5. **[Graph Execution](./graph-execution.md)** - DAG/Cyclic workflows with complex logic and loops
6. **[Pipeline Patterns](./pipeline-patterns.md)** - Chain, scatter-gather, router, splitter, saga patterns
7. **[Aggregation Strategies](./aggregation-strategies.md)** - Consensus, voting, weighted, best-of, custom strategies

### Data & State Management

Manage data flow and state:

8. **[Tool Calling](./tool-calling.md)** - External tools and APIs integration
9. **[Memory System](./memory-system.md)** - Multi-level context management
10. **[Context System](./context-system.md)** - Type-safe state sharing with tokens and providers
11. **[Structured Output](./structured-output.md)** - JSON Schema validation with automatic retry

### Observability & Performance

Monitor and optimize:

12. **[Event System](./event-system.md)** - Lifecycle events, progress tracking, debugging
13. **[Metrics & Observability](./metrics-observability.md)** - Token counting, cost estimation, profiling
14. **[Middleware System](./middleware-system.md)** - Logging, caching, retry, circuit breaker, rate limiting

### Reference & Advanced

Complete documentation:

15. **[API Reference](./api-reference.md)** - Complete API documentation
16. **[Advanced Features](./advanced.md)** - Error handling, timeout, cancellation, performance
17. **[Migration Guide](./migration.md)** - Upgrading from legacy API

## 🚀 Quick Links

| Topic                  | Document                                                   | Description                                  |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| **Installation**       | [Getting Started](./getting-started.md#installation)       | How to install SocietyAI                     |
| **First Workflow**     | [Getting Started](./getting-started.md#your-first-society) | Create your first multi-agent system         |
| **Core Concepts**      | [Architecture](./architecture.md#core-components)          | Understanding roles, agents, workflows       |
| **Execution Types**    | [Workflows](./workflows.md#execution-types)                | Sequential, parallel, collaborative patterns |
| **Graph Workflows**    | [Graph Execution](./graph-execution.md)                    | Complex DAG/Cyclic workflows                 |
| **Pipeline Patterns**  | [Pipeline Patterns](./pipeline-patterns.md)                | Pre-built execution patterns                 |
| **Aggregation**        | [Aggregation Strategies](./aggregation-strategies.md)      | Combining multiple agent results             |
| **Tool Integration**   | [Tool Calling](./tool-calling.md)                          | External tools and APIs                      |
| **Context Management** | [Memory System](./memory-system.md)                        | Multi-level memory for agents                |
| **State Sharing**      | [Context System](./context-system.md)                      | Type-safe dependency injection               |
| **Output Validation**  | [Structured Output](./structured-output.md)                | JSON Schema validation                       |
| **Event Monitoring**   | [Event System](./event-system.md)                          | Lifecycle and progress events                |
| **Metrics Tracking**   | [Metrics & Observability](./metrics-observability.md)      | Performance and cost monitoring              |
| **Middleware**         | [Middleware System](./middleware-system.md)                | Cross-cutting concerns                       |
| **Error Handling**     | [Advanced](./advanced.md#error-handling)                   | Robust error handling strategies             |
| **API Reference**      | [API Reference](./api-reference.md)                        | Complete API documentation                   |
| **Code Examples**      | [Examples](./examples.md)                                  | Browse all example code                      |

## 📖 Documentation Structure

```
docs/
├── README.md                      # This file - Documentation index
├── getting-started.md             # Installation and basics
├── architecture.md                # Core concepts and design
├── workflows.md                   # Workflow patterns
├── graph-execution.md             # Graph-based workflows
├── pipeline-patterns.md           # Pipeline patterns (NEW)
├── aggregation-strategies.md      # Result aggregation (NEW)
├── tool-calling.md                # Tool integration
├── memory-system.md               # Multi-level memory
├── context-system.md              # Context & state (NEW)
├── structured-output.md           # Output validation
├── event-system.md                # Event system (NEW)
├── metrics-observability.md       # Metrics & tracking
├── middleware-system.md           # Middleware (NEW)
├── api-reference.md               # Complete API documentation
├── advanced.md                    # Advanced features
├── migration.md                   # Migration from legacy API
└── examples.md                    # Examples index
```

├── migration.md # Migration from legacy API
└── examples.md # Examples index

````

## 🎯 Learn by Use Case

### I want to...

**Create a simple multi-agent system**
→ [Getting Started](./getting-started.md) → [Simple Example](./getting-started.md#your-first-society)

**Build complex workflows with conditional logic**
→ [Graph Execution](./graph-execution.md) → [Conditional Branching](./graph-execution.md#conditional-branching)

**Run agents in parallel and aggregate results**
→ [Pipeline Patterns](./pipeline-patterns.md) → [Scatter-Gather Pattern](./pipeline-patterns.md#scatter-gather-pattern)

**Use pre-built orchestration patterns**
→ [Pipeline Patterns](./pipeline-patterns.md) → [Built-in Pipelines](./pipeline-patterns.md#built-in-pipelines)

**Combine multiple agent results intelligently**
→ [Aggregation Strategies](./aggregation-strategies.md) → [Voting & Consensus](./aggregation-strategies.md#voting-strategy)

**Give agents access to tools and APIs**
→ [Tool Calling](./tool-calling.md) → [Tool Integration](./tool-calling.md#integration-with-agents)

**Manage conversation context and memory**
→ [Memory System](./memory-system.md) → [Memory Management](./memory-system.md#complete-memory-system)

**Share state between agents type-safely**
→ [Context System](./context-system.md) → [Context Providers](./context-system.md#context-provider)

**Validate AI-generated JSON automatically**
→ [Structured Output](./structured-output.md) → [JSON Schema Validation](./structured-output.md#automatic-retry-with-error-feedback)

**Monitor workflow execution in real-time**
→ [Event System](./event-system.md) → [Progress Tracking](./event-system.md#progress-tracking)

**Track costs and performance metrics**
→ [Metrics & Observability](./metrics-observability.md) → [Cost Tracking](./metrics-observability.md#cost-comparison)

**Add logging, caching, or retry logic**
→ [Middleware System](./middleware-system.md) → [Built-in Middlewares](./middleware-system.md#built-in-middlewares)

**Have agents debate and reach consensus**
→ [Pipeline Patterns](./pipeline-patterns.md) → [Debate Pattern](./pipeline-patterns.md#multi-perspective-debate-pattern)

**Implement self-correcting agents**
→ [Pipeline Patterns](./pipeline-patterns.md) → [Self-Correction Pattern](./pipeline-patterns.md#self-correction-pattern)

## 🔧 Feature Matrix

| Feature | Document | Status |
|---------|----------|--------|
| **Fluent Builder API** | [Getting Started](./getting-started.md) | ✅ Stable |
| **Sequential Workflows** | [Workflows](./workflows.md) | ✅ Stable |
| **Parallel Execution** | [Workflows](./workflows.md) | ✅ Stable |
| **Collaborative Agents** | [Workflows](./workflows.md) | ✅ Stable |
| **Graph-based Workflows** | [Graph Execution](./graph-execution.md) | ✅ Stable |
| **Pipeline Patterns** | [Pipeline Patterns](./pipeline-patterns.md) | ✅ Stable |
| **Aggregation Strategies** | [Aggregation Strategies](./aggregation-strategies.md) | ✅ Stable |
| **Tool Calling** | [Tool Calling](./tool-calling.md) | ✅ Stable |
| **Memory System** | [Memory System](./memory-system.md) | ✅ Stable |
| **Context System** | [Context System](./context-system.md) | ✅ Stable |
| **Structured Output** | [Structured Output](./structured-output.md) | ✅ Stable |
| **Event System** | [Event System](./event-system.md) | ✅ Stable |
| **Metrics Tracking** | [Metrics & Observability](./metrics-observability.md) | ✅ Stable |
| **Middleware System** | [Middleware System](./middleware-system.md) | ✅ Stable |
| **Error Handling** | [Advanced](./advanced.md) | ✅ Stable |
| **Retry Mechanisms** | [Advanced](./advanced.md) | ✅ Stable |

## 📚 By Skill Level

### Beginner
- [Getting Started](./getting-started.md) - Setup and first workflow
- [Architecture](./architecture.md) - Core concepts
- [Workflows](./workflows.md) - Basic patterns
- [Examples](./examples.md) - Code examples

### Intermediate
- [Graph Execution](./graph-execution.md) - Complex workflows
- [Pipeline Patterns](./pipeline-patterns.md) - Pre-built patterns
- [Aggregation Strategies](./aggregation-strategies.md) - Result combination
- [Tool Calling](./tool-calling.md) - External integrations
- [Memory System](./memory-system.md) - Context management

### Advanced
- [Context System](./context-system.md) - Dependency injection
- [Event System](./event-system.md) - Event-driven architecture
- [Middleware System](./middleware-system.md) - Cross-cutting concerns
- [Metrics & Observability](./metrics-observability.md) - Production monitoring
- [Advanced Features](./advanced.md) - Performance tuning

## 🎓 Learning Paths

### Path 1: Building Your First Society
1. [Getting Started](./getting-started.md)
2. [Architecture](./architecture.md)
3. [Workflows](./workflows.md)
4. [Examples](./examples.md)

### Path 2: Advanced Orchestration
1. [Pipeline Patterns](./pipeline-patterns.md)
2. [Graph Execution](./graph-execution.md)
3. [Aggregation Strategies](./aggregation-strategies.md)
4. [Advanced Features](./advanced.md)

### Path 3: Production-Ready Systems
1. [Context System](./context-system.md)
2. [Event System](./event-system.md)
3. [Middleware System](./middleware-system.md)
4. [Metrics & Observability](./metrics-observability.md)
5. [Advanced Features](./advanced.md)

### Path 4: Data & Integration
1. [Tool Calling](./tool-calling.md)
2. [Memory System](./memory-system.md)
3. [Structured Output](./structured-output.md)
4. [Context System](./context-system.md)
→ [Workflows](./workflows.md) → [Collaborative Execution](./workflows.md#collaborative-execution)

**Handle errors properly**
→ [Advanced](./advanced.md) → [Error Handling](./advanced.md#error-handling)

**Integrate with OpenAI/Anthropic**
→ [Examples](./examples.md) → [Tool Calling Example](./examples.md#tool-calling-tool-callingts)

**Monitor execution**
→ [Metrics & Observability](./metrics-observability.md) → [Real-Time Monitoring](./metrics-observability.md#real-time-monitoring)

**Optimize performance**
→ [Advanced](./advanced.md) → [Performance](./advanced.md#performance-optimization)

**Test my workflows**
→ [Advanced](./advanced.md) → [Testing](./advanced.md#testing)

**Deploy to production**
→ [Advanced](./advanced.md) → [Production](./advanced.md#production-deployment)

**Migrate from old API**
→ [Migration Guide](./migration.md)

## 💡 Key Concepts

### 1. Roles

Define agent behavior with system prompts, capabilities, and constraints.

```typescript
const role = RoleBuilder.create().withSystemPrompt('You are a data analyst').build();
````

**Read more**: [Architecture - AgentRole](./architecture.md#2-agentrole)

### 2. Agents

Combine roles with AI models to create functional agents.

```typescript
const agent = AgentBuilder.create().withRole(role).withModel(model).build();
```

**Read more**: [Architecture - AgentConfig](./architecture.md#3-agentconfig)

### 3. Graph Execution

Build complex workflows with DAG or cyclic graphs using 8 node types.

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('condition', NodeType.CONDITION, { condition: (ctx) => ctx.data.needsReview })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent')
  .addEdge('agent', 'condition')
  .addEdge('condition', 'end', false) // if false
  .build();
```

**Read more**: [Graph Execution](./graph-execution.md)

### 4. Tool Calling

Give agents access to external tools and APIs.

```typescript
const tool = ToolBuilder.create()
  .withName('get_weather')
  .withDescription('Get weather for a location')
  .withParameter('location', 'string', 'City name', true)
  .withExecutor(async ({ location }) => fetchWeather(location))
  .build();
```

**Read more**: [Tool Calling](./tool-calling.md)

### 5. Memory System

Manage context with multi-level memory (short-term, long-term, entity).

```typescript
const memory = MemoryBuilder.create()
  .withShortTermMemory({ maxSize: 10, decayRate: 0.1 })
  .withLongTermMemory({ maxSize: 100, similarityThreshold: 0.7 })
  .withEntityMemory({ maxEntities: 50 })
  .build();
```

**Read more**: [Memory System](./memory-system.md)

### 6. Structured Output

Validate AI outputs against JSON schemas with automatic retry.

```typescript
const validator = new StructuredOutputValidator({
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 },
  },
  required: ['name', 'age'],
});

const result = await validator.validateAndRetry(generator, 3);
```

**Read more**: [Structured Output](./structured-output.md)

### 7. Metrics & Observability

Track performance, tokens, costs, and custom metrics.

```typescript
const tracker = MetricsBuilder.create()
  .withTokenTracking()
  .withCostTracking(CommonCostConfigs['gpt-4'])
  .withCustomMetrics(['api_calls'])
  .build();

tracker.start('workflow-1');
// ... execute workflow ...
const snapshot = tracker.end('workflow-1');
```

**Read more**: [Metrics & Observability](./metrics-observability.md)

## 🎓 Learning Path

### Level 1: Basics (30 minutes)

1. [Install and setup](./getting-started.md#installation)
2. [Create your first workflow](./getting-started.md#your-first-society)
3. [Understand core concepts](./getting-started.md#understanding-the-basics)

### Level 2: Intermediate (1 hour)

1. [Learn workflow patterns](./workflows.md#common-patterns)
2. [Build graph-based workflows](./graph-execution.md#basic-graph-example)
3. [Add tool calling](./tool-calling.md#basic-tool-creation)
4. [Try different execution types](./workflows.md#execution-types)

### Level 3: Advanced (2 hours)

1. [Implement memory system](./memory-system.md#complete-memory-system)
2. [Add output validation](./structured-output.md#automatic-retry-with-error-feedback)
3. [Setup metrics tracking](./metrics-observability.md#complete-example)
4. [Master error handling](./advanced.md#error-handling)
5. [Optimize performance](./advanced.md#performance-optimization)

### Level 4: Production (3+ hours)

1. [Build complex workflows](./graph-execution.md#conditional-branching)
2. [Integrate all features](./examples.md#complete-integration-complete-integrationts)
3. [Implement observability](./metrics-observability.md#opentelemetry-export)
4. [Deploy to production](./advanced.md#production-deployment)

## 📝 API Quick Reference

| Builder/Class               | Purpose                  | Documentation                                              |
| --------------------------- | ------------------------ | ---------------------------------------------------------- |
| `RoleBuilder`               | Define agent roles       | [API Ref](./api-reference.md#rolebuilder)                  |
| `AgentBuilder`              | Create agents            | [API Ref](./api-reference.md#agentbuilder)                 |
| `GraphBuilder`              | Build graph workflows    | [Graph Execution](./graph-execution.md)                    |
| `ToolBuilder`               | Define tools             | [Tool Calling](./tool-calling.md)                          |
| `ToolRegistry`              | Manage tools             | [Tool Calling](./tool-calling.md#toolregistry)             |
| `ToolExecutor`              | Execute tools            | [Tool Calling](./tool-calling.md#toolexecutor)             |
| `MemoryBuilder`             | Configure memory         | [Memory System](./memory-system.md)                        |
| `MemorySystem`              | Unified memory interface | [Memory System](./memory-system.md#complete-memory-system) |
| `StructuredOutputValidator` | Validate JSON outputs    | [Structured Output](./structured-output.md)                |
| `StructuredOutputBuilder`   | Build validators         | [Structured Output](./structured-output.md)                |
| `MetricsTracker`            | Track workflow metrics   | [Metrics & Observability](./metrics-observability.md)      |
| `MetricsBuilder`            | Configure metrics        | [Metrics & Observability](./metrics-observability.md)      |
| `TokenCounter`              | Count/estimate tokens    | [Metrics & Observability](./metrics-observability.md)      |
| `PerformanceProfiler`       | Profile performance      | [Metrics & Observability](./metrics-observability.md)      |
| `StepBuilder`               | Define workflow steps    | [API Ref](./api-reference.md#stepbuilder)                  |
| `WorkflowConfigBuilder`     | Build workflows          | [API Ref](./api-reference.md#workflowconfigbuilder)        |
| `DefaultWorkflowExecutor`   | Execute workflows        | [API Ref](./api-reference.md#defaultworkflowexecutor)      |
| `StandardModelBase`         | Create AI models         | [API Ref](./api-reference.md#standardmodelbase)            |
| `MessageBus`                | Agent communication      | [API Ref](./api-reference.md#messagebus)                   |

## 🌟 Feature Highlights

### Graph Execution

- **8 Node Types**: START, END, AGENT, PARALLEL, AGGREGATE, CONDITION, TRANSFORM, LOOP
- **Complex Workflows**: DAG and cyclic graphs with conditional branching
- **Parallel Processing**: Run multiple agents simultaneously
- See: [Graph Execution Guide](./graph-execution.md)

### Tool Calling

- **External Integration**: Connect agents to APIs and tools
- **Parameter Validation**: JSON Schema validation for tool parameters
- **Built-in Tools**: Calculator, string manipulation, storage
- See: [Tool Calling Guide](./tool-calling.md)

### Memory System

- **Multi-Level**: Short-term, long-term, and entity memory
- **Auto-Summarization**: Automatic compression of old memories
- **RAG Integration**: Semantic search for long-term memories
- See: [Memory System Guide](./memory-system.md)

### Structured Output

- **JSON Schema**: Industry-standard validation
- **Auto-Retry**: Re-prompt agents with error feedback
- **Complex Types**: Nested objects, arrays, patterns, enums
- See: [Structured Output Guide](./structured-output.md)

### Metrics & Observability

- **Cost Tracking**: Automatic cost calculation for major AI models
- **Token Counting**: Estimate and count tokens
- **OpenTelemetry**: Export traces in industry-standard format
- See: [Metrics & Observability Guide](./metrics-observability.md)

## 🤝 Getting Help

- **Questions**: [GitHub Discussions](https://github.com/benoitpetit/societyai-package/discussions)
- **Bugs**: [GitHub Issues](https://github.com/benoitpetit/societyai-package/issues)
- **Examples**: See [Examples Index](./examples.md) (examples folder coming soon)
- **API Docs**: [API Reference](./api-reference.md)

## 🔗 External Resources

- **npm Package**: [societyai](https://www.npmjs.com/package/societyai)
- **GitHub**: [societyai-package](https://github.com/benoitpetit/societyai-package) (main repository)
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)
- **License**: [MIT](../LICENSE)

## 📋 Document Status

| Document                | Status      | Last Updated |
| ----------------------- | ----------- | ------------ |
| Getting Started         | ✅ Complete | 2026-01-24   |
| Architecture            | ✅ Complete | 2026-01-24   |
| Workflows               | ✅ Complete | 2026-01-24   |
| Graph Execution         | ✅ Complete | 2026-01-24   |
| Tool Calling            | ✅ Complete | 2026-01-24   |
| Memory System           | ✅ Complete | 2026-01-24   |
| Structured Output       | ✅ Complete | 2026-01-24   |
| Metrics & Observability | ✅ Complete | 2026-01-24   |
| API Reference           | ✅ Complete | 2026-01-24   |
| Advanced Features       | ✅ Complete | 2026-01-24   |
| Migration Guide         | ✅ Complete | 2026-01-24   |
| Examples Index          | ✅ Complete | 2026-01-24   |

---

**Start Learning**: [Getting Started →](./getting-started.md)
