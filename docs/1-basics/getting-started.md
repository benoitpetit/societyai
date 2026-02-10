# Getting Started with SocietyAI

SocietyAI is a TypeScript library for orchestrating multi-agent systems using a DAG (Directed Acyclic Graph) approach.

## Installation

```bash
npm install societyai
```

## Basic Concepts

### 1. Agents
Agents are the workers in your society. They have:
- An **ID** and **Name**
- A **Role** (instructions on how to behave)
- An **AI Model** (the brain)

### 2. Tasks
A Task is a unit of work. It can be:
- **Sequential**: Run by one agent.
- **Parallel**: Run by multiple agents at the same time.
- **Collaborative**: Agents talking to each other.

### 3. Society (The Workflow)
The Society connects agents and tasks into a workflow.

## Your First Society

```typescript
import { Society, createRole, createAgent, AggregationStrategies } from 'societyai';
import { YourAIModel } from './your-model';

// 1. Define a Role
const writerRole = createRole('writer')
  .withSystemPrompt('You are a technical writer.');

// 2. Create the Society logic
const society = Society.create()
  .withId('blog-post-workflow')
  .addAgent(agent => agent
    .withId('writer')
    .withRole(writerRole)
    .withModel(new YourAIModel())
  )
  .addTask(task => task
    .withId('write-article')
    .withAgents(['writer'])
    .withInstructions('Write a blog post about AI.')
    .sequential()
  )
  .execute('Start');
```

## Advanced Graph Patterns

SocietyAI supports complex execution patterns using its graph-based engine.

### Cyclic Graphs with Self-Correction

Create self-improving agents that loop until they produce valid output:

```typescript
import { GraphBuilder, NodeType } from 'societyai';

// Create a self-correcting content generator
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('generate', NodeType.AGENT, { 
    agentId: 'generator' 
  })
  .addNode('validate', NodeType.AGENT, { 
    agentId: 'validator' 
  })
  .addNode('check', NodeType.CONDITION, {
    condition: (result) => result.includes('APPROVED')
  })
  .addNode('end', NodeType.END)
  
  // Define the validation loop
  .addEdge('start', 'generate')
  .addEdge('generate', 'validate')
  .addEdge('validate', 'check')
  .addEdge('check', 'end', { label: 'approved' })
  .addEdge('check', 'generate', { label: 'retry' })  // Loop back with feedback
  .build();

const result = await graph.execute('Generate secure code', agents);
```

### Recursive Societies with Hierarchical Communication

Build complex organizational structures where agents can communicate in a hierarchical manner:

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('team', NodeType.COLLABORATIVE, {
    agentIds: ['junior', 'senior', 'manager'],
    maxIterations: 5,
    // Custom message routing for hierarchy
    messageRouter: (message, sender, allAgents, context) => {
      // Juniors report to seniors
      if (sender.id === 'junior') return ['senior'];
      // Seniors escalate to manager
      if (sender.id === 'senior') return ['manager'];
      // Manager broadcasts decisions
      if (sender.id === 'manager') return ['junior', 'senior'];
      return [];
    },
    completionCondition: (results) => {
      return results.some(r => r.output.includes('DECISION'));
    }
  })
  .addNode('end', NodeType.END)
  .addEdge('start', 'team')
  .addEdge('team', 'end')
  .build();

const result = await graph.execute('Review architecture proposal', agents);
```

### Targeted Agent Communication with @mentions

Agents can address specific teammates using the `@agentId` syntax:

```typescript
// Agent implementation that uses targeted messaging
const consultantAgent = {
  id: 'consultant',
  model: {
    process: async (prompt) => {
      // Check expertise needed and route accordingly
      if (prompt.includes('security')) {
        return '@security-expert: Can you review this implementation?';
      }
      if (prompt.includes('performance')) {
        return '@perf-expert: Is this approach scalable?';
      }
      return 'Analyzing...';
    }
  }
};

// The execution engine automatically routes these messages
const result = await collaborativeGraph.execute(input, [
  consultantAgent,
  securityExpert,
  perfExpert
]);

// Check message routing in the result
result.messages.forEach(msg => {
  console.log(`[${msg.from} → ${msg.to || 'all'}]: ${msg.content}`);
});
```

### Parallel Processing with Aggregation

Execute multiple agents in parallel and aggregate their results:

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('parallel', NodeType.PARALLEL, {
    agentIds: ['analyst1', 'analyst2', 'analyst3']
  })
  .addNode('aggregate', NodeType.AGGREGATE, {
    aggregator: (results) => {
      // Combine insights from all analysts
      const insights = results.map(r => r.output).join('\n---\n');
      return `# Combined Analysis\n\n${insights}`;
    }
  })
  .addNode('end', NodeType.END)
  
  .addEdge('start', 'parallel')
  .addEdge('parallel', 'aggregate')
  .addEdge('aggregate', 'end')
  .build();

const result = await graph.execute('Analyze market trends', agents);
```

### Loop Controls with Maximum Iterations

Protect against infinite loops with built-in safeguards:

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('loop', NodeType.LOOP, {
    // Exit condition
    loopCondition: (iteration, result, context) => {
      return iteration < 10 && !result.includes('COMPLETE');
    },
    maxIterations: 10  // Hard limit
  })
  .addNode('process', NodeType.AGENT, { agentId: 'processor' })
  .addNode('end', NodeType.END)
  
  .addEdge('start', 'loop')
  .addEdge('loop', 'process')
  .addEdge('process', 'loop')  // Continue loop
  .addEdge('loop', 'end', { label: 'exit' })  // Exit when done
  .build();
```

---

## �准 Best Practices

### 1. **Start Simple, Then Expand**

```typescript
// ✅ Good: Start with sequential
Society.create()
  .addAgent(agent1)
  .addTask(s => s.withId('step1').withAgents(['agent1']).sequential())
  .execute(input);

// Then add complexity as needed
```

### 2. **Use Meaningful IDs**

```typescript
// ❌ Bad: Generic IDs
.addAgent(a => a.withId('agent1')...)

// ✅ Good: Descriptive IDs
.addAgent(a => a.withId('content-writer')...)
```

### 3. **Leverage Global Context**

```typescript
Society.create()
  .withGlobalContext({
    language: 'fr',
    tone: 'professional'
  })
  .addAgent(writerAgent)
  .execute(input);
```

---

## 🐛 Troubleshooting

### "Agent not found" Error

Use constants to avoid typos:
```typescript
const AGENTS = {
  WRITER: 'writer',
  EDITOR: 'editor'
} as const;

Society.create()
  .addAgent(a => a.withId(AGENTS.WRITER)...)
  .addTask(s => s.withAgents([AGENTS.WRITER]))
```

### Steps Not Connecting

Enable implicit routing or define explicit nextTasks:
```typescript
// Option 1: Implicit
Society.create()
  .withStrictRouting(false)
  .addTask(s => s.withId('step1')...)
  .addTask(s => s.withId('step2')...)

// Option 2: Explicit routing
.addTask(s => s
  .withId('step1')
  .withNextSteps(['step2'])  // or .thenGoto(['step2'])
)
```

---

## Next Steps

- Explore [Architecture Documentation](../5-architecture/execution-engine.md) for deep dive into the execution engine
- Check [Core Concepts](./core-concepts.md) for Society and Workflow details
- Learn about [Custom Tools](../3-capabilities/tools-functions.md) and [Middleware](../4-advanced/middleware.md)


