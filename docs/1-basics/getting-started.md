# Getting Started with SocietyAI

SocietyAI is a TypeScript library for orchestrating multi-agent systems using a
graph-based execution engine (DAGs and Cycles).

## Installation

```bash
npm install societyai
```

## Basic Concepts

### 1. Agents

Agents are the workers in your society. Each agent has:

- An **ID** — unique identifier
- A **Role** — its "job description" (system prompt, name)
- An **AI Model** — the LLM backing it (you provide the adapter)

### 2. Tasks

A Task is a unit of work assigned to one or more agents:

- **Sequential** — one agent runs, its output feeds the next task
- **Parallel** — multiple agents run simultaneously on the same input
- **Collaborative** — agents exchange messages across multiple rounds

### 3. Society (The Workflow)

The `Society` connects agents and tasks into an executable workflow through the
fluent builder API.

---

## Your First Society

```typescript
import { Society, createRole } from 'societyai';
import { YourAIModel } from './your-model'; // your AIModel implementation

const model = new YourAIModel();

// Define reusable roles
const writerRole = createRole('writer')
  .withName('Technical Writer')
  .withSystemPrompt('You are a technical writer. Write clearly and concisely.');

const editorRole = createRole('editor')
  .withName('Editor')
  .withSystemPrompt('You review text for style, grammar, and clarity.');

const result = await Society.create()
  .withId('blog-post-workflow')

  // Add agents
  .addAgent((a) =>
    a.withId('writer').withRole(writerRole).withModel(model)
  )
  .addAgent((a) =>
    a.withId('editor').withRole(editorRole).withModel(model)
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

## Advanced Graph Patterns (Low-Level API)

The high-level `Society` builder covers most use cases. For full graph control —
cycles, custom node types, complex aggregations — use `GraphBuilder` directly.

### Self-Correction Loop

Create a validate-and-retry feedback cycle:

```typescript
import { GraphBuilder, NodeType } from 'societyai';

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

const result = await engine.execute('Generate secure code', agents);
```

### Parallel Processing

Execute multiple agents in parallel, then aggregate their results:

```typescript
import { GraphBuilder, NodeType } from 'societyai';

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

const result = await engine.execute('Analyze market trends', agents);
```

### Collaborative Node (Agents Debating)

Agents exchange messages across multiple rounds until a condition is met:

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const engine = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('debate', NodeType.COLLABORATIVE, {
    agentIds: ['junior', 'senior', 'manager'],
    maxIterations: 5,
    messageRouter: (message, sender) => {
      // Juniors report to seniors, seniors escalate to manager
      if (sender.id === 'junior')  return ['senior'];
      if (sender.id === 'senior')  return ['manager'];
      if (sender.id === 'manager') return ['junior', 'senior'];
      return [];
    },
    completionCondition: (results) =>
      results.some((r) => r.output.includes('DECISION')),
  })
  .addNode('end', NodeType.END)

  .addEdge('start',  'debate')
  .addEdge('debate', 'end')
  .build();

const result = await engine.execute('Review architecture proposal', agents);
```

### Iterative Loop with Max Iterations

Repeat a step until a condition is met or a hard cap is reached:

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const engine = GraphBuilder.create()
  .addNode('start',   NodeType.START)
  .addNode('process', NodeType.AGENT, { agentId: 'processor' })
  .addNode('loop',    NodeType.LOOP,  {
    maxIterations: 10,
    loopCondition: (iteration: number, result: string) =>
      iteration < 10 && !result.includes('COMPLETE'),
  })
  .addNode('end', NodeType.END)

  .addEdge('start',   'process')
  .addEdge('process', 'loop')
  .addEdge('loop',    'process') // continue loop
  .addConditionalEdge({
    from:      'loop',
    condition: (_result, ctx) => (ctx.iterationCount ?? 0) >= 10,
    truePath:  'end',
    falsePath: 'process',
  })
  .build();
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

Or use `.thenGoto()` on the preceding task:

```typescript
.addTask((t) =>
  t.withId('step1').withAgents(['writer']).sequential().thenGoto('step2')
)
.addTask((t) => t.withId('step2').withAgents(['editor']).sequential())
```

### Conditional Routing Not Triggering

Prefer the explicit `.withConditionalNext()` or `.withBranch()` helpers on
`FluentTaskBuilder` rather than the low-level `GraphBuilder` `CONDITION` node
when using the high-level API:

```typescript
.addTask((t) =>
  t
    .withId('validate')
    .withAgents(['validator'])
    .sequential()
    .withConditionalNext(
      (results) => results.get('validate')?.[0].output.includes('APPROVED') ?? false,
      'deploy',     // next task if true
      'fix-issues'  // next task if false
    )
)
```

---

## 📚 Next Steps

- [Core Concepts](./core-concepts.md) — Society, agents, tasks, and the execution graph
- [Society Builder](../2-building-societies/society-builder.md) — Full fluent API reference
- [Execution Engine](../5-architecture/execution-engine.md) — Deep dive into the DAG engine
- [Tools & Functions](../3-capabilities/tools-functions.md) — Give agents real-world capabilities
- [Middleware](../4-advanced/middleware.md) — Cross-cutting concerns (logging, retry, cache)