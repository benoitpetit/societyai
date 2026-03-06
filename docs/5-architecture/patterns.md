# Design Patterns

SocietyAI ships with a set of pre-built composition patterns that cover the most
common multi-agent workflow topologies. These patterns are available as:

- **High-level fluent shortcuts** on `Society` (`.chain()`, `.scatterGather()`,
  `.collaborate()`, `.usePipeline()`)
- **Static factory helpers** via `SocietyPatterns` for building standalone
  `Society` instances from pre-configured agents

All patterns are fully compatible with middleware, observers, and the global
context system.

---

## 📋 Table of Contents

- [SocietyPatterns](#societypatterns)
- [High-Level Fluent Shortcuts](#high-level-fluent-shortcuts)
- [AggregationStrategies](#aggregationstrategies)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🎨 SocietyPatterns

`SocietyPatterns` provides static factory methods that create fully wired
`Society` instances from an array of pre-built `Agent` objects.

```typescript
import {
  Society,
  SocietyPatterns,
  AggregationStrategies,
  createAgent,
  createRole,
} from 'societyai';

const writer    = createAgent('writer',    writerRole,    model);
const editor    = createAgent('editor',    editorRole,    model);
const analyst1  = createAgent('analyst-1', analystRole,   model);
const analyst2  = createAgent('analyst-2', analystRole,   model);
const analyst3  = createAgent('analyst-3', analystRole,   model);

// Sequential chain — agents execute one after another
const chain = SocietyPatterns.chain([writer, editor]);
const chainResult = await chain.execute('Write a blog post about TypeScript.');

// Parallel (scatter-gather) — all agents run simultaneously
const parallel = SocietyPatterns.parallel([analyst1, analyst2, analyst3]);
const parallelResult = await parallel.execute('Analyse Q2 market conditions.');

// Collaborative debate — agents exchange messages for N rounds
const collaborative = SocietyPatterns.collaborative([writer, editor], 3);
const collabResult  = await collaborative.execute('Should we adopt TypeScript?');

// Review pipeline — writer produces, editor reviews
const reviewPipeline = SocietyPatterns.review(writer, editor);
const reviewResult   = await reviewPipeline.execute('Write a technical summary.');
```

### Available Patterns

| Method | Description |
|---|---|
| `SocietyPatterns.chain(agents)` | Executes agents sequentially. Each agent receives the output of the previous one. |
| `SocietyPatterns.parallel(agents)` | Executes all agents simultaneously on the same input. Results are concatenated. |
| `SocietyPatterns.collaborative(agents, maxIterations?)` | Agents exchange messages across multiple rounds until a completion condition is met or `maxIterations` is reached. |
| `SocietyPatterns.review(producer, reviewer)` | Two-step pipeline: the producer creates content, the reviewer evaluates it. |

---

## ⚡ High-Level Fluent Shortcuts

When building a Society with `.addAgent()`, the following shortcuts wire the
added agents into common patterns without requiring explicit `.addTask()` calls.

### `.chain()`

Wires all added agents into a sequential chain in declaration order. Agent 1's
output becomes the input for Agent 2, and so on.

```typescript
import { Society } from 'societyai';

await Society.create()
  .addAgent((a) => a.withId('writer').withModel(model).withRole(writerRole))
  .addAgent((a) => a.withId('editor').withModel(model).withRole(editorRole))
  .chain()   // ← wire: writer → editor
  .execute('Write a paragraph about TypeScript.');
```

### `.scatterGather(aggregator?)`

Runs all added agents in parallel on the same input, then aggregates their
results. You can provide a custom `AggregationStrategies` function or omit it
for the default concatenation strategy.

```typescript
import { Society, AggregationStrategies } from 'societyai';

await Society.create()
  .addAgent((a) => a.withId('analyst-1').withModel(model).withRole(role1))
  .addAgent((a) => a.withId('analyst-2').withModel(model).withRole(role2))
  .addAgent((a) => a.withId('analyst-3').withModel(model).withRole(role3))
  .scatterGather(AggregationStrategies.concat('\n\n---\n\n'))
  .execute('Analyse the product launch strategy.');
```

### `.collaborate(maxIterations?)`

Creates a collaborative (multi-round debate) workflow across all added agents.
Agents receive each other's messages and respond over `maxIterations` rounds.

```typescript
import { Society } from 'societyai';

await Society.create()
  .addAgent((a) => a.withId('pro').withModel(model).withRole(proRole))
  .addAgent((a) => a.withId('con').withModel(model).withRole(conRole))
  .collaborate(5)   // ← 5 rounds of debate
  .execute('Should AI be regulated?');
```

### `.usePipeline(builderFn)`

Configures a custom pipeline pattern via `FluentPipelineBuilder`, including
router patterns that direct input to specific agents based on a selector
function.

```typescript
import { Society } from 'societyai';

await Society.create()
  .addAgent((a) => a.withId('tech-expert').withModel(model).withRole(techRole))
  .addAgent((a) => a.withId('biz-expert').withModel(model).withRole(bizRole))
  .usePipeline((p) =>
    p.router(
      ['tech-expert', 'biz-expert'],
      (input) => input.toLowerCase().includes('technical') ? 'tech-expert' : 'biz-expert'
    )
  )
  .execute('Explain our cloud migration strategy.');
```

---

## 📊 AggregationStrategies

`AggregationStrategies` provides composable result aggregation functions for
use with parallel tasks (`.parallel()`, `.scatterGather()`) and
`transformResults()`.

```typescript
import { AggregationStrategies } from 'societyai';

// Concatenate all results with a separator
.transformResults(AggregationStrategies.concat('\n---\n'))

// Take the first successful result
.transformResults(AggregationStrategies.first())

// Take the last successful result
.transformResults(AggregationStrategies.last())

// Select the result with the highest score (custom scorer)
.transformResults(AggregationStrategies.best((result) => result.output.length))

// Format results as JSON, markdown, or list
.transformResults(AggregationStrategies.structured('markdown'))

// Custom reducer
.transformResults(
  AggregationStrategies.reduce(
    (acc, result) => acc + '\n' + result.output,
    '',
    (final) => final.trim()
  )
)
```

### Available Strategies

| Strategy | Description |
|---|---|
| `concat(separator?)` | Concatenates all successful results with an optional separator string. Defaults to `'\n'`. |
| `first()` | Returns the first successful result only. |
| `last()` | Returns the last successful result only. |
| `best(scoreFn)` | Selects the result with the highest score returned by `scoreFn(result) => number`. |
| `structured(format?)` | Formats results as `'json'`, `'markdown'`, or `'list'`. Defaults to `'markdown'`. |
| `reduce(reducer, initial, finalize?)` | Applies a custom `(accumulator, result) => accumulator` reduction. Optional `finalize` transforms the final value. |

> **Note:** `AggregationStrategies.consensus()` and
> `AggregationStrategies.voting()` are planned for a future release. Use
> `reduce()` or `best()` as alternatives for consensus-like behaviour.

---

## ✅ Best Practices

### 1. Start with the Simplest Pattern

Choose the least complex pattern that satisfies your requirements:

```typescript
// ✅ Simple sequential pipeline — start here
Society.create().addAgent(...).addAgent(...).chain().execute(input);

// ✅ Parallel analysis with aggregation
Society.create().addAgent(...).addAgent(...).scatterGather(...).execute(input);

// Only use GraphBuilder when you need cycles, transforms, or fine-grained control
```

### 2. Use `AggregationStrategies.best()` for Quality Selection

When running multiple agents in parallel on the same task and you only need the
best answer, `best()` avoids noise from weaker results:

```typescript
.transformResults(
  AggregationStrategies.best((result) => {
    // Score by word count as a proxy for detail
    return result.output.split(' ').length;
  })
)
```

### 3. Set `maxIterations` on Collaborative Patterns

Collaborative workflows without an explicit iteration cap can run longer than
expected. Always provide a bound:

```typescript
// ❌ No cap — can be slow and expensive
Society.create().collaborate().execute(input);

// ✅ Bounded
Society.create().collaborate(3).execute(input);
```

### 4. Combine Patterns with Middleware

All patterns are fully compatible with the middleware system:

```typescript
import { Society, SocietyPatterns, Middlewares, MiddlewareChain } from 'societyai';

const society = SocietyPatterns.review(writer, editor);

// Add middleware after creating the pattern
society
  .addMiddleware(
    MiddlewareChain.create()
      .use(Middlewares.logging())
      .use(Middlewares.retry({ maxAttempts: 2 }))
  )
  .execute(input);
```

---

## 📚 Next Steps

- **[Society Configuration](../2-building-societies/society-configuration.md)**
  — Full `Society` API reference including `.addTask()`, `.withObserver()`, and
  `.withGlobalContext()`.
- **[Society Builder](../2-building-societies/society-builder.md)** — Complete
  `FluentTaskBuilder` reference for building custom task graphs.
- **[Execution Engine](./execution-engine.md)** — Understand the underlying DAG
  that patterns compile to.
- **[Graph Transformation](./graph-transformation.md)** — When to use
  Middlewares, Transform Nodes, or Result Transformers for data manipulation.
- **[Decision Guide](../reference/decision-guide.md)** — Choose between
  High-Level patterns and the Low-Level `GraphBuilder` API.