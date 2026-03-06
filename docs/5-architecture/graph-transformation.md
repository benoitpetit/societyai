# Graph Transformation Mechanisms

This guide explains when and how to use the three transformation mechanisms
available in SocietyAI, and how to choose the right one for your use case.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Middlewares](#1-middlewares)
- [Transform Nodes](#2-transform-nodes-graph)
- [Step Result Transformers](#3-step-result-transformers)
- [Decision Table](#decision-table)
- [Combined Example](#combined-examples)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🗺️ Overview

SocietyAI offers three complementary ways to transform or modify data as it
flows through your workflow. Each operates at a different level of scope:

| Mechanism | Scope | API Level |
|---|---|---|
| **Middlewares** | Global — all agents | High-level (`Society`) |
| **Transform Nodes** | Local — a single node in the graph | Low-level (`GraphBuilder`) |
| **Step Result Transformers** | Local — a single task step | High-level (`Society`) |

---

## 🔁 1. Middlewares

### When to Use

- **Cross-cutting concerns**: Logging, metrics, caching, rate limiting
- **Global transformations**: Applied to all requests/responses
- **Validation/Sanitization**: Verify or clean inputs/outputs
- **Retry logic**: Error handling and retry attempts

### Characteristics

- ✅ Apply to **all agents** in the society
- ✅ **Composable** and reusable
- ✅ Executed **before and after** each model call
- ⚠️ Do not modify the workflow control flow

### Usage Example

```typescript
import { Society, Middlewares } from 'societyai';

const result = await Society.create()
  .withName('Logged Society')
  .addMiddleware(Middlewares.logging())
  .addMiddleware(Middlewares.timing())
  .addMiddleware(Middlewares.cache({ ttl: 60000 }))
  .addAgent(agent => /* ... */)
  .addTask(step => /* ... */)
  .execute('Input');
```

### Typical Use Cases

- **Observability**: Trace all model interactions
- **Performance**: Cache frequent responses
- **Reliability**: Auto-retry on transient errors
- **Security**: Filter sensitive content

---

## 🔀 2. Transform Nodes (Graph)

### When to Use

- **In-flow transformations**: Modify data between two steps
- **Normalization**: Format outputs for the next step
- **Extraction**: Extract a specific part of a result
- **Conditional routing**: Decide the next node based on data

### Characteristics

- ✅ Integral part of the **execution graph**
- ✅ Enables **dynamic routing**
- ✅ Full access to the **execution context**
- ⚠️ Requires using the GraphBuilder API

### Usage Example

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const graph = GraphBuilder.create()
  .addNode('analyzer', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('extract', NodeType.TRANSFORM, {
    transformer: (result, context) => {
      // Extract only the score from a JSON result
      const data = JSON.parse(result);
      return data.score.toString();
    },
  })
  .addNode('evaluator', NodeType.AGENT, { agentId: 'evaluator' })
  .addEdge('analyzer', 'extract')
  .addEdge('extract', 'evaluator')
  .build();
```

### Typical Use Cases

- **Format conversion**: JSON → String, XML → JSON, etc.
- **Data enrichment**: Add metadata to the context
- **Aggregation**: Combine multiple results
- **Filtering**: Remove irrelevant data

---

## 🔧 3. Step Result Transformers

### When to Use

- **Step post-processing**: Transform a specific step's result
- **Simple formatting**: Clean or format the output
- **Type conversion**: Convert the result to an expected format
- **Business logic**: Apply simple business logic

### Characteristics

- ✅ **Scoped** to a specific step
- ✅ Simple and **declarative**
- ✅ Compatible with the high-level fluent API
- ⚠️ No access to the global context

### Usage Example

```typescript
const result = await Society.create()
  .withName('Formatted Output')
  .addAgent(/* ... */)
  .addTask((s) =>
    s
      .withId('analyze')
      .withAgents(['analyst'])
      .sequential()
      .transformResults((results) => {
        // Transform the result into structured JSON
        const content = Array.isArray(results)
          ? results[0].output
          : results.output;

        return {
          analysis: content,
          timestamp: Date.now(),
          confidence: 0.95,
        };
      })
  )
  .execute('Analyze this');
```

### Typical Use Cases

- **Formatting**: Add prefixes/suffixes
- **Validation**: Verify the output format
- **Mapping**: Convert between data formats
- **Extraction**: Isolate part of the result

---

## 📊 Decision Table

| Criteria            | Middlewares         | Transform Nodes  | Result Transformers |
| ------------------- | ------------------- | ---------------- | ------------------- |
| **Scope**           | Global (all agents) | Local (in graph) | Local (one step)    |
| **Reusability**     | ✅ High             | ⚠️ Medium        | ❌ Low              |
| **Context Access**  | ✅ Full             | ✅ Full          | ⚠️ Limited          |
| **Dynamic Routing** | ❌ No               | ✅ Yes           | ❌ No               |
| **Complexity**      | Medium              | High             | Low                 |
| **Required API**    | Society fluent      | GraphBuilder     | Society fluent      |

---

## 🧩 Combined Examples

All three mechanisms are fully composable. Here is an example that uses all
three in the same workflow:

```typescript
import { Society, Middlewares, GraphBuilder, NodeType } from 'societyai';

// 1. Middleware for global logging
const loggingMiddleware = Middlewares.logging();

// 2. Transform Node for data extraction
const extractNode = {
  id: 'extract-score',
  type: NodeType.TRANSFORM,
  transformer: (result) => JSON.parse(result).score,
};

// 3. Result Transformer for formatting
const result = await Society.create()
  .withName('Complete Example')
  .addMiddleware(loggingMiddleware) // Global
  .addAgent(/* ... */)
  .addTask((s) =>
    s
      .withId('evaluate')
      .withAgents(['evaluator'])
      .sequential()
      .transformResults((r) => ({
        // Local to the step
        score: r.output,
        evaluated_at: new Date().toISOString(),
      }))
  )
  .execute('Input');
```

---

## ✅ Best Practices

### ✅ Do

- Use **Middlewares** for cross-cutting concerns
- Use **Transform Nodes** for complex routing
- Use **Result Transformers** for simple step-level transformations
- Keep transformations **pure** (no side effects)

### ❌ Avoid

- Using Result Transformers to modify the global context
- Using Middlewares for step-specific transformations
- Mixing business logic and transformation in middlewares
- Transforming data that is not needed

---

## 📚 Next Steps

- **[Middleware](../4-advanced/middleware.md)** — Complete guide to the 13
  built-in middlewares, `MiddlewareChain`, custom middleware functions, and
  composition patterns.
- **[Execution Engine](./execution-engine.md)** — How `NodeType.TRANSFORM` and
  `NodeType.AGGREGATE` are processed by the graph engine.
- **[Architecture Overview](./overview.md)** — High-level map of all system
  components and how they interact.
- **[Society Builder](../2-building-societies/society-builder.md)** — Full
  `FluentTaskBuilder` reference including `.transformResults()`.
- **[Decision Guide](../reference/decision-guide.md)** — When to use the
  High-Level API (with Result Transformers and Middlewares) vs the Low-Level
  API (with Transform Nodes).
