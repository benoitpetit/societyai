# Getting Started with SocietyAI

Welcome to SocietyAI! This guide will help you get up and running with creating your first multi-agent AI system.

## Table of Contents

- [Installation](#installation)
- [Prerequisites](#prerequisites)
- [Your First Society](#your-first-society)
- [Understanding the Basics](#understanding-the-basics)
- [Next Steps](#next-steps)

## Installation

Install SocietyAI via npm:

```bash
npm install @societyai/core
```

Or using yarn:

```bash
yarn add @societyai/core
```

Or using pnpm:

```bash
pnpm add @societyai/core
```

## Prerequisites

### TypeScript Configuration

SocietyAI is written in TypeScript and provides full type definitions. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "esModuleInterop": true,
    "strict": true
  }
}
```

### AI Model Access

You'll need access to at least one AI model API:

- **OpenAI**: Get an API key from [OpenAI Platform](https://platform.openai.com/)
- **Anthropic**: Get an API key from [Anthropic Console](https://console.anthropic.com/)
- **Google AI**: Get an API key from [Google AI Studio](https://makersuite.google.com/)
- **Local Models**: Use Ollama, LM Studio, or similar
- **Custom API**: Any HTTP API that accepts prompts and returns text

## Your First Society

Let's create a simple two-agent system where one agent analyzes data and another reviews the analysis.

### Step 1: Create Your AI Model

First, create a model that connects to your AI service:

```typescript
import { StandardModelBase } from '@societyai/core';
import OpenAI from 'openai';

class OpenAIModel extends StandardModelBase {
  private client: OpenAI;

  constructor(apiKey: string) {
    const client = new OpenAI({ apiKey });

    super({ name: 'gpt-4-turbo' }, async (prompt) => {
      const response = await client.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: String(prompt) }],
      });
      return response.choices[0].message.content || '';
    });

    this.client = client;
  }
}

// Create an instance
const model = new OpenAIModel(process.env.OPENAI_API_KEY!);
```

### Step 2: Define Agent Roles

Create roles that define how agents behave:

```typescript
import { RoleBuilder } from '@societyai/core';

// Analyst role
const analystRole = RoleBuilder.create()
  .withId('analyst')
  .withName('Data Analyst')
  .withSystemPrompt(
    'You are a data analyst. Your job is to examine information ' +
      'objectively, identify patterns, and provide clear insights. ' +
      'Focus on facts and data-driven conclusions.'
  )
  .withCapabilities(['data-analysis', 'pattern-recognition', 'statistics'])
  .build();

// Reviewer role
const reviewerRole = RoleBuilder.create()
  .withId('reviewer')
  .withName('Critical Reviewer')
  .withSystemPrompt(
    'You are a critical reviewer. Your job is to challenge assumptions, ' +
      'identify potential issues, and ensure quality. ' +
      'Be thorough and constructive in your feedback.'
  )
  .withCapabilities(['critical-thinking', 'quality-assurance'])
  .build();
```

### Step 3: Create Agents

Build agents by combining roles with models:

```typescript
import { AgentBuilder } from '@societyai/core';

const agents = [
  AgentBuilder.create().withId('analyst-1').withRole(analystRole).withModel(model).build(),

  AgentBuilder.create().withId('reviewer-1').withRole(reviewerRole).withModel(model).build(),
];
```

### Step 4: Define Workflow Steps

Create steps that define what agents do:

```typescript
import { StepBuilder } from '@societyai/core';

const steps = [
  // Step 1: Analysis
  StepBuilder.create()
    .withId('analysis')
    .withName('Data Analysis')
    .withAgents(['analyst-1'])
    .withExecutionType('sequential')
    .withInstructions(
      'Analyze the provided data thoroughly. ' + 'Identify key patterns, trends, and insights.'
    )
    .build(),

  // Step 2: Review
  StepBuilder.create()
    .withId('review')
    .withName('Quality Review')
    .withAgents(['reviewer-1'])
    .withExecutionType('sequential')
    .withInstructions(
      'Review the analysis provided. ' +
        'Check for accuracy, completeness, and potential issues. ' +
        'Provide constructive feedback.'
    )
    .build(),
];
```

### Step 5: Build the Workflow

Combine everything into a workflow:

```typescript
import { WorkflowConfigBuilder } from '@societyai/core';

const workflow = WorkflowConfigBuilder.create()
  .withId('analysis-workflow')
  .withName('Data Analysis & Review Workflow')
  .withDescription('Two-stage workflow with analysis and review')
  .addAgents(agents)
  .addSteps(steps)
  .build();
```

### Step 6: Execute

Run the workflow:

```typescript
import { DefaultWorkflowExecutor } from '@societyai/core';

async function main() {
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(
    workflow,
    'Analyze the sales data from Q4 2024. ' +
      'Sales increased by 15% year-over-year, ' +
      'with the highest growth in the APAC region (+25%).'
  );

  console.log('Workflow completed!');
  console.log('Duration:', result.duration, 'ms');
  console.log('\nFinal Output:');
  console.log(result.output);
}

main().catch(console.error);
```

### Complete Example

Here's the complete code:

```typescript
import {
  StandardModelBase,
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
} from '@societyai/core';
import OpenAI from 'openai';

// 1. Create AI Model
class OpenAIModel extends StandardModelBase {
  private client: OpenAI;

  constructor(apiKey: string) {
    const client = new OpenAI({ apiKey });
    super({ name: 'gpt-4-turbo' }, async (prompt) => {
      const response = await client.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: String(prompt) }],
      });
      return response.choices[0].message.content || '';
    });
    this.client = client;
  }
}

// 2. Define Roles
const analystRole = RoleBuilder.create()
  .withId('analyst')
  .withName('Data Analyst')
  .withSystemPrompt('You are a data analyst. Examine information objectively.')
  .build();

const reviewerRole = RoleBuilder.create()
  .withId('reviewer')
  .withName('Critical Reviewer')
  .withSystemPrompt('You are a critical reviewer. Challenge assumptions.')
  .build();

// 3. Create Agents
const model = new OpenAIModel(process.env.OPENAI_API_KEY!);

const agents = [
  AgentBuilder.create().withId('analyst-1').withRole(analystRole).withModel(model).build(),
  AgentBuilder.create().withId('reviewer-1').withRole(reviewerRole).withModel(model).build(),
];

// 4. Define Steps
const steps = [
  StepBuilder.create()
    .withId('analysis')
    .withAgents(['analyst-1'])
    .withExecutionType('sequential')
    .withInstructions('Analyze the data thoroughly.')
    .build(),
  StepBuilder.create()
    .withId('review')
    .withAgents(['reviewer-1'])
    .withExecutionType('sequential')
    .withInstructions('Review the analysis.')
    .build(),
];

// 5. Build Workflow
const workflow = WorkflowConfigBuilder.create()
  .withId('analysis-workflow')
  .withName('Analysis & Review')
  .addAgents(agents)
  .addSteps(steps)
  .build();

// 6. Execute
async function main() {
  const executor = new DefaultWorkflowExecutor();
  const result = await executor.execute(workflow, 'Your input here');
  console.log(result.output);
}

main().catch(console.error);
```

## Understanding the Basics

### The Five Core Components

1. **AIModel**: Interface to your AI service (OpenAI, Anthropic, etc.)
2. **AgentRole**: Defines behavior, capabilities, and system prompt
3. **AgentConfig**: Combines a role with a model to create an agent
4. **WorkflowStep**: Defines what agents do and how (sequential, parallel, etc.)
5. **WorkflowConfig**: Orchestrates agents and steps into a complete workflow

### Execution Flow

```
Input → Workflow Executor
         ↓
    Step 1 (Sequential)
         ↓
    Agent 1 → AI Model → Result 1
         ↓
    Step 2 (Sequential)
         ↓
    Agent 2 → AI Model → Result 2
         ↓
    Final Output
```

### Key Concepts

**Sequential Execution**: Agents run one after another. Each agent can access results from previous agents.

```typescript
.withExecutionType('sequential')
```

**Parallel Execution**: Multiple agents run simultaneously for faster processing.

```typescript
.withExecutionType('parallel')
```

**Collaborative Execution**: Agents exchange messages and iterate together.

```typescript
.withExecutionType('collaborative')
.withMaxIterations(3)
```

**Conditional Execution**: Steps execute only when conditions are met.

```typescript
.withExecutionType('conditional')
.withCondition((previousResults) => someCondition(previousResults))
```

## Next Steps

Now that you've created your first society, explore more advanced features:

1. **[Architecture Guide](./architecture.md)** - Understand the design and concepts
2. **[Workflow Patterns](./workflows.md)** - Learn common workflow configurations
3. **[API Reference](./api-reference.md)** - Explore all available methods
4. **[Advanced Features](./advanced.md)** - Error handling, retry, observability
5. **[Examples](./examples.md)** - See real-world usage patterns

### Quick Examples

**Parallel Analysis**:

```typescript
StepBuilder.create()
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('parallel') // All agents work simultaneously
  .build();
```

**Collaborative Discussion**:

```typescript
StepBuilder.create()
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('collaborative')
  .withMaxIterations(3)
  .withCompletionCondition((results, iteration) => {
    return iteration >= 2 || consensusReached(results);
  })
  .build();
```

**Custom Result Generation**:

```typescript
WorkflowConfigBuilder.create()
  .withFinalResultGenerator(async (stepResults, context) => {
    // Your custom logic to combine results
    return customFormattedOutput;
  })
  .build();
```

## Common Issues

### Issue: "Cannot find module '@societyai/core'"

**Solution**: Make sure you've installed the package:

```bash
npm install @societyai/core
```

### Issue: API Key Errors

**Solution**: Set your API key as an environment variable:

```bash
export OPENAI_API_KEY="your-key-here"
# or
export ANTHROPIC_API_KEY="your-key-here"
```

### Issue: TypeScript Errors

**Solution**: Ensure your TypeScript configuration is compatible (see [Prerequisites](#typescript-configuration))

## Getting Help

- **Documentation**: [Full docs](../README.md)
- **Examples**: [Example code](../examples/)
- **Issues**: [GitHub Issues](https://github.com/benoitpetit/societyai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/benoitpetit/societyai/discussions)

---

**Next**: [Architecture Overview](./architecture.md) →
