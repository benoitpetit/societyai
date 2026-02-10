# SocietyAI Documentation

Welcome to the official documentation for **SocietyAI**, the zero-dependency,
model-agnostic multi-agent orchestration framework for TypeScript.

## 📚 Documentation Structure

Our documentation is organized to guide you from basic concepts to advanced
architectural details.

### [1. Basics](./1-basics/)

Start here to understand the core philosophy and get your first agent running.

- **[Getting Started](./1-basics/getting-started.md)**: Installation and "Hello
  World".
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
  (Vector) memory.
- **[Validation](./3-capabilities/validation.md)**: Ensuring robust, structured
  JSON outputs.
- **[Persistence](./3-capabilities/persistence.md)**: Saving and resuming state.

### [4. Advanced](./4-advanced/)

Master the complex features for production-grade systems.

- **[Loops & Cycles](./4-advanced/loops-cycles.md)**: Creating self-correcting
  feedback loops.
- **[Middleware](./4-advanced/middleware.md)**: Intercepting and modifying
  execution flow.
- **[Observability](./4-advanced/observability.md)**: Events, logging, and
  debugging.
- **[Worker Threads](./4-advanced/worker-threads.md)**: Execute CPU-intensive
  agents in isolated threads.
- **[OpenTelemetry Integration](./4-advanced/opentelemetry.md)**: Distributed
  tracing for production.
- **[MCP Support](./4-advanced/mcp.md)**: Model Context Protocol integration.

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

---

## 🚀 Key Features

- **Model Agnostic**: Use OpenAI, Anthropic, Mistral, or local models.
- **Graph-Based**: Supports DAGs, Cycles, and Conditionals.
- **Worker Threads**: Execute CPU-intensive agents without blocking.
- **OpenTelemetry**: Built-in distributed tracing support.
- **MCP Protocol**: Integrate external tools and services.
- **Zero Dependencies**: Lightweight and secure.
- **Type-Safe**: Built with TypeScript for TypeScript.
