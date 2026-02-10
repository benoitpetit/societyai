# Decision Guide: Which API to Use?

This guide helps you choose between the High-Level and Low-Level APIs of
SocietyAI.

---

## 🎯 Quick Overview

| Criteria           | High-Level API     | Low-Level API           |
| ------------------ | ------------------ | ----------------------- |
| **Entry Point**    | `Society.create()` | `GraphBuilder.create()` |
| **Complexity**     | 🟢 Simple          | 🟡 Advanced             |
| **Flexibility**    | 🟡 Limited         | 🟢 Maximum              |
| **Use Cases**      | Standard Workflows | Complex Patterns        |
| **Learning Curve** | 15 minutes         | 1-2 hours               |

---

## ✅ Use High-Level API (Society)

### When?

- ✅ You are building a **sequential, parallel, or collaborative** workflow.
- ✅ You want **quick results** without complex configuration.
- ✅ Your logic follows a **linear flow** (A → B → C).
- ✅ You are **new** to SocietyAI.

### Use Case Examples

- Content pipeline (draft → review → publish).
- Parallel analysis by multiple experts.
- Collaborative debate between agents.
- Simple conditional routing (if X then Y, else Z).

> **Note**: Some advanced aggregation strategies (consensus, voting) are
> documented but not yet implemented. Use custom aggregation via
> `AggregationStrategies.reduce()` or `AggregationStrategies.best()` for complex
> scenarios.

### Code Example

```typescript
import { Society } from 'societyai';

const result = await Society.create()
  .withName('Content Pipeline')
  .addAgent(writerAgent)
  .addAgent(editorAgent)
  .addTask((s) => s.withId('draft').withAgents(['writer']).sequential())
  .addTask((s) => s.withId('review').withAgents(['editor']).sequential())
  .execute('Write a blog post about AI');

console.log(result.output);
```

### Advantages

- 🚀 Intuitive and fluent API.
- 📖 Comprehensive documentation.
- 🛡️ Automatic validation.
- 🎨 Pre-configured patterns (`SocietyPatterns`).

---

## 🔧 Use Low-Level API (Graph)

### When?

- ✅ You need **feedback loops** (cycles).
- ✅ You want to **transform data** between steps.
- ✅ You need custom **result aggregation**.
- ✅ Your workflow has a **complex structure** (decision tree).
- ✅ You want **total control** over execution.

### Use Case Examples

- Self-correction loops (generate → validate → retry until valid).
- Hierarchical routing (junior → senior → manager).
- Custom aggregation strategies (best result, weighted scores).
- Multi-stage pipelines with transformations.
- Recursive workflows (agents calling sub-societies).

### Code Example

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('generate', NodeType.AGENT, {
    agentId: 'generator',
  })
  .addNode('validate', NodeType.AGENT, {
    agentId: 'validator',
  })
  .addNode('check', NodeType.CONDITION, {
    condition: (result) => result.includes('VALID'),
  })
  .addNode('end', NodeType.END)

  // Create feedback loop
  .addEdge('start', 'generate')
  .addEdge('generate', 'validate')
  .addEdge('validate', 'check')
  .addEdge('check', 'end') // Valid path
  .addEdge('check', 'generate') // Retry path (cycle!)
  .build();

const result = await graph.execute(input, agents);
```

### Advantages

- ⚡ Optimized Performance
- 🔄 Cycle Support (Self-Correction)
- 🎛️ Granular Control over each node
- 🧩 Advanced Composition (transform, aggregate)

---

## 🤔 Ambiguous Cases

### "I want my agent to improve until the result is perfect"

**→ Low-Level API with Loop**

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('improve', NodeType.LOOP, {
    maxIterations: 10,
    loopCondition: (iteration, result) => {
      return !result.includes('PERFECT');
    },
  })
  .addNode('processor', NodeType.AGENT, { agentId: 'improver' })
  .addNode('end', NodeType.END)

  .addEdge('start', 'improve')
  .addEdge('improve', 'processor')
  .addEdge('processor', 'improve') // Feedback
  .addEdge('improve', 'end')
  .build();
```

**Why not High-Level?**  
While the High-Level API supports basic loops via
`.withLoop(maxIterations, completionCondition)`, the Low-Level API offers finer
control over the loop structure, exit conditions, and data flow between
iterations.

---

### "I want 3 agents debating for 5 rounds"

**→ High-Level API with Collaborative**

```typescript
Society.create()
  .addAgent(agent1)
  .addAgent(agent2)
  .addAgent(agent3)
  .addTask(
    (s) =>
      s
        .withId('debate')
        .withAgents(['agent1', 'agent2', 'agent3'])
        .collaborative(5) // 5 iterations
  )
  .execute(topic);
```

**Why not Low-Level?**  
The High-Level API handles this pattern idiomatically.

---

### "I want to route to different experts based on content"

**→ High-Level API with Conditional Routing**

```typescript
Society.create()
  .addAgent(techExpert)
  .addAgent(bizExpert)
  .addTask(s => s
    .withId('analyze')
    .withAgents(['analyzer'])
    .sequential()
  )
  .addTask(s => s
    .withId('route')
    .withAgents(['tech-expert'])
    .withConditionalNext(
      (results) => {
        const analysis = results.get('analyze')?.[0].output;
        return analysis?.includes('technical');
      },
      'tech-review',
      'biz-review'
    )
  )
  .addTask(s => s.withId('tech-review')...)
  .addTask(s => s.withId('biz-review')...)
  .execute(input);
```

**Low-Level Alternative** (more verbose but more flexible):

```typescript
GraphBuilder.create()
  .addNode('analyze', NodeType.AGENT, { agentId: 'analyzer' })
  .addNode('router', NodeType.CONDITION, {
    condition: (result) => result.includes('technical'),
  })
  .addNode('tech-expert', NodeType.AGENT, { agentId: 'tech' })
  .addNode('biz-expert', NodeType.AGENT, { agentId: 'biz' });
// ...
```

---

## 📊 Summary Table

| Pattern              | High-Level                 | Low-Level    | Recommendation                    |
| -------------------- | -------------------------- | ------------ | --------------------------------- |
| Sequential Pipeline  | ✅ Excellent               | ⚠️ Overkill  | **High-Level**                    |
| Parallel Processing  | ✅ Excellent               | ⚠️ Overkill  | **High-Level**                    |
| Collaborative Debate | ✅ Excellent               | ⚠️ Overkill  | **High-Level**                    |
| Simple Conditional   | ✅ Good                    | ⚠️ Overkill  | **High-Level**                    |
| Self-Correction Loop | ⚠️ Basic (`.withLoop()`)   | ✅ Excellent | **Low-Level** (for complex cases) |
| Custom Aggregation   | ⚠️ Limited                 | ✅ Excellent | **Low-Level**                     |
| Hierarchical Routing | ⚠️ Complex                 | ✅ Excellent | **Low-Level**                     |
| Data Transformations | ⚠️ Limited                 | ✅ Excellent | **Low-Level**                     |
| Complex Tree Logic   | ⚠️ Basic (`.withBranch()`) | ✅ Excellent | **Low-Level** (for complex cases) |

---

## 🎓 Recommended Progression

### Level 1: Beginner (Day 1)

1. Start with `Society.create()`
2. Experiment with `.addTask()` and execution types (`.sequential()`,
   `.parallel()` on steps)
3. Test `.collaborate()` for collaborative workflows

### Level 2: Intermediate (Week 1)

1. Use conditional routing (`.withConditionalNext()`)
2. Explore `SocietyPatterns` (review, consensus)
3. Add middleware (logging, retry)

### Level 3: Advanced (Week 2+)

1. Switch to `GraphBuilder` for complex cases
2. Create your own `NodeType.TRANSFORM` and `NodeType.AGGREGATE`
3. Implement feedback loops

---

## 🚀 Migration High → Low Level

If you start with the High-Level API and realize you need more control:

**Before (High-Level)**:

```typescript
Society.create()
  .addAgent(agent1)
  .addAgent(agent2)
  .addTask((s) => s.withId('step1').withAgents(['agent1']).sequential())
  .addTask((s) => s.withId('step2').withAgents(['agent2']).sequential())
  .execute(input);
```

**After (Low-Level)**:

```typescript
GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
  .addNode('step2', NodeType.AGENT, { agentId: 'agent2' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'step1')
  .addEdge('step1', 'step2')
  .addEdge('step2', 'end')
  .build()
  .execute(input, [agent1, agent2]);
```

---

## ❓ FAQ

### "Can I mix both APIs?"

❌ **No.** Choose one for a single workflow. You cannot pass a `GraphBuilder` to
`Society.create()`.

### "Which one is more performant?"

⚡ **Low-Level API** is slightly faster as it avoids the Workflow → Graph
conversion. But the difference is negligible (<5%) for most cases.

### "Are there features exclusive to Low-Level?"

✅ **Yes**:

- Fine-grained cycle control (complex exit conditions, memory management between
  iterations)
- `NodeType.TRANSFORM` (data transformation between nodes)
- `NodeType.AGGREGATE` (custom aggregation logic)
- `NodeType.LOOP` (advanced repeat-until patterns)
- Direct graph manipulation (conditional edges, parallel fan-out)

> **Note:** The High-Level API now supports basic loops (`.withLoop()`),
> branching (`.withBranch()`), and conditional routing
> (`.withConditionalNext()`), covering most standard use cases.

### "If I start with High-Level, can I migrate easily?"

✅ **Yes.** The conversion is direct (see example above). The mapping is 1:1 in
most cases.

---

## 📚 Resources

- **High-Level API**: [Getting Started Guide](../1-basics/getting-started.md)
- **Low-Level API**: [Architecture Guide](../5-architecture/execution-engine.md)
- **Examples**: `src/__tests__/examples/`
