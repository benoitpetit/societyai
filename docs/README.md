# SocietyAI Documentation

Welcome to the official documentation for **SocietyAI**, the zero-dependency,
model-agnostic multi-agent orchestration framework for TypeScript.

## 📚 Documentation Structure

Our documentation is organized to guide you from basic concepts to advanced
architectural details.

### [1. Basics](./1-basics/)

Start here to understand the core philosophy and get your first agent running.

- **[Getting Started](./1-basics/getting-started.md)**: Installation, "Hello
  World", and CLI usage.
- **[Core Concepts](./1-basics/core-concepts.md)**: The mental model: Agents,
  Societies, Tasks, and the Graph.

### [2. Building Societies](./2-building-societies/)

Learn how to construct complex multi-agent systems using the Fluent API.

- **[Society Configuration](./2-building-societies/society-configuration.md)**:
  The main `Society` entry point.
- **[Society Builder](./2-building-societies/society-builder.md)**: Complete API
  reference for `Society`, `FluentTaskBuilder`, and `AggregationStrategies`.
- **[Agents & Roles](./2-building-societies/agents-roles.md)**: Defining
  personalities and models.
- **[Context Management](./2-building-societies/context.md)**: Sharing data
  between agents.
- **[Prompts](./2-building-societies/prompts.md)**: Managing system prompts and
  instructions.

### [3. Capabilities](./3-capabilities/)

Give your agents superpowers.

- **[Tools & Functions](./3-capabilities/tools-functions.md)**: Enabling agents
  to interact with the world.
- **[Memory Systems](./3-capabilities/memory.md)**: Short-term and Long-term
  (Vector) memory with automatic persistence.
- **[Validation](./3-capabilities/validation.md)**: Ensuring robust, structured
  JSON outputs.
- **[Persistence](./3-capabilities/persistence.md)**: Saving and resuming state.

### [4. Advanced](./4-advanced/)

Master the complex features for production-grade systems.

- **[Loops & Cycles](./4-advanced/loops-cycles.md)**: Creating self-correcting
  feedback loops.
- **[Middleware](./4-advanced/middleware.md)**: Intercepting and modifying
  execution flow, including streaming middleware.
- **[Observability](./4-advanced/observability.md)**: Events, logging, and
  debugging.
- **[Worker Threads](./4-advanced/worker-threads.md)**: Execute CPU-intensive
  agents in isolated threads with built-in adapters.
- **[OpenTelemetry Integration](./4-advanced/opentelemetry.md)**: Distributed
  tracing for production.
- **[MCP Support](./4-advanced/mcp.md)**: Model Context Protocol integration.
- **[Visualization](./4-advanced/visualization.md)**: Generate Mermaid, DOT, and
  HTML diagrams of your workflows.
- **[Benchmarks](./4-advanced/benchmarks.md)**: Performance testing and metrics.

### [5. Architecture](./5-architecture/)

Deep dive into how SocietyAI works under the hood.

- **[System Overview](./5-architecture/overview.md)**: High-level architectural
  map.
- **[Agent Interfaces](./5-architecture/agent-interfaces.md)**: `AIModel`,
  `Role`, and `Agent` interfaces.
- **[Execution Engine](./5-architecture/execution-engine.md)**: The DAG and
  State Machine logic.
- **[Graph Transformation](./5-architecture/graph-transformation.md)**:
  Transformation mechanisms guide.
- **[Patterns](./5-architecture/patterns.md)**: Common architectural patterns.

### [6. Advanced Features](./6-advanced-features/)

- **[Advanced Features](./6-advanced-features/advanced-features.md)**: Storage
  adapters, Vector Store, Hierarchical Societies, Self-Correcting Validation.

### [Reference](./reference/)

- **[API Index](./reference/index.md)**: Complete API reference.
- **[Decision Guide](./reference/decision-guide.md)**: When to use High-level vs
  Low-level APIs.
- **[CLI Reference](./reference/cli.md)**: Command-line interface documentation.

---

## 🚀 Key Features

- **Model Agnostic**: Use OpenAI, Anthropic, Mistral, or local models with
  built-in adapters.
- **Graph-Based**: Supports DAGs, Cycles, and Conditionals with advanced
  visualization.
- **Worker Threads**: Execute CPU-intensive agents without blocking using
  simplified adapters.
- **Streaming Middleware**: Transform and monitor streaming responses in
  real-time.
- **OpenTelemetry**: Built-in distributed tracing support.
- **MCP Protocol**: Integrate external tools and services.
- **Zero Dependencies**: Lightweight and secure.
- **Type-Safe**: Built with TypeScript for TypeScript.
- **CLI Tools**: Validate, visualize, run, and benchmark your societies.

---

## 🛠️ CLI Quick Reference

```bash
# Validate configuration
npx societyai validate ./my-society.ts

# Generate visualization
npx societyai visualize ./my-society.ts --format html --output graph.html

# Run with monitoring
npx societyai run ./my-society.ts --input "Hello" --verbose --metrics

# Create new project
npx societyai init --template advanced --output ./my-project/

# Run benchmarks
npx societyai benchmark --filter "parallel" --runs 50

# Compare versions
npx societyai diff ./society-v1.ts ./society-v2.ts
```

---

## 📦 Module Exports

SocietyAI uses a modular export structure for better tree-shaking:

```typescript
// Essential API (recommended)
import { Society, Agent, TaskResult } from 'societyai';

// Advanced execution engine
import { ExecutionEngine, GraphBuilder } from 'societyai/advanced';

// Memory management
import { MemorySystem, MemoryBuilder } from 'societyai/memory';

// Event system
import { SocietyEventEmitter, ProgressTracker } from 'societyai/events';

// Context system
import { ContextProvider, ContextScope } from 'societyai/context';

// Model adapters
import { ModelAdapters } from 'societyai/adapters';
```

---

*Last updated: 2026-03-13*
