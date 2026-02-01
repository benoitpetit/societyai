# Examples Index

This document provides an overview of all examples in the `examples/` directory and references to comprehensive feature guides.

## Overview

The examples demonstrate various SocietyAI features from basic usage to advanced patterns. Each example is fully functional and includes detailed comments.

## Available Examples

### Graph Workflow (`graph-workflow.ts`)

**Description**: Demonstrates graph-based execution with DAG and cyclic workflows  
**Features**:

- START, END, AGENT, PARALLEL, CONDITION nodes
- Conditional branching based on runtime conditions
- Parallel execution of multiple agents
- Cyclic graphs with loop detection

**Related guide**: [Graph Execution](./graph-execution.md)

```bash
npx ts-node examples/graph-workflow.ts
```

### Tool Calling (`tool-calling.ts`)

**Description**: Shows how to give agents access to external tools  
**Features**:

- Tool definition with ToolBuilder
- ToolRegistry for managing multiple tools
- Parameter validation with JSON Schema
- Built-in tools (calculator, string manipulation)
- Agent-tool interaction loop

**Related guide**: [Tool Calling](./tool-calling.md)

```bash
npx ts-node examples/tool-calling.ts
```

### Memory System (`memory-system.ts`)

**Description**: Demonstrates multi-level memory management  
**Features**:

- ShortTermMemory with decay and auto-summarization
- LongTermMemory with RAG integration
- EntityMemory for tracking facts
- Memory importance scoring
- Pruning strategies (LRU, importance-based, FIFO)

**Related guide**: [Memory System](./memory-system.md)

```bash
npx ts-node examples/memory-system.ts
```

### Structured Output (`structured-output.ts`)

**Description**: Validates AI outputs against JSON schemas  
**Features**:

- JSON Schema validation
- Automatic retry with error feedback
- Complex schema support (nested objects, arrays)
- Schema definition helpers
- Markdown code block extraction

**Related guide**: [Structured Output](./structured-output.md)

```bash
npx ts-node examples/structured-output.ts
```

### Metrics Tracking (`metrics-tracking.ts`)

**Description**: Tracks performance, tokens, and costs  
**Features**:

- MetricsTracker for workflow metrics
- TokenCounter for cost estimation
- Cost configuration for major AI models
- Custom metrics tracking
- OpenTelemetry export

**Related guide**: [Metrics & Observability](./metrics-observability.md)

```bash
npx ts-node examples/metrics-tracking.ts
```

### Complete Integration (`complete-integration.ts`)

**Description**: Full-featured example combining all systems  
**Features**:

- Graph-based workflow
- Tool calling integration
- Memory system integration
- Structured output validation
- Metrics tracking
- End-to-end multi-agent system

**Related guides**: All feature guides

```bash
npx ts-node examples/complete-integration.ts
```

## Running Examples

### Prerequisites

Install dependencies:

```bash
npm install
```

Set up environment variables (if using real AI models):

```bash
export OPENAI_API_KEY="your-key-here"
# or
export ANTHROPIC_API_KEY="your-key-here"
```

### Run Specific Example

```bash
npx ts-node examples/<example-name>.ts
```

### Run All Examples

```bash
npm run examples
```

## Feature Guides

For comprehensive documentation on each feature:

- **[Graph Execution](./graph-execution.md)**: DAG/Cyclic workflows, node types, conditional branching
- **[Tool Calling](./tool-calling.md)**: Tool definition, registry, executor, parameter validation
- **[Memory System](./memory-system.md)**: Short-term, long-term, entity memory, RAG integration
- **[Structured Output](./structured-output.md)**: JSON Schema validation, automatic retry
- **[Metrics & Observability](./metrics-observability.md)**: Performance tracking, cost calculation

## Example Categories

### Basic Usage

Perfect for getting started:

- `graph-workflow.ts` - Basic graph patterns
- `tool-calling.ts` - Simple tool integration
- `structured-output.ts` - Output validation

### Advanced Patterns

For production systems:

- `memory-system.ts` - Context management
- `metrics-tracking.ts` - Observability
- `complete-integration.ts` - Full system integration

## Code Snippets

### Quick Graph Example

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent1', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent1')
  .addEdge('agent1', 'end')
  .build();

const result = await graph.execute('Analyze data', agents);
```

### Quick Tool Example

```typescript
import { ToolBuilder, ToolRegistry } from 'societyai';

const tool = ToolBuilder.create()
  .withName('add')
  .withDescription('Add two numbers')
  .withParameter('a', 'number', 'First number', true)
  .withParameter('b', 'number', 'Second number', true)
  .withExecutor(async ({ a, b }) => a + b)
  .build();

const registry = new ToolRegistry();
registry.register(tool);
```

### Quick Memory Example

```typescript
import { MemoryBuilder } from 'societyai';

const memory = MemoryBuilder.create()
  .withShortTermMemory({ maxSize: 10 })
  .withLongTermMemory({ maxSize: 100 })
  .build();

await memory.addShortTerm('Important context', 0.9);
```

## Troubleshooting

### TypeScript Errors

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true
  }
}
```

### Module Not Found

Install dependencies:

```bash
npm install
```

### Examples Not Working

Make sure you have:

1. Installed dependencies (`npm install`)
2. Built the project (`npm run build`)
3. Set environment variables (if using real AI models)

## Next Steps

- Read the [Getting Started Guide](./getting-started.md)
- Explore [Architecture Overview](./architecture.md)
- Check [API Reference](./api-reference.md)
- Review [Best Practices](./workflows.md)

---

**Questions?** Open an issue on [GitHub](https://github.com/benoitpetit/societyai-package/issues)**When to use**: Collaborative workflows, information sharing

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
3. - Build workflows

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
} from 'societyai';

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
