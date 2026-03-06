# Loops & Cycles (Self-Correction)

One of the most powerful features of SocietyAI is the ability to create
**feedback loops**. This allows agents to critique their own work, fix errors,
and iterate until a quality threshold is met — enabling genuinely self-healing
workflows.

---

## 📋 Table of Contents

- [The Problem with Linear Chains](#the-problem-with-linear-chains)
- [Anatomy of a Loop](#anatomy-of-a-loop)
- [High-Level API: withLoop()](#high-level-api-withloop)
- [Low-Level API: GraphBuilder Cycles](#low-level-api-graphbuilder-cycles)
- [The LoopController](#the-loopcontroller)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🔗 The Problem with Linear Chains

In a standard chain (`A → B → C`), if `A` makes a mistake, `B` and `C` blindly
consume bad data. There is no way to recover without restarting the entire
workflow.

In a **Loop** (`A → Check → (if bad) → A`), the system can self-heal:

```
Generate ──► Evaluate ──► [ APPROVED? ] ──► End
    ▲                          │
    └──────── (retry) ─────────┘
```

This pattern is essential for tasks like code generation, data extraction,
content review, and any process where quality matters.

---

## 🔄 Anatomy of a Loop

Every feedback loop in SocietyAI requires three elements:

1. **The Work Node** — The agent that performs the task (e.g., "Write Code").
2. **The Evaluation Node** — A step that checks quality (e.g., "Run Tests" or
   "Review Output").
3. **The Control Logic** — A condition that decides whether to proceed or loop
   back.

---

## 🚀 High-Level API: `withLoop()`

The simplest way to create a loop is with `.withLoop()` on a `FluentTaskBuilder`.
It repeatedly executes the task's agents until either the completion condition
returns `true` or the maximum iteration count is reached.

```typescript
import { Society } from 'societyai';

const result = await Society.create()
  .addAgent((a) =>
    a
      .withId('coder')
      .withRole((r) =>
        r.withSystemPrompt(
          'You are a software engineer. Write correct, tested TypeScript.'
        )
      )
      .withModel(model)
  )
  .addAgent((a) =>
    a
      .withId('tester')
      .withRole((r) =>
        r.withSystemPrompt(
          'You review code for correctness. Reply with PASS or FAIL and reasons.'
        )
      )
      .withModel(model)
  )

  // Step 1: Write code
  .addTask((t) =>
    t
      .withId('write-code')
      .withAgents(['coder'])
      .withInstructions('Write a TypeScript function to compute Fibonacci numbers.')
      .sequential()
      .thenGoto('review-code')
  )

  // Step 2: Review — loop back to write-code if the review fails
  .addTask((t) =>
    t
      .withId('review-code')
      .withAgents(['tester'])
      .withInstructions('Review the code above. Reply with PASS or FAIL.')
      .sequential()
      .withLoop(5, (results, iteration) => {
        // Exit the loop when the tester says PASS
        const lastResult = results[results.length - 1];
        return lastResult?.output.includes('PASS') ?? false;
      })
  )

  .execute('Start coding workflow');

console.log('Final output:', result.output);
```

### `withLoop()` Signature

```typescript
withLoop(
  maxIterations: number,
  completionCondition?: (results: TaskResult[], iteration: number) => boolean
): FluentTaskBuilder
```

| Parameter | Type | Description |
|---|---|---|
| `maxIterations` | `number` | Hard cap on the number of loop iterations. |
| `completionCondition` | `function` *(optional)* | Return `true` to exit the loop early. Receives the accumulated results and the current iteration number. |

> **Note:** If `completionCondition` is omitted, the loop always runs exactly
> `maxIterations` times.

---

## ⚙️ Low-Level API: GraphBuilder Cycles

For finer control — custom exit logic, memory management between iterations, or
multi-step cycles — use the `GraphBuilder` directly. This API supports true
cyclic graphs (unlike the high-level API which wraps loops internally).

### Example: Code Generation & Fix Loop

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const engine = GraphBuilder.create()
  .addNode('start',    NodeType.START)
  .addNode('generate', NodeType.AGENT, { agentId: 'coder' })
  .addNode('validate', NodeType.AGENT, { agentId: 'tester' })
  .addNode('check',    NodeType.CONDITION, {
    condition: (result: string) => result.includes('PASS'),
  })
  .addNode('end', NodeType.END)

  .addEdge('start',    'generate')
  .addEdge('generate', 'validate')
  .addEdge('validate', 'check')
  // If PASS → end; if FAIL → loop back
  .addConditionalEdge({
    from:      'check',
    condition: (result: string) => result.includes('PASS'),
    truePath:  'end',
    falsePath: 'generate',
  })
  .build();

const result = await engine.execute('Write a Fibonacci function', agents);
```

### Example: Loop Node with Max Iterations

Use `NodeType.LOOP` to manage iteration state explicitly:

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const engine = GraphBuilder.create()
  .addNode('start',     NodeType.START)
  .addNode('process',   NodeType.AGENT, { agentId: 'processor' })
  .addNode('loopCtrl',  NodeType.LOOP, {
    maxIterations: 10,
    loopCondition: (iteration: number, result: string) =>
      iteration < 10 && !result.includes('COMPLETE'),
  })
  .addNode('end', NodeType.END)

  .addEdge('start',    'process')
  .addEdge('process',  'loopCtrl')
  .addEdge('loopCtrl', 'process')  // continue iterating
  .addConditionalEdge({
    from:      'loopCtrl',
    condition: (_result, ctx) => (ctx.iterationCount ?? 0) >= 10,
    truePath:  'end',
    falsePath: 'process',
  })
  .build();
```

---

## 🧠 The LoopController

Under the hood, SocietyAI uses a `LoopController` to manage loop state.

| Feature | Description |
|---|---|
| **Max Iterations** | Prevents infinite loops. Always enforced as a hard cap. |
| **Exit Condition** | Optional predicate; returning `true` breaks the loop immediately. |
| **History Aggregation** | Controls how memory is passed between iterations. By default, agents see the full history of all previous attempts in the current loop, enabling them to understand *why* they failed. |
| **Critical Node Preservation** | START, END, and error nodes are always retained in the execution path even when a `RetentionPolicy` prunes older results. |

> For very long loops, configure a `RetentionPolicy` on your `SocietyConfig` to
> cap memory usage:
>
> ```typescript
> Society.create()
>   // ... agents and tasks
>   // retentionPolicy is set at the SocietyConfig level
>   .build(); // then inspect / pass to engine
> ```
>
> See [Advanced Features](../6-advanced-features/advanced-features.md) for
> details on `RetentionPolicy`.

---

## 💡 Use Cases

| Pattern | Description |
|---|---|
| **Code Generation** | Write → Compile/Test → Fix (loop until tests pass). |
| **Content Creation** | Draft → Critique → Revise (loop until quality threshold met). |
| **Data Extraction** | Extract JSON → Validate Schema → Retry if invalid. |
| **Research** | Search → Is info sufficient? → Search more if not. |
| **Negotiation** | Propose → Counter-propose → Reach agreement. |

---

## ✅ Best Practices

### 1. Always Set `maxIterations`

Even with a well-crafted prompt, an agent can get stuck in a loop that never
converges. A hard cap is your safety net.

```typescript
// ❌ No hard cap — dangerous
.withLoop(Infinity, condition)

// ✅ Always bounded
.withLoop(5, condition)
```

### 2. Use Clear Exit Criteria

Ensure the evaluation step produces an unambiguous signal — a specific keyword
or a boolean — that the condition can reliably detect.

```typescript
// ✅ Clear signal
const completionCondition = (results: TaskResult[]) =>
  results[results.length - 1]?.output.includes('APPROVED') ?? false;

// ❌ Ambiguous signal
const completionCondition = (results: TaskResult[]) =>
  results[results.length - 1]?.output.length > 100; // length is not a quality signal
```

### 3. Feed Errors Back to the Agent

When looping back, ensure the agent receives the *error message* or *critique*
from the previous attempt. Without this feedback, the agent repeats the same
mistake.

The `{history}` placeholder in your prompt template automatically includes
previous results, giving the agent full context of what went wrong.

### 4. Prefer High-Level API for Simple Loops

Use `.withLoop()` unless you need:

- Direct cycle manipulation in the graph
- Custom memory aggregation between iterations
- Multi-step loops (more than one node in the cycle body)

For those cases, use the `GraphBuilder` `CONDITION` + `LOOP` nodes directly.

---

## 📚 Next Steps

- **[Execution Engine](../5-architecture/execution-engine.md)** — Deep dive into
  `LoopController`, iterative state machine, and node types.
- **[Validation](../3-capabilities/validation.md)** — Combine loops with
  structured output validation for self-correcting JSON extraction.
- **[Middleware](./middleware.md)** — Add retry logic and circuit breakers on
  top of loops for production resilience.
- **[Observability](./observability.md)** — Track loop iterations with
  `task:complete` events and the `ProgressTracker`.
- **[Decision Guide](../reference/decision-guide.md)** — When to use High-Level
  vs Low-Level API for loops.