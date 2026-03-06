# Core Concepts

SocietyAI is built on a few fundamental concepts that map your "mental model" of
a team of people to a technical execution graph. Understanding these concepts
will help you design efficient workflows and choose the right API level for your
use case.

---

## 📋 Table of Contents

- [The Society](#1-the-society)
- [Agents & Roles](#2-agents--roles)
- [Tasks & Workflow](#3-tasks--workflow)
- [The Execution Graph](#4-the-execution-graph)
- [The Context](#5-the-context)
- [The ReAct Loop](#6-the-react-loop)
- [The Two API Levels](#7-the-two-api-levels)
- [Summary](#summary)

---

## 1. The Society

The **Society** is the container for your entire system. It represents a group
of agents working together towards a goal.

Think of it as the "Organisation" or "Team". It holds:

- **Agents**: The workers.
- **Tasks**: The work to be done.
- **Workflow**: The rules of how work flows between agents.

```typescript
import { Society } from 'societyai';

const result = await Society.create()
  .withId('my-team')
  .addAgent(/* ... */)
  .addTask(/* ... */)
  .execute('Start');
```

## 2. Agents & Roles

An **Agent** is an autonomous entity capable of processing information.
In SocietyAI, an agent is composed of:

- **Role**: The "Job Description". Defines *who* the agent is — system prompt,
  name, capabilities.
- **Model**: The "Brain". The LLM (Large Language Model) backing the agent.
- **Tools**: The "Hands". Functions the agent can call (calculator, web search,
  file system, etc.).
- **Memory**: The "Experience". Context retained from previous interactions.

Agents are created through the **fluent builder API** — never instantiated
directly:

```typescript
import { Society, createRole } from 'societyai';

// Option 1: inline role definition (most common)
Society.create()
  .addAgent((a) =>
    a
      .withId('writer')
      .withRole((r) =>
        r
          .withName('Technical Writer')
          .withSystemPrompt('You write clear, concise technical documentation.')
      )
      .withModel(myModel)
  );

// Option 2: reusable pre-built role
const writerRole = createRole('writer')
  .withName('Technical Writer')
  .withSystemPrompt('You write clear, concise technical documentation.')
  .build();

Society.create()
  .addAgent((a) =>
    a.withId('writer').withRole(writerRole).withModel(myModel)
  );
```

> **Note:** `Agent` is a TypeScript interface, not an instantiable class.
> Always use `FluentAgentBuilder` (via `.addAgent()`) or the `createAgent()`
> helper to construct agents.

### `createAgent()` helper

For cases where you want to build an agent object ahead of time:

```typescript
import { createAgent, createRole } from 'societyai';

const role = createRole('analyst')
  .withSystemPrompt('You are a data analyst.')
  .build();

const agent = createAgent('analyst', role, myModel, {
  name: 'Senior Analyst',
  priority: 10,
});

Society.create()
  .useAgent(agent)
  .addTask(/* ... */)
  .execute('Analyse this dataset');
```

## 3. Tasks & Workflow

A **Task** is a specific unit of work. It is not just a prompt — it is a step
in the execution graph that assigns work to one or more agents.

Tasks can have different **execution types**:

| Type | Description |
|---|---|
| **Sequential** | Agents execute one after another; each receives the previous output. |
| **Parallel** | Multiple agents execute simultaneously on the same input. |
| **Collaborative** | Agents exchange messages across multiple rounds until a condition is met. |
| **Human** | Execution pauses and waits for a human to provide input. |

```typescript
Society.create()
  .addAgent(writerAgent)
  .addAgent(editorAgent)

  // Sequential: writer runs, then editor runs
  .addTask((t) =>
    t.withId('draft').withAgents(['writer']).sequential()
  )
  .addTask((t) =>
    t
      .withId('review')
      .dependsOn('draft') // explicit dependency → runs after 'draft'
      .withAgents(['editor'])
      .sequential()
  )

  .execute('Write a post about TypeScript');
```

## 4. The Execution Graph

This is the "Secret Sauce" of SocietyAI.

When you define a Society using the fluent API (`.dependsOn()`, `.thenGoto()`,
etc.), `SocietyExecutor` compiles it into a **Directed Graph** at execution time.

- **Nodes**: Represent execution steps — calling an agent, running in parallel,
  checking a condition, waiting for a human, etc.
- **Edges**: Represent the flow of data between nodes.

Unlike simple sequential chains, this graph supports **Cycles** (loops). This
enables patterns like:

1. **Generate** (Agent A writes code)
2. **Test** (Tool runs tests)
3. **Fix** (If tests fail, go back to step 1)

For cases where you need full graph control, use the low-level `GraphBuilder`
API directly — see the
[Execution Engine](../5-architecture/execution-engine.md) documentation.

## 5. The Context

**Context** is the glue that holds everything together. It flows through the
graph and is available to every agent.

- **Global Context**: Key/value data set at Society level, accessible to all
  agents (`withGlobalContext({ lang: 'fr' })`).
- **Task Results**: The output of completed tasks, automatically injected into
  subsequent tasks via the prompt template (`{history}` placeholder).
- **Message History**: The conversation log produced by collaborative tasks
  (`{messages}` placeholder).

```typescript
Society.create()
  .withGlobalContext({
    language: 'French',
    tone: 'professional',
    projectName: 'SocietyAI',
  })
  .addAgent(/* ... */)
  .execute('...');
```

For advanced type-safe dependency injection, see the
[Context Management](./context.md) guide.

## 6. The ReAct Loop

Inside every agent execution, SocietyAI runs a **ReAct (Reasoning + Acting)**
loop when the agent has tools:

1. **Thought**: The agent considers the input and decides what to do.
2. **Action**: The agent calls a Tool (e.g., `read_file`, `web_search`).
3. **Observation**: The tool executes and returns the result to the agent.
4. **Repeat**: The agent continues until it has a final answer.

This happens automatically. You define the tools; the framework handles the
loop:

```typescript
import { Society, ToolBuilder } from 'societyai';

const calculatorTool = ToolBuilder.create('calculator')
  .withDescription('Evaluate a mathematical expression')
  .withParameters({
    expression: { type: 'string', description: 'The expression to evaluate' },
  })
  .withExecutor(async ({ expression }) => String(eval(expression)))
  .build();

Society.create()
  .addAgent((a) =>
    a
      .withId('analyst')
      .withRole((r) => r.withSystemPrompt('You are a data analyst.'))
      .withModel(myModel)
      .withTools([calculatorTool]) // ← agent can now call the calculator
  )
  .addTask((t) =>
    t.withId('compute').withAgents(['analyst']).sequential()
  )
  .execute('What is 1024 * 768?');
```

## 7. The Two API Levels

SocietyAI offers two levels of abstraction:

| Level | Entry Point | When to Use |
|---|---|---|
| **High-Level** (recommended) | `Society.create()` | Most workflows — sequential, parallel, collaborative, conditional |
| **Low-Level** (advanced) | `GraphBuilder.create()` | Cycles, custom node types, hierarchical nesting, complex aggregations |

Always start with the High-Level API. Drop to the Low-Level only when you need
features not expressible through the fluent builder.

---

## Summary

| Concept | Class / Helper | Purpose |
|---|---|---|
| Society | `Society.create()` | Top-level workflow container |
| Agent | `FluentAgentBuilder`, `createAgent()` | Autonomous processing unit |
| Role | `FluentRoleBuilder`, `createRole()` | Agent "job description" |
| Task | `FluentTaskBuilder` (via `.addTask()`) | Unit of work in the graph |
| Model | `AIModel` interface | LLM adapter you implement |
| Tool | `ToolBuilder` | Function the agent can call |
| Memory | `MemoryBuilder` | Short/long-term context |
| Middleware | `MiddlewareChain`, `Middlewares` | Cross-cutting concerns |
| Graph | `GraphBuilder`, `ExecutionEngine` | Low-level DAG / cycle control |