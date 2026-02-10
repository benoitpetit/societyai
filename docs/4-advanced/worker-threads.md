# Worker Threads Integration

SocietyAI supports **Worker Threads** for executing CPU-intensive agents
in isolated threads, preventing the main event loop from blocking.

## 🎯 Overview

The JavaScript/Node.js event loop can be blocked by CPU-intensive operations
like:

- Heavy data processing
- Complex mathematical calculations
- Large dataset transformations
- Machine learning inference
- Image/video processing

SocietyAI's **IsolatedWorkerPool** allows you to execute these agents in
separate Worker Threads, maintaining application responsiveness.

---

## 🔧 Configuration

### Setting Execution Mode

Use `withExecutionMode()` when building an agent:

```typescript
import { Society } from 'societyai';
import { OpenAIModel } from './my-model-impl';

const model = new OpenAIModel(process.env.OPENAI_API_KEY);

const society = Society.create()
  .withId('cpu-intensive-society')

  // Standard agent (runs in main thread)
  .addAgent((agent) =>
    agent
      .withId('coordinator')
      .withRole((role) =>
        role.withSystemPrompt('You coordinate tasks and handle I/O operations.')
      )
      .withModel(model)
    // executionMode defaults to 'default'
  )

  // CPU-intensive agent (runs in Worker Thread)
  .addAgent((agent) =>
    agent
      .withId('data-processor')
      .withRole((role) =>
        role.withSystemPrompt(
          'You perform heavy data analysis and complex calculations.'
        )
      )
      .withModel(model)
      .withExecutionMode('isolated') // ← Runs in Worker Thread
  )

  .addTask((task) =>
    task.withId('coordinate').withAgents(['coordinator']).thenGoto(['process'])
  )
  .addTask((task) => task.withId('process').withAgents(['data-processor']))

  .execute('Analyze large dataset');
```

---

## 📋 Execution Modes

| Mode        | Description                        | Use Case                        |
| ----------- | ---------------------------------- | ------------------------------- |
| `'default'` | Runs in main thread (standard)     | I/O-bound tasks, API calls      |
| `'isolated'`| Runs in Worker Thread              | CPU-intensive computations      |
| `undefined` | Same as `'default'` (backward compat) | Existing code                  |

---

## ⚡ How It Works

### Architecture

```
┌──────────────────────────────────────┐
│        ExecutionEngine               │
│                                      │
│  if (agent.executionMode === 'isolated') {
│    // Create worker pool              │
│    const pool = new IsolatedWorkerPool(4);
│                                      │
│    // Execute in Worker Thread       │
│    result = await pool.execute({
│      agent, input, context           │
│    });                                │
│                                      │
│    // Cleanup                        │
│    await pool.shutdown();            │
│  }                                   │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│     IsolatedWorkerPool               │
│                                      │
│  ┌─────────┐ ┌─────────┐            │
│  │ Worker1 │ │ Worker2 │ ...        │
│  └─────────┘ └─────────┘            │
│                                      │
│  - Manages pool of workers           │
│  - Serializes agent config           │
│  - Distributes tasks                 │
│  - Collects results                  │
└──────────────────────────────────────┘
```

### Process Flow

1. **ExecutionEngine** detects `agent.executionMode === 'isolated'`
2. Creates **IsolatedWorkerPool** with N workers
3. **Serializes** agent configuration (model, role, tools)
4. **Executes** agent logic in Worker Thread
5. **Collects** result from worker
6. **Cleans up** worker pool

---

## 🔍 When to Use Worker Threads

### ✅ Use Worker Threads For:

- **Data Processing**: Large CSV/JSON parsing
- **Calculations**: Complex mathematical operations
- **Transformations**: Data format conversions
- **Analysis**: Statistical computations
- **Inference**: Local ML model execution

### ❌ Don't Use Worker Threads For:

- **I/O Operations**: API calls, database queries (use standard mode)
- **Simple Tasks**: Minimal processing overhead
- **Quick Operations**: Sub-millisecond tasks

---

## 📊 Performance Comparison

### Standard Mode (Main Thread)

```typescript
// All agents block the event loop
// Good for I/O-bound tasks

const society = Society.create()
  .addAgent((a) =>
    a
      .withId('agent')
      .withModel(model)
    // No executionMode → runs in main thread
  );
```

**Pros**: Low overhead, simple  
**Cons**: Can block event loop for CPU-intensive tasks

### Isolated Mode (Worker Thread)

```typescript
// CPU-intensive agents run in parallel
// Non-blocking for main thread

const society = Society.create()
  .addAgent((a) =>
    a
      .withId('cpu-agent')
      .withModel(model)
      .withExecutionMode('isolated') // ← Worker Thread
  );
```

**Pros**: Non-blocking, true parallelism  
**Cons**: Serialization overhead, slightly higher latency

---

## 🛠️ Advanced Usage

### Mixed Execution Modes

Combine standard and isolated agents in the same society:

```typescript
const society = Society.create()
  .withId('hybrid-society')

  // I/O-bound agent (standard)
  .addAgent((a) =>
    a
      .withId('fetcher')
      .withRole((r) => r.withSystemPrompt('Fetch data from APIs'))
      .withModel(model)
    // executionMode: default (main thread)
  )

  // CPU-bound agent (isolated)
  .addAgent((a) =>
    a
      .withId('processor')
      .withRole((r) => r.withSystemPrompt('Process data intensively'))
      .withModel(model)
      .withExecutionMode('isolated')
  )

  // I/O task → CPU task
  .addTask((t) => t.withId('fetch').withAgents(['fetcher']).thenGoto(['process']))
  .addTask((t) => t.withId('process').withAgents(['processor']))

  .execute('Fetch and process');
```

### Sequential Isolated Agents

```typescript
const society = Society.create()
  .addAgent((a) =>
    a.withId('step1').withModel(model).withExecutionMode('isolated')
  )
  .addAgent((a) =>
    a.withId('step2').withModel(model).withExecutionMode('isolated')
  )

  .addTask((t) => t.withId('t1').withAgents(['step1']).thenGoto(['t2']))
  .addTask((t) => t.withId('t2').withAgents(['step2']));

// Each agent runs in its own worker thread sequentially
```

---

## ⚠️ Limitations

### Serialization

Worker Threads require serialization of:

- Agent configuration
- Model metadata (not the actual model instance)
- Context data
- Tools (function signatures, not the functions themselves)

**Non-serializable items are excluded**, such as:

- Model client instances
- Memory objects
- Function executors

### Worker Pool Size

Default pool size: **4 workers**

Customize when creating pool manually:

```typescript
import { IsolatedWorkerPool } from 'societyai';

const pool = new IsolatedWorkerPool(8); // 8 workers
```

---

## 🧪 Testing

Worker Thread execution is fully tested:

- **Unit Tests**: `isolated-worker-pool.test.ts`
- **Integration Tests**: `execution-mode-integration.test.ts`
- **E2E Tests**: `end-to-end-features.test.ts`

Run tests:

```bash
npm test isolated-worker-pool.test.ts
```

---

## 📚 Related Documentation

- [Execution Engine](../5-architecture/execution-engine.md): How agents are executed
- [Observability](./observability.md): Monitor worker thread execution
- [OpenTelemetry](./opentelemetry.md): Trace worker thread performance

---

## ✅ Best Practices

1. **Profile First**: Identify CPU-intensive agents before using workers
2. **Mix Modes**: Use isolated mode only for CPU-bound tasks
3. **Monitor Performance**: Use OpenTelemetry to track worker overhead
4. **Keep Context Small**: Minimize data passed to workers
5. **Test Thoroughly**: Ensure serialization works for your models

---

## 🔗 Next Steps

- Learn about [OpenTelemetry Integration](./opentelemetry.md) for tracing
- Explore [MCP Support](./mcp.md) for external tools
- See [complete example](../../src/examples/complete-integration.ts)
