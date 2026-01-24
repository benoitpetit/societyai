# Examples Index

> **Note**: SocietyAI is currently pre-release (`0.0.1`). The `examples/` directory is empty for now.
> This document describes the planned examples structure for future reference.

## Overview

The examples will be organized by complexity and use case. Start with basic examples and progress to advanced patterns.

## Planned Directory Structure

```
examples/
├── 01-basic/              # Simple usage patterns
├── 02-roles-and-agents/   # Custom roles and agent configuration
├── 03-workflows/          # Workflow patterns
├── 04-domains/            # Domain-specific examples
├── 05-integrations/       # AI service integrations
└── 06-advanced/           # Advanced features
```

---

## Planned Examples

The sections below describe examples that will be added progressively.

### 01-basic/ - Simple Usage Patterns

#### simple-society.ts

**Description**: The simplest way to use SocietyAI with the fluent builder API  
**Covers**:

- Standard mode (multiple agents, same prompt)
- Collaborative mode (agents discuss together)
- Custom perspectives
- Simulated AI model

**When to use**: Quick prototyping, simple use cases, learning the basics

### multi-model.ts

**Description**: Using multiple different AI models together  
**Covers**:

- Multi-model configuration
- Model switching
- Heterogeneous agent teams

**When to use**: Combining different AI services, leveraging model strengths

### with-observer.ts

**Description**: Monitoring execution with observers  
**Covers**:

- Observer pattern
- Lifecycle hooks
- Logging and metrics
- Progress tracking

**When to use**: Production deployments, debugging, monitoring

## 02-roles-and-agents/ - Custom Roles

### custom-roles.ts

**Description**: Defining custom agent roles with specific behaviors  
**Covers**:

- RoleBuilder API
- System prompts
- Capabilities and constraints
- Role templates

**When to use**: Creating specialized agents, domain-specific behaviors

### agent-capabilities.ts

**Description**: Advanced agent configuration  
**Covers**:

- Agent priorities
- Initial context
- Retry configuration
- Agent metadata

**When to use**: Fine-tuning agent behavior, performance optimization

### agent-communication.ts

**Description**: Inter-agent communication  
**Covers**:

- MessageBus
- Agent-to-agent messaging
- Communication restrictions
- Message history

**When to use**: Collaborative workflows, information sharing

## 03-workflows/ - Workflow Patterns

### 

**Description**: Step-by-step processing pipeline  
**Covers**:

- Sequential execution
- Data flow between steps
- Pipeline patterns

**When to use**: Dependent tasks, progressive refinement, quality review

### 

**Description**: Concurrent agent execution  
**Covers**:

- Parallel execution
- Worker pools
- Result aggregation

**When to use**: Independent tasks, speed optimization, multiple perspectives

### 

**Description**: Agents discussing and iterating together  
**Covers**:

- Collaborative execution
- Multiple iterations
- Completion conditions
- Consensus building

**When to use**: Discussions, debates, iterative refinement

### 

**Description**: Dynamic workflows with branching logic  
**Covers**:

- Conditional execution
- Dynamic routing
- Step conditions
- Error recovery

**When to use**: Error handling, optimization, adaptive workflows

## 04-domains/ - Domain-Specific Examples

### 

**Description**: Software development team workflow  
**Covers**:

- Project manager role
- Developer roles
- QA testing
- Code review process

**Roles**: Project Manager, Architect, Developers, QA Tester  
**Pattern**: Hierarchical with parallel development

### 

**Description**: Academic research workflow  
**Covers**:

- Literature review
- Statistical analysis
- Paper writing
- Peer review

**Roles**: Researchers, Statistician, Writer  
**Pattern**: Parallel research + synthesis

### 

**Description**: Content creation workflow  
**Covers**:

- Research
- Writing
- Editing
- Design

**Roles**: Researcher, Writer, Editor, Designer  
**Pattern**: Sequential with parallel polish

### 

**Description**: Business analysis workflow  
**Covers**:

- Market analysis
- Financial analysis
- Strategic planning
- Executive decision

**Roles**: Market Analyst, Financial Analyst, Strategist, Executive  
**Pattern**: Parallel analysis + synthesis

## 05-integrations/ - AI Service Integrations

### 

**Description**: OpenAI GPT models integration  
**Covers**:

- OpenAI API client
- Chat completions
- Streaming responses
- Error handling

**Models**: GPT-4, GPT-3.5-turbo

### 

**Description**: Anthropic Claude integration  
**Covers**:

- Anthropic API client
- Message formatting
- Claude-specific features

**Models**: Claude 3 Opus, Sonnet, Haiku

### 

**Description**: Custom AI API integration  
**Covers**:

- HTTP API wrapper
- Authentication
- Request/response formatting
- Rate limiting

**Use**: Local models, custom APIs, other AI services

## 06-advanced/ - Advanced Features

### 

**Description**: Comprehensive error handling  
**Covers**:

- Try-catch patterns
- Error types
- Retry logic
- Fallback strategies
- Error recovery steps

**When to use**: Production systems, reliability requirements

### 

**Description**: Timeout and cancellation patterns  
**Covers**:

- AbortController
- Timeouts
- User cancellation
- Graceful shutdown

**When to use**: Long-running operations, user-facing applications

### 

**Description**: Workflow lifecycle hooks  
**Covers**:

- onBeforeStep hooks
- onAfterStep hooks
- Context manipulation
- Dynamic workflow modification

**When to use**: Logging, metrics, dynamic behavior

### 

**Description**: Custom result processing  
**Covers**:

- Result transformers
- Data normalization
- Custom output generation
- Aggregation patterns

**When to use**: Custom output formats, data processing

## Running Examples

### Prerequisites

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
```

3. Build the library:

```bash
npm run build
```

### Run an Example

```bash
# Using ts-node
npx ts-node examples/01-basic/simple-society.ts

# Or compile and run
npm run build
node dist/examples/01-basic/simple-society.js
```

## Learning Path

### Beginner

1. simple-society.ts - Understand basics
2. custom-roles.ts - Create roles
3.  - Build workflows

### Intermediate

1.  - Optimize with parallelism
2.  - Agent discussions
3.  - Complete use case

### Advanced

1.  - Production-ready code
2.  - Advanced patterns
3.  - Dynamic routing

## Example Code Snippets

### Quick Start

```typescript
import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
} from '@societyai/core';

// See examples/01-basic/simple-society.ts
```

### Custom Role

```typescript
const role = RoleBuilder.create().withId('analyst').withSystemPrompt('You analyze data.').build();

// See examples/02-roles-and-agents/custom-roles.ts
```

### Parallel Execution

```typescript
const step = StepBuilder.create()
  .withAgents(['agent-1', 'agent-2'])
  .withExecutionType('parallel')
  .build();

// See examples/03-workflows/parallel-workflow.ts
```

### Error Handling

```typescript
try {
  const result = await executor.execute(workflow, input);
} catch (error) {
  if (error instanceof ProcessingFailedError) {
    // Handle error
  }
}

// Examples are being added progressively in `examples/`.
```

## Contributing Examples

We welcome example contributions! Please:

1. Follow the existing structure
2. Include clear comments
3. Add to this index
4. Test your example
5. Submit a pull request

## Further Reading

- [Getting Started Guide](./getting-started.md)
- [Architecture Overview](./architecture.md)
- [Workflow Patterns](./workflows.md)
- [API Reference](./api-reference.md)
- [Advanced Features](./advanced.md)

---

**Previous**: [Migration Guide](./migration.md) ←
