# Performance Benchmarks

SocietyAI includes a comprehensive benchmarking suite to help you measure and
optimize the performance of your multi-agent workflows.

---

## 📋 Table of Contents

- [Running Benchmarks](#running-benchmarks)
- [Available Benchmarks](#available-benchmarks)
- [CLI Benchmarks](#cli-benchmarks)
- [Writing Custom Benchmarks](#writing-custom-benchmarks)
- [Interpreting Results](#interpreting-results)
- [Performance Tips](#performance-tips)

---

## Running Benchmarks

### Using the CLI

The easiest way to run benchmarks is via the CLI:

```bash
# Run all benchmarks
npx societyai benchmark

# Run specific benchmarks (filter by pattern)
npx societyai benchmark --filter "parallel"
npx societyai benchmark --filter "sequential"

# Specify number of runs
npx societyai benchmark --runs 50

# Save results to file
npx societyai benchmark --output results.json
```

### Using NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "benchmark": "societyai benchmark",
    "benchmark:parallel": "societyai benchmark --filter 'parallel'",
    "benchmark:memory": "societyai benchmark --filter 'memory'"
  }
}
```

### Programmatically

Run benchmarks directly with Vitest:

```bash
# Run all benchmarks
npx vitest bench --run

# Run specific file
npx vitest bench benchmarks/execution-engine.bench.ts --run

# Run with filter
npx vitest bench --run -t "parallel"
```

---

## Available Benchmarks

### Execution Engine Benchmarks

Located in `benchmarks/execution-engine.bench.ts`:

#### Sequential Execution

Measures performance of sequential agent chains:

```typescript
bench('2 agents sequential', async () => {
  const graph = GraphBuilder.create()
    .addNode('start', NodeType.START)
    .addNode('agent1', NodeType.AGENT, { agentId: 'a1' })
    .addNode('agent2', NodeType.AGENT, { agentId: 'a2' })
    .addNode('end', NodeType.END)
    .addEdge('start', 'agent1')
    .addEdge('agent1', 'agent2')
    .addEdge('agent2', 'end')
    .build();

  await graph.execute({
    input: 'test',
    agents: [createMockAgent('a1'), createMockAgent('a2')],
  });
});
```

**Benchmarks:**
- `2 agents sequential` — Basic two-agent chain
- `5 agents sequential` — Medium complexity chain
- `10 agents sequential` — Long sequential chain

#### Parallel Execution

Measures performance of parallel agent execution:

```typescript
bench('5 agents parallel', async () => {
  const graph = GraphBuilder.create()
    .addNode('start', NodeType.START)
    .addNode('parallel', NodeType.PARALLEL, {
      agentIds: ['a1', 'a2', 'a3', 'a4', 'a5'],
    })
    .addNode('end', NodeType.END)
    .addEdge('start', 'parallel')
    .addEdge('parallel', 'end')
    .build();

  await graph.execute({
    input: 'test',
    agents: Array.from({ length: 5 }, (_, i) => createMockAgent(`a${i + 1}`)),
  });
});
```

**Benchmarks:**
- `5 agents parallel` — Small parallel batch
- `10 agents parallel` — Medium parallel batch
- `20 agents parallel` — Large parallel batch

#### Complex Workflows

Tests complex graph patterns:

**Benchmarks:**
- `diamond pattern (conditional)` — Branching workflow
- `fan-out fan-in pattern` — Scatter-gather pattern
- `loop pattern (5 iterations)` — Cyclic execution

### Memory System Benchmarks

Tests memory operations performance:

```typescript
bench('short-term memory operations', async () => {
  const memory = new MemorySystem();

  for (let i = 0; i < 100; i++) {
    await memory.addToShortTerm(`key${i}`, `value${i}`);
  }

  for (let i = 0; i < 100; i++) {
    await memory.getFromShortTerm(`key${i}`);
  }
});
```

**Benchmarks:**
- `short-term memory operations` — 100 writes + 100 reads
- `long-term memory with embeddings` — 50 document embeddings + search

### Middleware Benchmarks

Tests middleware chain overhead:

```typescript
bench('empty chain', async () => {
  const chain = MiddlewareChain.create().build();
  await chain.execute('test input');
});

bench('chain with 5 middlewares', async () => {
  const chain = MiddlewareChain.create()
    .use(Middlewares.logging({ logInput: false, logOutput: false }))
    .use(Middlewares.timing())
    .use(Middlewares.transformInput((input) => String(input).toUpperCase()))
    .use(Middlewares.transformOutput((output) => output.toLowerCase()))
    .use(Middlewares.validation({ validateInput: () => true }))
    .forModel(new MockModel())
    .build();

  await chain.execute('test input');
});
```

**Benchmarks:**
- `empty chain` — Baseline overhead
- `chain with 5 middlewares` — Typical middleware stack
- `chain with caching` — Cache hit/miss performance

---

## CLI Benchmarks

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--filter, -f` | Filter benchmarks by pattern | all |
| `--runs, -r` | Number of runs per benchmark | 100 |
| `--output, -o` | Save results to JSON file | - |

### Example Output

```bash
$ npx societyai benchmark --filter "parallel" --runs 50

⏱️  Running benchmarks...
  Filter: parallel
  Runs: 50

🚀 Starting benchmarks...

ExecutionEngine - Parallel Execution
✓ 5 agents parallel  124.56 ops/s  ±2.34%  (50 runs sampled)
✓ 10 agents parallel  89.23 ops/s   ±3.12%  (50 runs sampled)
✓ 20 agents parallel  45.67 ops/s   ±4.56%  (50 runs sampled)

✅ Benchmarks completed!
```

---

## Writing Custom Benchmarks

### Basic Structure

Create a new file in `benchmarks/`:

```typescript
// benchmarks/my-feature.bench.ts
import { bench, describe } from 'vitest';
import { MyFeature } from '../src/my-feature';

describe('My Feature', () => {
  bench('basic operation', async () => {
    const feature = new MyFeature();
    await feature.doSomething();
  });

  bench('with large dataset', async () => {
    const feature = new MyFeature();
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      value: `item-${i}`,
    }));
    await feature.process(data);
  });
});
```

### Best Practices

1. **Use Mock Models**: Never benchmark with real LLM calls

```typescript
import { MockModel } from 'societyai/adapters';

const model = new MockModel();
```

2. **Isolate Setup**: Don't include setup in the benchmark

```typescript
// ❌ Bad - includes setup
bench('slow', async () => {
  const graph = createComplexGraph(); // Setup included
  await graph.execute({ input: 'test', agents });
});

// ✅ Good - setup outside
const graph = createComplexGraph();
bench('fast', async () => {
  await graph.execute({ input: 'test', agents });
});
```

3. **Test Different Scales**: Show how performance scales

```typescript
for (const count of [10, 100, 1000]) {
  bench(`${count} items`, async () => {
    await processItems(count);
  });
}
```

4. **Include Baseline**: Compare against simple operations

```typescript
bench('baseline (no middleware)', async () => {
  await model.process('test');
});

bench('with middleware', async () => {
  await wrappedModel.process('test');
});
```

---

## Interpreting Results

### Understanding Metrics

- **ops/s**: Operations per second (higher is better)
- **±%**: Relative standard deviation (lower is more consistent)
- **runs sampled**: Number of iterations executed

### Example Analysis

```
✓ 5 agents sequential   245.67 ops/s  ±1.23%  (100 runs)
✓ 5 agents parallel     189.45 ops/s  ±2.56%  (100 runs)
```

**Interpretation:**
- Sequential is faster for 5 agents (245 vs 189 ops/s)
- Parallel has more variance (±2.56% vs ±1.23%)
- For CPU-bound tasks, sequential may be better
- For I/O-bound tasks, parallel scales better

### Performance Regression Testing

Save baseline results and compare:

```bash
# Save baseline
npx societyai benchmark --output baseline.json

# After changes, compare
npx societyai benchmark --output current.json

# Compare (custom script)
node scripts/compare-benchmarks.js baseline.json current.json
```

---

## Performance Tips

### 1. Optimize Agent Count

Don't create more agents than needed:

```typescript
// ❌ Bad - too many agents
const engine = GraphBuilder.create()
  .addNode('parallel', NodeType.PARALLEL, {
    agentIds: Array.from({ length: 100 }, (_, i) => `agent${i}`),
  });

// ✅ Good - batch if needed
const engine = GraphBuilder.create()
  .addNode('batch1', NodeType.PARALLEL, { agentIds: batch1 })
  .addNode('batch2', NodeType.PARALLEL, { agentIds: batch2 });
```

### 2. Use Caching Middleware

Cache expensive operations:

```typescript
const chain = MiddlewareChain.create()
  .use(Middlewares.cache({ ttl: 60000 }))
  .forModel(model);
```

### 3. Limit Parallelism

Control concurrency with `maxParallelism`:

```typescript
const engine = new ExecutionEngine(nodes, edges, {
  maxParallelism: 10, // Limit concurrent tasks
});
```

### 4. Use Worker Threads for CPU-Intensive Tasks

```typescript
.addAgent((a) =>
  a
    .withId('analyzer')
    .withModel(model)
    .withExecutionMode('isolated') // Run in worker thread
);
```

### 5. Profile Memory Usage

```typescript
bench('memory usage', async () => {
  const before = process.memoryUsage().heapUsed;

  await executeLargeGraph();

  const after = process.memoryUsage().heapUsed;
  console.log(`Memory delta: ${(after - before) / 1024 / 1024} MB`);
});
```

---

## 📚 Related Documentation

- [Middleware](./middleware.md) — Caching and optimization
- [Worker Threads](./worker-threads.md) — CPU-intensive tasks
- [Execution Engine](../5-architecture/execution-engine.md) — How the graph works
- [CLI Reference](../reference/cli.md) — Complete CLI documentation
