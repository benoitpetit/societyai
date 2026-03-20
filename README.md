# SocietyAI

<div align="center">
  <img src="https://societyai.pages.dev/logo.png" alt="SocietyAI Logo" width="200" />

  <p>
    <a href="https://www.npmjs.com/package/societyai"><img src="https://img.shields.io/npm/v/societyai.svg" alt="npm version"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="license"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.5%2B-blue.svg" alt="TypeScript 5.5+"></a>
    <a href="package.json"><img src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" alt="Zero Dependencies"></a>
  </p>
</div>

**SocietyAI** is a powerful TypeScript/Node.js library for orchestrating
collaborative multi-agent systems. It allows you to build sophisticated
workflows where AI agents, equipped with specific roles and capabilities,
collaborate through a graph-based execution engine (DAG & Cycles).

The library is **fully model-agnostic**, **domain-independent**, and designed to
be modular. Requires TypeScript **5.5 or higher** (developed and tested on 5.9).

## 🎯 Why SocietyAI?

- **Model-Agnostic**: Works with any LLM (OpenAI, Anthropic, Mistral, Local,
  etc.). You implement the interface, you control the call.
- **Graph Orchestration**: Native support for DAGs (Directed Acyclic Graphs) as
  well as feedback loops and recursive structures.
- **Zero Runtime Dependencies**: The core is pure TypeScript.
- **Fluent API**: An intuitive builder (`Society.create()`) to quickly define
  agents and workflows.
- **Type-Safe**: Fully typed for a robust development experience.
- **Two API Levels**: Choose between high-level (quick) or low-level (powerful)
  depending on your needs.

> 📚 **New to SocietyAI?** Check out the [Documentation](docs/README.md) for
> architectural insights and best practices.

## ✨ Key Features

- **🤖 Multi-Agent System**: Define roles, personalities, and contexts for each
  agent.
- **🔄 Flexible Workflows**: Sequential, Parallel, Collaborative (debate between
  agents), and Conditional.
- **⚡ Worker Threads Support**: Execute CPU-intensive agents in isolated worker
  threads to prevent blocking the main event loop.
- **🧠 Memory & Context**: Native management of short/long-term memory and
  type-safe Context Injection.
- **💾 Persistence & Recovery**: Save execution state, handle crashes, and
  resume workflows seamlessly.
- **📊 OpenTelemetry Integration**: Built-in distributed tracing support for
  production observability.
- **🔌 MCP Protocol Support**: Integrate external tools and services via Model
  Context Protocol.
- **📡 Observability**: Full event-driven system to track every thought, action,
  and state change.
- **🙋 Human-in-the-Loop**: Pause workflows for human validation or input and
  resume automatically.
- **⚡ Execution Strategies**: The engine transforms your configuration into an
  optimized execution graph.
- **🛠️ Extensible**: Middleware system, Custom Tools (Function Calling), and
  Validation.

## 🧪 Testing

SocietyAI comes with a comprehensive test suite using **Jest**.

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test -- --coverage
```

### Coverage Areas

- **Core Logic**: Execution engine, graph traversal, and state management.
- **Capabilities**: Tool execution, memory system, and schema validation.
- **Builders**: Fluent API configuration and validation.
- **Observability**: Event system and logging.

## 🚀 Quick Start

### Installation

```bash
npm install societyai
```

### 1. Quick Start with Built-in Adapters

SocietyAI provides built-in adapters for popular LLM providers:

```typescript
import { Society } from 'societyai';
import { ModelAdapters } from 'societyai/adapters';

// Use built-in OpenAI adapter
const model = ModelAdapters.openai({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

const result = await Society.create()
  .addAgent(agent => agent
    .withId('writer')
    .withRole(r => r.withSystemPrompt('You are a technical writer'))
    .withModel(model)
  )
  .addTask(t => t
    .withId('write')
    .withAgents(['writer'])
    .sequential()
  )
  .execute('Write about TypeScript');
```

### Available Adapters

```typescript
import { ModelAdapters } from 'societyai/adapters';

// OpenAI
const openai = ModelAdapters.openai({ apiKey, model: 'gpt-4' });

// Anthropic
const anthropic = ModelAdapters.anthropic({ apiKey, model: 'claude-3-opus' });

// Google Gemini
const gemini = ModelAdapters.gemini({ apiKey, model: 'gemini-pro' });

// Azure OpenAI
const azure = ModelAdapters.azureOpenAI({ apiKey, endpoint, deployment });

// Ollama (local)
const ollama = ModelAdapters.ollama({ model: 'llama2', baseURL });

// Mock (for testing)
import { MockModel } from 'societyai/adapters';
const mock = new MockModel();
```

### 2. Create Your First Society

This example creates a small team to write and review an article.

```typescript
import { Society } from 'societyai';
import { ModelAdapters } from 'societyai/adapters';

const model = ModelAdapters.openai({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

// Create the Society
const result = await Society.create()
  .withId('blog-team')

  // -- Define Agents --
  .addAgent((agent) =>
    agent
      .withId('writer')
      .withRole((role) =>
        role
          .withName('Technical Writer')
          .withSystemPrompt('You are an expert in concise technical writing.')
      )
      .withModel(model)
  )
  .addAgent((agent) =>
    agent
      .withId('editor')
      .withRole((role) =>
        role
          .withName('Editor in Chief')
          .withSystemPrompt('You correct style and verify clarity.')
      )
      .withModel(model)
  )

  // -- Define Workflow --

  // Task 1: The writer writes
  .addTask((task) =>
    task
      .withId('draft')
      .withAgents(['writer'])
      .withInstructions('Write a paragraph about the benefits of TypeScript.')
      .sequential()
  )

  // Task 2: The editor reviews (explicitly depends on 'draft')
  .addTask((task) =>
    task
      .withId('review')
      .dependsOn('draft')
      .withAgents(['editor'])
      .withInstructions(
        'Review the previous text, correct mistakes, and improve the tone.'
      )
      .sequential()
  )

  // Execute
  .execute('Start Project');

console.log('Final Result:', result.output);
console.log('History:', result.taskResults);
```

### 3. Advanced: Worker Threads & Observability

For CPU-intensive agents, use worker threads to prevent blocking:

```typescript
import { Society, Middlewares, MiddlewareChain } from 'societyai';
import { ModelAdapters } from 'societyai/adapters';

const model = ModelAdapters.openai({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

const result = await Society.create()
  .withId('advanced-team')
  .addMiddleware(
    MiddlewareChain.create()
      .use(Middlewares.logging())
      .use(Middlewares.retry({ maxAttempts: 3 }))
  )

  // Standard agent — I/O-bound (runs in main thread)
  .addAgent((agent) =>
    agent
      .withId('coordinator')
      .withRole((role) =>
        role.withSystemPrompt('You coordinate tasks and handle I/O operations.')
      )
      .withModel(model)
    // executionMode defaults to 'inline' (main thread)
  )

  // CPU-intensive agent — runs in an isolated Worker Thread
  .addAgent((agent) =>
    agent
      .withId('data-processor')
      .withRole((role) =>
        role.withSystemPrompt(
          'You perform heavy data analysis and complex calculations.'
        )
      )
      .withModel(model)
      .withExecutionMode('isolated')    // ← Worker Thread
  )

  .addTask((task) =>
    task
      .withId('coordinate')
      .withAgents(['coordinator'])
      .sequential()
      .thenGoto('process')              // explicit routing to next task
  )
  .addTask((task) =>
    task.withId('process').withAgents(['data-processor']).sequential()
  )

  .execute('Start workflow');

console.log('Result:', result.output);
```

**Key Points:**

- **`executionMode: 'isolated'`**: Runs the agent in a Worker Thread, preventing
  main-event-loop blocking for CPU-heavy work.
- **Middlewares**: Applied to every agent call via `.addMiddleware()`. Accepts a
  single `Middleware`, a raw `MiddlewareFn`, or a `MiddlewareChain`.
- **ModelAdapters**: Built-in adapters for OpenAI, Anthropic, Gemini, Azure, Ollama.
- **MCP Tools**: Add external tools via
  `withTools(await MCPServers.filesystem('/path'))` on any agent.

## 📚 Documentation

Explore detailed documentation in the `/docs` folder:

- **[1. Basics](./docs/1-basics/)**: Getting Started and Core Concepts.
- **[2. Building Societies](./docs/2-building-societies/)**: Agents, Roles,
  Context, and Configuration.
- **[3. Capabilities](./docs/3-capabilities/)**: Tools, Memory, Validation, and
  Persistence.
- **[4. Advanced](./docs/4-advanced/)**: Loops, Middleware, and Observability.
- **[5. Architecture](./docs/5-architecture/)**: Execution Engine, DAGs, and
  Patterns.
- **[Reference](./docs/reference/)**: API Index and Decision Guides.

Recent Highlights:

- [Getting Started](./docs/1-basics/getting-started.md) with CLI and ModelAdapters.
- [Context Management](./docs/2-building-societies/context.md) for dependency
  injection.
- [Visualization](./docs/4-advanced/visualization.md) — Mermaid, DOT, HTML export.
- [Benchmarks](./docs/4-advanced/benchmarks.md) — Performance testing.
- [Middleware](./docs/4-advanced/middleware.md) — Including streaming middleware.
- [Memory & RAG](./docs/3-capabilities/memory.md) for long-term state.
- [Structured Validation](./docs/3-capabilities/validation.md) for reliable JSON
  outputs.
- [Execution Engine](./docs/5-architecture/execution-engine.md) deep dive.
- [CLI Reference](./docs/reference/cli.md) — Complete CLI documentation.

## 🤝 Contribution

Contributions are welcome! Feel free to open an issue or a Pull Request on the
GitHub repository.

## 📄 License

MIT
