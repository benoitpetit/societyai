# 📚 SocietyAI Documentation

Welcome to the complete documentation for **SocietyAI**, a TypeScript library
for creating collaborative multi-agent systems with advanced DAG orchestration.

## 🚀 Quick Start

### Getting Started

- **[Getting Started Guide](./getting-started.md)** - Installation,
  configuration, first workflows
- **[Main README](../README.md)** - Project overview and quickstart

### Examples

- **[Examples](./examples.md)** - Complete code examples and use cases

## 🏗️ Architecture & Concepts

### System Architecture

- **[Architecture](./ARCHITECTURE.md)** - DAG Orchestration, Strategies, Routing

### Core Systems

- **[Context System](./context-system.md)** - State management and dependency
  injection
- **[Event System](./event-system.md)** - Event-driven architecture, lifecycle
  hooks
- **[Memory System](./memory-system.md)** - Short/long-term memory, entities,
  RAG

## 🔧 Workflows & Execution

### Building Workflows

- **[Workflows](./workflows.md)** - Construction and execution with fluent
  builders
- **[Graph Execution](./graph-execution.md)** - DAG and cyclic graph execution
- **[Pipeline Patterns](./pipeline-patterns.md)** - Chain, Scatter-Gather,
  Router, Map-Reduce, Saga

### Orchestration

- **Orchestrator** - Central coordinator with delegation (see
  [ARCHITECTURE](./ARCHITECTURE.md))
- **Execution Strategies** - Pluggable Sequential/Parallel patterns
- **DAG Scheduler** - Topological sort for optimal execution order
- **Conditional Router** - Dynamic runtime branching

## 🛠️ Capabilities & Features

### External Integrations

- **[Tool Calling](./tool-calling.md)** - External tool and API integration with
  JSON Schema validation
- **[Structured Output](./structured-output.md)** - Structured output validation
  with automatic retry

### Processing & Aggregation

- **[Aggregation Strategies](./aggregation-strategies.md)** - Consensus, voting,
  ranking, best-of

### Middleware & Extensibility

- **[Middleware System](./middleware-system.md)** - Composable interceptors
  (logging, caching, rate limiting, retry, circuit breaker)

## 📊 Observability & Monitoring

- **[Metrics & Observability](./metrics-observability.md)** - Complete metrics
  and monitoring
  - Token counting & cost estimation
  - Performance profiling (marks, measures)
  - Structured JSON logs
  - OpenTelemetry export

## 📖 Reference & Advanced Guides

### Complete Documentation

- **[API Reference](./api-reference.md)** - Exhaustive API documentation

### Advanced Patterns

- **[Advanced Patterns](./advanced.md)** - Self-correction, multi-perspective
  debate, hierarchical review, ensemble

### Migration & Support

- **[Changelog](../CHANGELOG.md)** - Version history

## 🗂️ Code Organization

### Module Structure

```
src/
├── core/              Foundations (types, config, errors, models, context, middleware)
├── agents/            Agent society and execution
├── builders/          Fluent API (role, agent, workflow builders)
├── execution/         Orchestration and execution
│   ├── strategies/    ⭐ Sequential & Parallel strategies
│   ├── scheduler/     ⭐ DAG dependency graph & topological sort
│   └── routing/       ⭐ Conditional routing
├── capabilities/      Tools, Memory, Validation
├── observability/     Logging, Metrics, Events
└── utils/             Retry, WorkerPool
```

### Main Modules

#### Core (`src/core/`)

| Module          | Description                       |
| --------------- | --------------------------------- |
| `types.ts`      | Complete TypeScript definitions   |
| `config.ts`     | Centralized configuration system  |
| `errors.ts`     | Custom error classes              |
| `models.ts`     | AI model implementations          |
| `context.ts`    | Context management with injection |
| `middleware.ts` | Interceptor system                |

#### Builders (`src/builders/`) - Fluent API

| Module                | Description                               | Documentation                           |
| --------------------- | ----------------------------------------- | --------------------------------------- |
| `role-builder.ts`     | Agent role construction                   | [Getting Started](./getting-started.md) |
| `agent-builder.ts`    | Agent construction                        | [Getting Started](./getting-started.md) |
| `workflow-builder.ts` | Workflow construction with `.dependsOn()` | [Workflows](./workflows.md)             |

#### Execution (`src/execution/`) - Orchestration

| Module            | Description                    | Documentation                               |
| ----------------- | ------------------------------ | ------------------------------------------- |
| `orchestrator.ts` | Central coordinator            | [ARCHITECTURE](./ARCHITECTURE.md)           |
| `strategies/`     | Sequential/Parallel strategies | [ARCHITECTURE](./ARCHITECTURE.md)           |
| `scheduler/`      | DAG + topological sort         | [ARCHITECTURE](./ARCHITECTURE.md)           |
| `routing/`        | Conditional router             | [ARCHITECTURE](./ARCHITECTURE.md)           |
| `graph.ts`        | DAG/cyclic graph execution     | [Graph Execution](./graph-execution.md)     |
| `pipeline.ts`     | Pipelines and patterns         | [Pipeline Patterns](./pipeline-patterns.md) |
| `patterns.ts`     | Pre-built patterns             | [Advanced](./advanced.md)                   |

#### Capabilities (`src/capabilities/`) - Features

| Module          | Description                | Documentation                               |
| --------------- | -------------------------- | ------------------------------------------- |
| `tools.ts`      | External tool registry     | [Tool Calling](./tool-calling.md)           |
| `memory.ts`     | Multi-level memory systems | [Memory System](./memory-system.md)         |
| `validation.ts` | Structured validation      | [Structured Output](./structured-output.md) |

#### Observability (`src/observability/`) - Monitoring

| Module       | Description         | Documentation                                         |
| ------------ | ------------------- | ----------------------------------------------------- |
| `logger.ts`  | Structured logs     | [Metrics & Observability](./metrics-observability.md) |
| `metrics.ts` | Performance metrics | [Metrics & Observability](./metrics-observability.md) |
| `events.ts`  | Event system        | [Event System](./event-system.md)                     |

## 📚 Guides by Level

### 🟢 Beginners

1. [Getting Started](./getting-started.md) - Installation and first agents
2. [Workflows](./workflows.md) - Simple sequential/parallel workflows
3. [Tool Calling](./tool-calling.md) - Integrate external tools
4. [Examples](./examples.md) - Complete examples

### 🟡 Intermediate

1. [DAG Architecture](./ARCHITECTURE.md) - Understand DAG orchestration
2. [Pipeline Patterns](./pipeline-patterns.md) - Advanced composition patterns
3. [Memory System](./memory-system.md) - Context and memory management
4. [Structured Output](./structured-output.md) - Validation with schemas

### 🔴 Advanced

1. [Graph Execution](./graph-execution.md) - Complex DAG/cyclic graphs
2. [Advanced Patterns](./advanced.md) - Self-correction, debate, ensemble
3. [Middleware System](./middleware-system.md) - Custom interceptors
4. [API Reference](./api-reference.md) - Complete API documentation

## 🔗 External Resources

- **npm Package**: [societyai](https://www.npmjs.com/package/societyai)
- **GitHub Repository**:
  [benoitpetit/societyai-package](https://github.com/benoitpetit/societyai-package)
- **Issues & Bugs**:
  [GitHub Issues](https://github.com/benoitpetit/societyai-package/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/benoitpetit/societyai-package/discussions)
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)

## 📞 Support & Contributing

### Support

- 📧 **Issues**:
  [Create a GitHub issue](https://github.com/benoitpetit/societyai-package/issues)
- 💬 **Discussions**:
  [GitHub Discussions](https://github.com/benoitpetit/societyai-package/discussions)

### Contributing

- 📖 **Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- 📜 **Code of Conduct**: [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)

---

**Version:** 0.0.2  
**Last Updated:** February 2, 2026  
**Status:** Pre-release  
**License:** MIT
