# SocietyAI

[![npm version](https://img.shields.io/npm/v/societyai.svg)](https://www.npmjs.com/package/societyai)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

**SocietyAI** is a powerful TypeScript library for creating collaborative
multi-agent AI systems with advanced DAG-based orchestration. Build
sophisticated workflows where AI agents with different roles and capabilities
work together through dependency graphs, conditional routing, and pluggable
execution strategies.

The library is **fully configurable**, **model-agnostic**, and
**domain-independent** - use it for software development, research, content
creation, business analysis, or any domain where multiple perspectives add
value.

## 🎯 Design Principles

- **Model-Agnostic**: Works with any AI model (OpenAI, Anthropic, Google, local
  models, or custom APIs)
- **Domain-Independent**: No hardcoded prompts or business logic - fully
  configurable for any use case
- **Zero Runtime Dependencies**: Pure TypeScript with no external runtime
  dependencies
- **Fluent Builder API**: Intuitive chainable interfaces for configuring agents,
  roles, and workflows
- **DAG Orchestration**: Directed Acyclic Graph scheduling with topological sort
  for optimal execution

## ✨ Key Features

### Core Capabilities

- **🤖 Multi-Agent System**: Define custom roles, behaviors, and capabilities
- **🔄 DAG Workflows**: Dependency-based execution with automatic scheduling
- **🎯 Conditional Routing**: Dynamic workflow branching based on runtime
  results
- **⚡ Execution Strategies**: Pluggable sequential and parallel execution
  patterns
- **🧠 Memory System**: Multi-level context management
- **🛠️ Tool Calling**: External function integration with validation
- **📊 Full Observability**: Structured logging, metrics, and events

## 🚀 Quick Start

### Installation

```bash
npm install societyai
```

### Basic Example

```typescript
import {
  FluentAgentBuilder,
  FluentRoleBuilder,
  FluentWorkflowBuilder,
} from 'societyai';

// Create an agent with a custom role
const agent = new FluentAgentBuilder()
  .withId('analyst')
  .withRole((role) =>
    role
      .withId('data-analyst')
      .withSystemPrompt('You analyze data and provide insights')
  )
  .withModel(yourAIModel)
  .build();

// Build a workflow with dependencies
const workflow = new FluentWorkflowBuilder()
  .withId('data-pipeline')
  .addStep((step) =>
    step.withId('extract').withAgents(['extractor']).sequential()
  )
  .addStep((step) =>
    step
      .withId('transform')
      .dependsOn('extract') // DAG dependency
      .withAgents(['transformer'])
  )
  .build();
```

## 📚 Documentation

### Core Documentation

- **[Getting Started](./docs/getting-started.md)** - Comprehensive guide
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and DAG
  orchestration
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Documentation Index](./docs/README.md)** - Full documentation catalog

### Feature Guides

- [Workflows](./docs/workflows.md) - Building and executing workflows
- [Tool Calling](./docs/tool-calling.md) - External tool integration
- [Memory System](./docs/memory-system.md) - Context management
- [Metrics & Observability](./docs/metrics-observability.md) - Monitoring

### Reference

- [Examples](./docs/examples.md) - Code examples
- [Changelog](./CHANGELOG.md) - Version history

## 🏗️ Architecture

SocietyAI features a modular architecture with DAG-based workflow orchestration:

```
Builders → Orchestrator → Strategies
                ↓
         DAG Scheduler
                ↓
         Conditional Router
                ↓
           Execution
```

**Key Components:**

- **Builders**: Fluent API for workflow construction
- **Orchestrator**: Central coordinator delegating to strategies
- **Scheduler**: Topological sort for optimal execution order
- **Router**: Conditional branching based on runtime conditions
- **Strategies**: Pluggable sequential/parallel execution

See [Architecture Guide](./docs/ARCHITECTURE.md) for details.

## 🧪 Testing

Run tests:

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

Current test coverage: **47.52%** (151 tests passing)

## 🛠️ Development

```bash
npm run build        # Build project
npm run watch        # Development watch mode
npm run lint         # Lint code
npm run format       # Format code
npm run validate     # Full validation (lint + test + build)
```

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **Documentation**: [docs/](./docs/)
- **npm Package**: [societyai](https://www.npmjs.com/package/societyai)
- **Issues**:
  [GitHub Issues](https://github.com/benoitpetit/societyai-package/issues)

---

**Made with ❤️ by the SocietyAI community**
