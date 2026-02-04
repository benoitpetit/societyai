# SocietyAI

[![npm version](https://img.shields.io/npm/v/societyai.svg)](https://www.npmjs.com/package/societyai)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

**SocietyAI** is a powerful TypeScript/Node.js library for orchestrating collaborative multi-agent systems. It allows you to build sophisticated workflows where AI agents, equipped with specific roles and capabilities, collaborate through a graph-based execution engine (DAG & Cycles).

The library is **fully model-agnostic**, **domain-independent**, and designed to be modular.

> 🎉 **v0.0.3 Released!** Major improvements: unified `TaskResult.output`, comprehensive validation, and better error messages.

## 🎯 Why SocietyAI?

- **Model-Agnostic**: Works with any LLM (OpenAI, Anthropic, Mistral, Local, etc.). You implement the interface, you control the call.
- **Graph Orchestration**: Native support for DAGs (Directed Acyclic Graphs) as well as feedback loops and recursive structures.
- **Zero Runtime Dependencies**: The core is pure TypeScript.
- **Fluent API**: An intuitive builder (`Society.create()`) to quickly define agents and workflows.
- **Type-Safe**: Fully typed for a robust development experience.
- **Two API Levels**: Choose between high-level (quick) or low-level (powerful) depending on your needs.

> 📚 **New to SocietyAI?** Check out the [Documentation](docs/README.md) for architectural insights and best practices.

## ✨ Key Features

- **🤖 Multi-Agent System**: Define roles, personalities, and contexts for each agent.
- **🔄 Flexible Workflows**: Sequential, Parallel, Collaborative (debate between agents), and Conditional.
- **🧠 Memory & Context**: Native management of memory and shared context between steps.
- **⚡ Execution Strategies**: The engine transforms your configuration into an optimized execution graph.
- **🛠️ Extensible**: Middleware system, Custom Tools (Function Calling), and Validation.

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

### 1. Connect Your Model

SocietyAI does not depend on any specific SDK library. You simply need to adapt your model to the `AIModel` interface. Here is a minimal example for OpenAI:

```typescript
import { AIModel } from 'societyai';
import OpenAI from 'openai'; // Install openai separately

export class OpenAIModel implements AIModel {
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, model: string = 'gpt-4') {
    this.client = new OpenAI({ apiKey });
    this.modelName = model;
  }

  name(): string { return this.modelName; }

  supportsPromptType(type: string): boolean { return true; }

  async process(prompt: unknown): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: String(prompt) }],
    });
    return response.choices[0].message.content || '';
  }
}
```

### 2. Create Your First Society

This example creates a small team to write and review an article.

```typescript
import { Society } from 'societyai';
import { OpenAIModel } from './my-model-impl'; // Your implementation above

const model = new OpenAIModel(process.env.OPENAI_API_KEY);

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
      .withInstructions('Review the previous text, correct mistakes, and improve the tone.')
      .sequential()
  )
  
  // Execute
  .execute('Start Project');

console.log('Final Result:', result.output);
console.log('History:', result.taskResults);
```

## 📚 Documentation

Explore detailed documentation in the `/docs` folder:

- **[Getting Started](./docs/getting-started.md)**: Complete step-by-step tutorial.
- **[Architecture](./docs/architecture.md)**: Understand the graph engine and key concepts.
- **[API Reference](./docs/api-reference.md)**: Technical documentation of classes and interfaces.
- **[API Decision Guide](./docs/api-decision-guide.md)**: Choose between high-level and low-level APIs.
- **Advanced Topics**:
  - [Tools & Function Calling](./docs/capabilities/tools.md)
  - [Middleware System](./docs/core/middleware.md)
  - [Memory Systems](./docs/capabilities/memory.md)
  - [Validation](./docs/capabilities/validation.md)

## 🤝 Contribution

Contributions are welcome! Feel free to open an issue or a Pull Request on the GitHub repository.

## 📄 License

MIT
