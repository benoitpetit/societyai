# Getting Started with SocietyAI

SocietyAI is a TypeScript library for orchestrating multi-agent systems using a
graph-based execution engine (DAGs and Cycles).

## Installation

```bash
npm install societyai
```

## Quick Start with CLI

SocietyAI includes a powerful CLI for rapid development:

```bash
# Create a new project
npx societyai init --template basic --output ./my-project --name my-society
cd my-project
npm install

# Validate your configuration
npx societyai validate ./society.ts

# Generate visualization
npx societyai visualize ./society.ts --format html --output graph.html

# Run your society
npx societyai run ./society.ts --input "Hello World" --verbose --metrics
```

## Basic Concepts

### 1. Agents

Agents are the workers in your society. Each agent has:

- An **ID** — unique identifier
- A **Role** — its "job description" (system prompt, name)
- An **AI Model** — the LLM backing it (you provide the adapter)
- An **Execution Mode** — `inline` (default) or `isolated` (worker thread)

### 2. Tasks

A Task is a unit of work assigned to one or more agents:

- **Sequential** — one agent runs, its output feeds the next task
- **Parallel** — multiple agents run simultaneously on the same input
- **Collaborative** — agents exchange messages across multiple rounds
- **Human** — execution pauses and waits for human input

### 3. Society (The Workflow)

The `Society` connects agents and tasks into an executable workflow through the
fluent builder API.

---

## Your First Society

```typescript
import { Society } from 'societyai';
import { ModelAdapters } from 'societyai/adapters';

// Use built-in adapter (OpenAI example)
const model = ModelAdapters.openai({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

// Or use MockModel for testing
// import { MockModel } from 'societyai/adapters';
// const model = new MockModel();

const result = await Society.create()
  .withId('blog-post-workflow')

  // Add agents
  .addAgent((a) =>
    a
      .withId('writer')
      .withRole((r) =>
        r
          .withName('Technical Writer')
          .withSystemPrompt('You write clear, concise technical documentation.')
      )
      .withModel(model)
  )
  .addAgent((a) =>
    a
      .withId('editor')
      .withRole((r) =>
        r
          .withName('Editor')
          .withSystemPrompt('You review text for style, grammar, and clarity.')
      )
      .withModel(model)
  )

  // Add tasks — explicit dependency wiring
  .addTask((t) =>
    t
      .withId('write-article')
      .withAgents(['writer'])
      .withInstructions('Write a blog post about the benefits of TypeScript.')
      .sequential()
  )
  .addTask((t) =>
    t
      .withId('review-article')
      .dependsOn('write-article') // runs after write-article completes
      .withAgents(['editor'])
      .withInstructions('Review the draft, correct mistakes, and improve the tone.')
      .sequential()
  )

  .execute('Start');

console.log('Final output:', result.output);
console.log('Per-task results:', result.taskResults);
```

---

## Using Worker Threads

For CPU-intensive agents, use isolated execution mode with built-in adapters:

```typescript
import { Society } from 'societyai';
import { ModelAdapters } from 'societyai/adapters';

const model = ModelAdapters.openai({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

const result = await Society.create()
  .addAgent((a) =>
    a
      .withId('analyzer')
      .withRole((r) =>
        r.withSystemPrompt('You analyze complex data structures.')
      )
      .withModel(model)
      .withExecutionMode('isolated') // ← Runs in worker thread
  )
  .addTask((t) =>
    t.withId('analyze').withAgents(['analyzer']).sequential()
  )
  .execute('Analyze this dataset');
```

Available adapters: `openai`, `anthropic`, `gemini`, `azureOpenAI`, `ollama`, `mock`.

---

## Advanced Graph Patterns (Low-Level API)

The high-level `Society` builder covers most use cases. For full graph control —
cycles, custom node types, complex aggregations — use `GraphBuilder` directly.

### Self-Correction Loop

Create a validate-and-retry feedback cycle:

```typescript
import { GraphBuilder, NodeType } from 'societyai/advanced';

const engine = GraphBuilder.create()
  .addNode('start',    NodeType.START)
  .addNode('generate', NodeType.AGENT,     { agentId: 'generator' })
  .addNode('validate', NodeType.AGENT,     { agentId: 'validator' })
  .addNode('check',    NodeType.CONDITION, {
    condition: (result: string) => result.includes('APPROVED'),
  })
  .addNode('end', NodeType.END)

  .addEdge('start',    'generate')
  .addEdge('generate', 'validate')
  .addEdge('validate', 'check')
  // Conditional branch: true → end, false → loop back
  .addConditionalEdge({
    from:      'check',
    condition: (result: string) => result.includes('APPROVED'),
    truePath:  'end',
    falsePath: 'generate', // retry
  })
  .build();

const result = await engine.execute({
  input: 'Generate secure code',
  agents: [generatorAgent, validatorAgent]
});
```

### Parallel Processing

Execute multiple agents in parallel, then aggregate their results:

```typescript
import { GraphBuilder, NodeType } from 'societyai/advanced';

const engine = GraphBuilder.create()
  .addNode('start',     NodeType.START)
  .addNode('parallel',  NodeType.PARALLEL,  { agentIds: ['analyst1', 'analyst2', 'analyst3'] })
  .addNode('aggregate', NodeType.AGGREGATE, {
    aggregator: (results) => {
      const insights = results.map((r) => r.output).join('\n---\n');
      return `# Combined Analysis\n\n${insights}`;
    },
  })
  .addNode('end', NodeType.END)

  .addEdge('start',     'parallel')
  .addEdge('parallel',  'aggregate')
  .addEdge('aggregate', 'end')
  .build();

const result = await engine.execute({
  input: 'Analyze market trends',
  agents: [analyst1, analyst2, analyst3]
});
```

### Visualize Your Graph

Export your graph to multiple formats:

```typescript
import { GraphVisualizer } from 'societyai/advanced';

// Generate Mermaid diagram
const mermaid = engine.toMermaid();
console.log(mermaid);

// Or use the CLI
// npx societyai visualize ./my-society.ts --format mermaid

// Available formats: mermaid, dot, json, html, ascii, plantuml
const dot = GraphVisualizer.toDOT(engine);
const html = GraphVisualizer.toHTML(engine, { theme: 'dark' });
```

---

## Memory with Automatic Persistence

Persist memory across sessions:

```typescript
import { MemoryBuilder } from 'societyai/memory';
import { FileStorageAdapter } from 'societyai/advanced';

const memory = MemoryBuilder.create()
  .withPersistence({
    adapter: new FileStorageAdapter('./memory'),
    autoSaveInterval: 60000, // Save every minute
    namespace: 'my-agent',
    loadOnInit: true,
  })
  .build();

// Use in your agent
Society.create()
  .addAgent((a) =>
    a
      .withId('assistant')
      .withModel(model)
      .withMemory(memory)
  )
  .execute('Hello');

// Cleanup on exit
process.on('SIGINT', async () => {
  await memory.dispose();
  process.exit(0);
});
```

---

## Streaming Responses

Stream responses with middleware support:

```typescript
import { MiddlewareChain, StreamMiddlewares } from 'societyai';

const chain = MiddlewareChain.create()
  .use(StreamMiddlewares.logChunks({ prefix: '[Agent]' }))
  .use(StreamMiddlewares.transformChunk((chunk) => chunk.toUpperCase()));

const wrappedModel = chain.wrap(model);

// Stream the response
for await (const chunk of wrappedModel.stream('Hello')) {
  process.stdout.write(chunk);
}
```

---

## Best Practices

### 1. Start Simple, Then Expand

```typescript
// ✅ Start with sequential tasks
await Society.create()
  .addAgent((a) => a.withId('agent1').withModel(model).withRole(role1))
  .addTask((t) => t.withId('step1').withAgents(['agent1']).sequential())
  .execute(input);

// Then add more agents and dependencies as needed
```

### 2. Use Meaningful IDs

```typescript
// ❌ Generic IDs make debugging hard
.addAgent((a) => a.withId('agent1')...)

// ✅ Descriptive IDs are self-documenting
.addAgent((a) => a.withId('content-writer')...)
```

### 3. Use Constants to Avoid Typos

```typescript
const AGENTS = {
  WRITER: 'content-writer',
  EDITOR: 'editor',
} as const;

Society.create()
  .addAgent((a) => a.withId(AGENTS.WRITER)...)
  .addTask((t) => t.withAgents([AGENTS.WRITER])...)
```

### 4. Leverage Global Context

```typescript
Society.create()
  .withGlobalContext({ language: 'fr', tone: 'professional' })
  .addAgent(writerAgent)
  .execute(input);
```

### 5. Validate Before Running

```bash
# Always validate your configuration
npx societyai validate ./my-society.ts

# Check for agent reference errors, missing dependencies, etc.
```

---

## Troubleshooting

### "Agent not found" Error

The agent ID in `.withAgents([...])` does not match any `.addAgent()` call.
Use the constants pattern above to prevent typos.

### Tasks Not Running in the Expected Order

Use `.dependsOn()` to declare explicit ordering:

```typescript
.addTask((t) => t.withId('step1').withAgents(['writer']).sequential())
.addTask((t) =>
  t
    .withId('step2')
    .dependsOn('step1') // ← explicit dependency
    .withAgents(['editor'])
    .sequential()
)
```

### Worker Thread Errors

If you encounter issues with isolated execution:

1. Ensure your model adapter is serializable
2. Use built-in adapters from `societyai/adapters`
3. Check that `ts-node` is installed for TypeScript files

```bash
npm install --save-dev ts-node
```

---

## 📚 Next Steps

- [Core Concepts](./core-concepts.md) — Society, agents, tasks, and the execution graph
- [Society Builder](../2-building-societies/society-builder.md) — Full fluent API reference
- [Execution Engine](../5-architecture/execution-engine.md) — Deep dive into the DAG engine
- [Tools & Functions](../3-capabilities/tools-functions.md) — Give agents real-world capabilities
- [Middleware](../4-advanced/middleware.md) — Cross-cutting concerns (logging, retry, cache, streaming)
- [CLI Reference](../reference/cli.md) — Complete CLI documentation
