# SocietyAI

[![npm version](https://img.shields.io/npm/v/@societyai/core.svg)](https://www.npmjs.com/package/@societyai/core)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

**SocietyAI** is a powerful TypeScript library for creating collaborative multi-agent AI systems. Build sophisticated workflows where AI agents with different roles and capabilities work together to solve complex problems, analyze information from multiple perspectives, and generate comprehensive responses.

The library is **fully configurable**, **model-agnostic**, and **domain-independent** - use it for software development, research, content creation, business analysis, or any domain where multiple perspectives add value.

## ✨ Features

- **🤖 Configurable Multi-Agent System**: Define custom roles, behaviors, capabilities, and constraints for each agent
- **🔄 Flexible Workflow Engine**: Sequential, parallel, collaborative, and conditional execution patterns
- **💬 Inter-Agent Communication**: Built-in message bus for agent-to-agent information exchange
- **🔌 Model-Agnostic**: Works with any AI model - OpenAI, Anthropic, Google, local models, or custom APIs
- **🏗️ Builder Pattern API**: Intuitive fluent interfaces for creating agents, roles, and workflows
- **⚡ High Performance**: Worker pool for parallelization, timeout support, and operation cancellation
- **🛡️ Robust Error Handling**: Automatic retry with exponential backoff and comprehensive error types
- **📊 Full Observability**: Logging system and observer pattern for monitoring and debugging
- **🎯 Type-Safe**: Written in TypeScript with complete type definitions
- **📦 Zero Dependencies**: No external runtime dependencies (only dev dependencies for testing)

## 📦 Installation

```bash
npm install @societyai/core
```

## 🚀 Quick Start

### Basic Example

```typescript
import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
  StandardModelBase,
} from '@societyai/core';

// 1. Create your AI model (connect to any AI API)
class MyAIModel extends StandardModelBase {
  constructor() {
    super({ name: 'MyModel' }, async (prompt) => {
      // Connect to your AI API here (OpenAI, Anthropic, etc.)
      const response = await fetch('https://api.example.com/ai', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      return await response.text();
    });
  }
}

// 2. Define agent roles
const analyst = RoleBuilder.create()
  .withId('analyst')
  .withName('Data Analyst')
  .withSystemPrompt('You are a data analyst. Examine information objectively and identify patterns.')
  .withCapabilities(['data-analysis', 'pattern-recognition'])
  .build();

const reviewer = RoleBuilder.create()
  .withId('reviewer')
  .withName('Critical Reviewer')
  .withSystemPrompt('You are a critical reviewer. Challenge assumptions and ensure quality.')
  .build();

// 3. Create agents with roles and models
const model = new MyAIModel();

const agents = [
  AgentBuilder.create()
    .withId('analyst-1')
    .withRole(analyst)
    .withModel(model)
    .build(),
    
  AgentBuilder.create()
    .withId('reviewer-1')
    .withRole(reviewer)
    .withModel(model)
    .build(),
];

// 4. Define workflow steps
const workflow = WorkflowConfigBuilder.create()
  .withId('analysis-workflow')
  .withName('Analysis Workflow')
  .addAgents(agents)
  .addStep(
    StepBuilder.create()
      .withId('analysis')
      .withName('Initial Analysis')
      .withAgents(['analyst-1'])
      .withExecutionType('sequential')
      .withInstructions('Analyze the input thoroughly.')
      .build()
  )
  .addStep(
    StepBuilder.create()
      .withId('review')
      .withName('Quality Review')
      .withAgents(['reviewer-1'])
      .withExecutionType('sequential')
      .withInstructions('Review and validate the analysis.')
      .build()
  )
  .build();

// 5. Execute the workflow
const executor = new DefaultWorkflowExecutor();
const result = await executor.execute(workflow, 'Analyze market trends for Q4 2024');

console.log(result.output);
console.log(`Completed in ${result.duration}ms`);
```

## 📚 Key Concepts

### Execution Types

| Type            | Description                                               | Use Case                                |
| --------------- | --------------------------------------------------------- | --------------------------------------- |
| `sequential`    | Agents execute one after another in order                 | Pipeline processing, step-by-step tasks |
| `parallel`      | All agents execute simultaneously                         | Independent analyses, speed optimization|
| `collaborative` | Agents exchange messages across multiple iterations       | Discussions, consensus building         |
| `conditional`   | Step executes only if condition is met                    | Dynamic workflows, branching logic      |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     WorkflowConfig                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Agents (with Roles & Models)                        │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Steps (Sequential/Parallel/Collaborative)           │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Communication Channels (MessageBus)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  DefaultWorkflowExecutor
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
              Agent 1    Agent 2    Agent 3
                 │          │          │
                 ▼          ▼          ▼
             AI Model   AI Model   AI Model
```

## 🎯 Common Use Cases

### Software Development Team

```typescript
const pmRole = RoleBuilder.create()
  .withId('pm')
  .withSystemPrompt('You organize and plan development tasks.')
  .build();

const devRole = RoleBuilder.create()
  .withId('dev')
  .withSystemPrompt('You implement features following best practices.')
  .build();

const qaRole = RoleBuilder.create()
  .withId('qa')
  .withSystemPrompt('You test implementations and find bugs.')
  .build();

// Create workflow with parallel development
const devWorkflow = WorkflowConfigBuilder.create()
  .addAgents([pmAgent, dev1Agent, dev2Agent, qaAgent])
  .addStep(planningStep)
  .addStep(parallelDevStep)  // Both devs work simultaneously
  .addStep(testingStep)
  .build();
```

### Research & Analysis

```typescript
const researchWorkflow = WorkflowConfigBuilder.create()
  .addStep(
    StepBuilder.create()
      .withId('gather')
      .withAgents(['researcher-1', 'researcher-2'])
      .withExecutionType('parallel')
      .build()
  )
  .addStep(
    StepBuilder.create()
      .withId('synthesize')
      .withAgents(['synthesizer'])
      .withExecutionType('sequential')
      .build()
  )
  .build();
```

### Collaborative Discussion

```typescript
const discussionStep = StepBuilder.create()
  .withId('discussion')
  .withAgents(['participant-1', 'participant-2', 'participant-3'])
  .withExecutionType('collaborative')
  .withMaxIterations(3)  // Up to 3 rounds
  .withCompletionCondition((results, iteration) => {
    // Custom completion logic
    return iteration >= 2 || consensusReached(results);
  })
  .build();
```

## 🔧 Advanced Features

### Inter-Agent Communication

```typescript
// Agents can communicate directly with each other
const agent1 = AgentBuilder.create()
  .withId('agent-1')
  .canCommunicateWith(['agent-2', 'agent-3'])
  .build();

// Messages are automatically passed through MessageBus
// Agents can send requests, responses, and share data
```

### Custom Result Generators

```typescript
WorkflowConfigBuilder.create()
  .withFinalResultGenerator(async (stepResults, context) => {
    // Custom logic to combine all step results
    let summary = 'Executive Summary:\n';
    
    for (const [stepId, results] of stepResults) {
      summary += `\n${stepId}:\n`;
      results.forEach(r => {
        if (r.success) {
          summary += `  - ${r.agentId}: ${r.content.substring(0, 100)}...\n`;
        }
      });
    }
    
    return summary;
  })
  .build();
```

### Lifecycle Hooks

```typescript
WorkflowConfigBuilder.create()
  .onBeforeStep(async (step, context) => {
    console.log(`Starting: ${step.name}`);
    // Inject dynamic data, log metrics, etc.
  })
  .onAfterStep(async (step, results, context) => {
    console.log(`Completed: ${step.name}`);
    // Store results, trigger notifications, etc.
  })
  .build();
```

### Observability

```typescript
const observer: SocietyObserver = {
  onSocietyStart(prompt, agentCount) {
    console.log(`Starting with ${agentCount} agents`);
  },
  onAgentStart(agentId, modelName, prompt) {
    console.log(`Agent ${agentId} (${modelName}) started`);
  },
  onAgentComplete(agentId, modelName, result) {
    console.log(`Agent ${agentId} completed successfully`);
  },
  onAgentError(agentId, modelName, error) {
    console.error(`Agent ${agentId} failed:`, error);
  },
  onPhaseStart(phase) {
    console.log(`Phase: ${phase}`);
  },
  onPhaseComplete(phase) {
    console.log(`Phase ${phase} completed`);
  },
  onSocietyComplete(result) {
    console.log('Workflow complete');
  },
};

const executor = new DefaultWorkflowExecutor(observer);
```

### Timeout & Cancellation

```typescript
// Create an abort controller for cancellation
const controller = new AbortController();

// Set a timeout
setTimeout(() => controller.abort(), 30000); // 30 seconds

// Execute with cancellation support
try {
  const result = await executor.execute(
    workflow, 
    input, 
    controller.signal
  );
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Operation cancelled');
  }
}
```

### Error Handling

```typescript
import { 
  SocietyError, 
  ProcessingFailedError,
  TimeoutError,
  InvalidConfigurationError 
} from '@societyai/core';

try {
  const result = await executor.execute(workflow, input);
} catch (error) {
  if (error instanceof ProcessingFailedError) {
    console.error('AI model processing failed:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Operation timed out');
  } else if (error instanceof InvalidConfigurationError) {
    console.error('Invalid workflow configuration:', error.message);
  }
}
```

## 🔌 Model Integration

### OpenAI Integration

```typescript
import OpenAI from 'openai';
import { StandardModelBase } from '@societyai/core';

class OpenAIModel extends StandardModelBase {
  private client: OpenAI;
  
  constructor(apiKey: string, model = 'gpt-4-turbo') {
    const client = new OpenAI({ apiKey });
    
    super({ name: model }, async (prompt) => {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: String(prompt) }],
      });
      return response.choices[0].message.content || '';
    });
    
    this.client = client;
  }
}
```

### Anthropic Integration

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { StandardModelBase } from '@societyai/core';

class ClaudeModel extends StandardModelBase {
  private client: Anthropic;
  
  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022') {
    const client = new Anthropic({ apiKey });
    
    super({ name: model }, async (prompt) => {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: String(prompt) }],
      });
      return response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';
    });
    
    this.client = client;
  }
}
```

### Custom API Integration

```typescript
class CustomAIModel extends StandardModelBase {
  constructor(apiUrl: string, apiKey: string) {
    super({ name: 'CustomModel' }, async (prompt, signal) => {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: String(prompt) }),
        signal, // Support cancellation
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.result;
    });
  }
}
```

## 📖 API Reference

### Core Classes

#### `RoleBuilder`
Create agent roles with specific behaviors.

```typescript
RoleBuilder.create()
  .withId(id: string)
  .withName(name: string)
  .withSystemPrompt(prompt: string)
  .withCapabilities(capabilities: string[])
  .withConstraints(constraints: string[])
  .withPromptTemplate(template: string)
  .build(): AgentRole
```

#### `AgentBuilder`
Configure individual agents.

```typescript
AgentBuilder.create()
  .withId(id: string)
  .withName(name: string)
  .withRole(role: AgentRole)
  .withModel(model: AIModel)
  .canCommunicateWith(agentIds: string[])
  .withPriority(priority: number)
  .withInitialContext(context: Record<string, unknown>)
  .build(): AgentConfig
```

#### `StepBuilder`
Define workflow steps.

```typescript
StepBuilder.create()
  .withId(id: string)
  .withName(name: string)
  .withAgents(agentIds: string[])
  .withExecutionType(type: WorkflowStepExecutionType)
  .withInstructions(instructions: string)
  .withMaxIterations(max: number)
  .withCompletionCondition(condition: Function)
  .withCondition(condition: Function)
  .build(): WorkflowStep
```

#### `WorkflowConfigBuilder`
Build complete workflows.

```typescript
WorkflowConfigBuilder.create()
  .withId(id: string)
  .withName(name: string)
  .addAgent(agent: AgentConfig)
  .addAgents(agents: AgentConfig[])
  .addStep(step: WorkflowStep)
  .withGlobalContext(context: Record<string, unknown>)
  .onBeforeStep(handler: Function)
  .onAfterStep(handler: Function)
  .withFinalResultGenerator(generator: Function)
  .build(): WorkflowConfig
```

#### `DefaultWorkflowExecutor`
Execute workflows.

```typescript
const executor = new DefaultWorkflowExecutor(observer?: SocietyObserver);

await executor.execute(
  workflow: WorkflowConfig,
  input: string,
  signal?: AbortSignal
): Promise<WorkflowResult>
```

### Key Interfaces

```typescript
interface AgentRole {
  id: string;
  name: string;
  systemPrompt: string;
  capabilities?: string[];
  constraints?: string[];
  promptTemplate?: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  agentIds: string[];
  executionType: 'sequential' | 'parallel' | 'collaborative' | 'conditional';
  instructions?: string;
  maxIterations?: number;
  completionCondition?: (results: StepResult[], iteration: number) => boolean;
}

interface WorkflowResult {
  success: boolean;
  output: string;
  stepResults: Map<string, StepResult[]>;
  messages: AgentMessage[];
  duration: number;
  errors?: Error[];
}

interface StepResult {
  agentId: string;
  stepId: string;
  content: string;
  success: boolean;
  timestamp: number;
  error?: Error;
}
```

## 📘 Documentation

- [Getting Started Guide](./docs/getting-started.md) - Installation and first steps
- [Architecture Overview](./docs/architecture.md) - Core concepts and design
- [Workflow Patterns](./docs/workflows.md) - Common workflow configurations
- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Advanced Features](./docs/advanced.md) - Error handling, retry, observability
- [Migration Guide](./docs/migration.md) - Upgrading from legacy API
- [Examples](./docs/examples.md) - Real-world usage examples

## 💡 Examples

Check out the [examples](./examples) directory for complete working examples:

- **Basic Examples**: Simple societies, multi-model usage, observers
- **Roles & Agents**: Custom roles, agent capabilities, communication
- **Workflows**: Sequential, parallel, collaborative, conditional
- **Domain Examples**: Software teams, research teams, creative teams, business teams
- **Integrations**: OpenAI, Anthropic, custom APIs
- **Advanced**: Error handling, timeouts, lifecycle hooks, result transformers

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## 🏗️ Development

Build the project:

```bash
npm run build
```

Watch mode for development:

```bash
npm run watch
```

Lint code:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **Documentation**: [https://github.com/benoitpetit/societyai-package](https://github.com/benoitpetit/societyai-package)
- **npm Package**: [@societyai/core](https://www.npmjs.com/package/@societyai/core)
- **Examples**: [./examples](./examples)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)
- **Issues**: [GitHub Issues](https://github.com/benoitpetit/societyai/issues)

## 🙏 Acknowledgments

Built with TypeScript and designed for flexibility, extensibility, and developer experience.

## 📞 Support

- 📧 Email: [Create an issue](https://github.com/benoitpetit/societyai/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/benoitpetit/societyai/discussions)
- 📝 Documentation: [Full Documentation](./docs/)

---

**Made with ❤️ by the SocietyAI community**
