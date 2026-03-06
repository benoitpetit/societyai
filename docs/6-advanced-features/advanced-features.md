# Advanced Features

This guide covers four advanced capabilities that go beyond the standard
SocietyAI API: production-grade storage adapters, the built-in in-memory vector
store, hierarchical societies (societies within societies), and the
self-correcting validation system.

> **API note:** `Society.create().execute()` accepts `(input, signal?)`. Storage
> adapters and persistence hooks are wired at the `ExecutionEngine` /
> `SocietyExecutor` level (low-level API). The examples below show the correct
> integration patterns for each feature.

---

## 📋 Table of Contents

- [Persistence Drivers](#persistence-drivers)
- [InMemoryVectorStore](#inmemoryvectorstore)
- [Hierarchical Societies](#hierarchical-societies)
- [Self-Correcting Validation](#self-correcting-validation)
- [Property-Based Testing](#property-based-testing)
- [Next Steps](#next-steps)

---

## 💾 Persistence Drivers

The built-in `FileStorageAdapter` covers local development and single-process
deployments. For production environments, SocietyAI provides two additional
adapters backed by popular infrastructure services.

### Redis Adapter

Ideal for distributed, multi-instance applications that need shared state and
automatic cleanup via TTL.

**Installation:**

```bash
npm install ioredis
```

```typescript
import Redis from 'ioredis';
import {
  RedisStorageAdapter,
  GraphBuilder,
  NodeType,
} from 'societyai';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
});

const storage = new RedisStorageAdapter({
  client: redis,
  keyPrefix: 'myapp:society:',
  ttl: 3600, // seconds — states expire after 1 hour
});

// Pass the adapter to the low-level ExecutionEngine
const engine = GraphBuilder.create()
  .addNode('start',  NodeType.START)
  .addNode('worker', NodeType.AGENT, { agentId: 'worker' })
  .addNode('end',    NodeType.END)
  .addEdge('start',  'worker')
  .addEdge('worker', 'end')
  .build();

const result = await engine.execute(
  input,
  agents,
  signal,
  observer,
  middlewareChain,
  storage   // ← enable Redis persistence
);
```

**Use cases:**

- Distributed multi-instance applications
- Shared state between multiple servers
- Automatic cleanup via TTL
- High-throughput workflows that outgrow the file system

---

### PostgreSQL Adapter

Ideal for applications that require ACID-compliant storage, a full audit trail,
or complex queries over workflow states.

**Installation:**

```bash
npm install pg
```

```typescript
import { Pool } from 'pg';
import { PostgresStorageAdapter, GraphBuilder, NodeType } from 'societyai';

const pool = new Pool({
  host:     'localhost',
  port:     5432,
  database: 'myapp',
  user:     'postgres',
  password: process.env.POSTGRES_PASSWORD,
});

const storage = new PostgresStorageAdapter({
  pool,
  tableName:  'workflow_states',
  schemaName: 'public',
});

// Initialise the schema once (creates the table if it doesn't exist)
await storage.initialize();

// Pass the adapter to the low-level ExecutionEngine
const engine = GraphBuilder.create()
  .addNode('start',  NodeType.START)
  .addNode('worker', NodeType.AGENT, { agentId: 'worker' })
  .addNode('end',    NodeType.END)
  .addEdge('start',  'worker')
  .addEdge('worker', 'end')
  .build();

const result = await engine.execute(
  input,
  agents,
  signal,
  observer,
  middlewareChain,
  storage   // ← enable PostgreSQL persistence
);

// Advanced queries (PostgresStorageAdapter-specific)
const pausedWorkflows = await storage.listByStatus('paused');
const cleanedCount    = await storage.cleanup(7); // delete states older than 7 days
```

**Use cases:**

- Applications requiring ACID compliance
- Complete audit trail and history
- Complex queries on workflow states
- Regulatory compliance

### Adapter Comparison

| Feature | `FileStorageAdapter` | `RedisStorageAdapter` | `PostgresStorageAdapter` |
|---|---|---|---|
| **Peer dependency** | None | `ioredis` | `pg` |
| **Distribution** | Single process | Multi-instance | Multi-instance |
| **TTL / expiry** | No | Yes | Via `cleanup()` |
| **Queries** | No | No | Yes |
| **ACID** | No | No | Yes |
| **Best for** | Dev / single server | High-throughput | Audit trail / compliance |

---

## 🧠 InMemoryVectorStore

A zero-dependency vector store for prototyping and testing without requiring an
external vector database.

### Basic Usage

```typescript
import { InMemoryVectorStore } from 'societyai';

const store = new InMemoryVectorStore({
  dimensions: 1536,      // must match your embedding model's output size
  distance:   'cosine',  // 'cosine' | 'euclidean' | 'dot'
  maxEntries: 10_000,
});

// Insert vectors
await store.upsert({
  id:     'doc-1',
  vector: embeddingVector, // Float32Array or number[] of `dimensions` length
  metadata: {
    text:     'This is a document about AI',
    source:   'manual',
    category: 'tech',
  },
});

// Semantic similarity search
const queryVector = await getEmbedding('user query');
const results = await store.search(queryVector, {
  topK:      5,
  threshold: 0.7,
  filter:    { category: 'tech' }, // optional metadata filter
});

for (const result of results) {
  console.log(`Score: ${result.score.toFixed(3)} — ${result.entry.metadata.text}`);
}
```

### Integration with the Memory System

Use `VectorStoreAdapter` to bridge `InMemoryVectorStore` with SocietyAI's
`MemoryBuilder`:

```typescript
import { MemoryBuilder, InMemoryVectorStore, VectorStoreAdapter } from 'societyai';

const vectorStore = new InMemoryVectorStore({
  dimensions: 1536,
  distance:   'cosine',
  maxEntries: 10_000,
});

const memory = MemoryBuilder.create()
  .withLongTermMemory({
    vectorStore:    new VectorStoreAdapter(vectorStore),
    embeddingModel: myEmbeddingModel,
    threshold:      0.75,
  })
  .build();

// Attach to an agent
Society.create()
  .addAgent((a) =>
    a
      .withId('assistant')
      .withRole((r) => r.withSystemPrompt('You are a helpful assistant.'))
      .withModel(model)
      .withMemory(memory)
  )
  .execute(input);
```

### API Reference

| Method | Description |
|---|---|
| `upsert(entry)` | Insert or update a vector entry by ID. |
| `search(vector, options)` | Return the top-K most similar entries above `threshold`. |
| `delete(id)` | Remove an entry by ID. |
| `clear()` | Remove all entries. |
| `size()` | Return the current number of stored entries. |

### Limitations

> **⚠️ Not suitable for production workloads.**
>
> - **No persistence** — all data is lost when the process exits.
> - **Linear search O(n)** — performance degrades beyond ~10 000 vectors.
> - **Single-threaded** — not safe for concurrent writes without external locking.
>
> For production, use [Pinecone](https://www.pinecone.io/),
> [Weaviate](https://weaviate.io/), or
> [pgvector](https://github.com/pgvector/pgvector).

---

## 🏗️ Hierarchical Societies

SocietyAI allows you to encapsulate an entire `ExecutionEngine` as an `AIModel`
using `EngineAsModel`. This means a parent Society can treat a whole team of
agents as a single intelligent "model", enabling composable, nested
orchestration patterns.

### How It Works

```
Parent Society
└── Manager Agent
    └── model = EngineAsModel (wraps Inner Society)
                └── Inner Society (Coder → Tester → Reviewer)
```

The parent agent calls `model.process(prompt)` — but instead of an LLM
responding, an entire inner workflow executes and its final output is returned
as the "model response".

### Complete Example

```typescript
import {
  Society,
  GraphBuilder,
  NodeType,
  EngineAsModel,
  createAgent,
  createRole,
} from 'societyai';

// ── 1. Define the inner team ─────────────────────────────────────────────────
const coderAgent    = createAgent('coder-agent',    coderRole,    devModel);
const testerAgent   = createAgent('tester-agent',   testerRole,   devModel);
const reviewerAgent = createAgent('reviewer-agent', reviewerRole, devModel);

const codeTeamGraph = GraphBuilder.create()
  .addNode('start',    NodeType.START)
  .addNode('coder',    NodeType.AGENT, { agentId: 'coder-agent' })
  .addNode('tester',   NodeType.AGENT, { agentId: 'tester-agent' })
  .addNode('reviewer', NodeType.AGENT, { agentId: 'reviewer-agent' })
  .addNode('end',      NodeType.END)
  .addEdge('start',    'coder')
  .addEdge('coder',    'tester')
  .addEdge('tester',   'reviewer')
  .addEdge('reviewer', 'end')
  .build();

// ── 2. Wrap the inner team as a reusable "model" ─────────────────────────────
const codeTeamModel = new EngineAsModel({
  engine:  codeTeamGraph,
  agents:  [coderAgent, testerAgent, reviewerAgent],
  name:    'code-team',
  timeout: 300_000,              // 5-minute timeout for the inner workflow
  onError: 'return-error-message', // propagate errors as text rather than throwing
});

// ── 3. Create the parent society ─────────────────────────────────────────────
const result = await Society.create()
  .addAgent((a) =>
    a
      .withId('architect')
      .withRole((r) =>
        r.withSystemPrompt('You design system architecture.')
      )
      .withModel(architectModel)
  )
  .addAgent((a) =>
    a
      .withId('manager')
      .withRole((r) =>
        r.withSystemPrompt(
          'You manage the development team and delegate implementation tasks.'
        )
      )
      .withModel(codeTeamModel)   // ← the whole inner team is "the model"
  )

  .addTask((t) =>
    t
      .withId('design')
      .withAgents(['architect'])
      .withInstructions('Design the API endpoints and data models.')
      .sequential()
      .thenGoto('implement')
  )
  .addTask((t) =>
    t
      .withId('implement')
      .withAgents(['manager'])
      .withInstructions('Implement the designed API. Produce working TypeScript code.')
      .sequential()
  )

  .execute('Build a REST API for user management');

console.log('Final output:', result.output);
```

### `EngineAsModel` Configuration

```typescript
interface EngineAsModelConfig {
  /** The ExecutionEngine to use as the model. */
  engine: ExecutionEngine;

  /** The agents available inside the inner workflow. */
  agents: Agent[];

  /** A name for this composite model (used in logs and traces). */
  name: string;

  /** Timeout in milliseconds for the inner workflow execution. */
  timeout?: number;

  /**
   * Error handling strategy:
   * - 'throw'                : Re-throws any error from the inner workflow.
   * - 'return-error-message' : Returns the error message as a string response.
   */
  onError?: 'throw' | 'return-error-message';
}
```

### Use Cases

| Pattern | Description |
|---|---|
| **Manager → Sub-teams** | Hierarchical orchestration where each team is a self-contained society. |
| **Multi-stage pipeline** | Each pipeline stage is a full inner society with its own agents. |
| **Domain-specific modules** | Reusable inner societies for recurring sub-tasks (e.g., a "research team"). |
| **Recursive problem solving** | Outer agents automatically decompose problems and delegate to inner workflows. |

---

## ✅ Self-Correcting Validation

The `SelfCorrectingValidator` extends the basic `StructuredOutputValidator` by
using the LLM itself to repair invalid outputs. Instead of just detecting
schema violations, it constructs a targeted correction prompt and asks the model
to fix its own response.

### Basic Usage

```typescript
import { SelfCorrectingValidator } from 'societyai';

const userSchema = {
  type: 'object',
  properties: {
    name:  { type: 'string', minLength: 2 },
    email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    age:   { type: 'number', minimum: 0, maximum: 150 },
    role:  { type: 'string', enum: ['admin', 'user', 'guest'] },
  },
  required: ['name', 'email', 'age'],
};

const validator = new SelfCorrectingValidator({
  schema:                 userSchema,
  model:                  myLLM,
  maxCorrectionAttempts:  3,
  strategy:               'guided',   // 'minimal' | 'guided' | 'aggressive'
  includeExamples:        true,
});

try {
  const validData = await validator.validateAndCorrect(agentOutput);
  console.log('✅ Valid data:', validData);
} catch (error) {
  console.error('❌ Failed after max correction attempts:', error);
}

// Inspect the correction history
const attempts = validator.getAttempts();
console.log(`Correction attempts: ${attempts.length}`);
attempts.forEach((a, i) =>
  console.log(`  [${i + 1}] valid=${a.valid}, errors=${a.errors?.join(', ')}`)
);
```

### Correction Strategies

| Strategy | What is sent to the model | When to Use |
|---|---|---|
| `'minimal'` | Schema + list of validation errors only. | Simple schemas; model is well-prompted to return JSON. |
| `'guided'` *(recommended)* | Schema + errors + targeted correction hints per field. | Most use cases — good balance of guidance and token efficiency. |
| `'aggressive'` | Schema + errors + hints + valid examples + step-by-step instructions. | Complex schemas or when the model repeatedly fails to self-correct. |

### Integration with Tasks

Use `transformResults` to apply self-correcting validation as a post-processing
step on any task:

```typescript
import { Society, createSelfCorrectingValidator } from 'societyai';

const validator = createSelfCorrectingValidator(userSchema, myLLM, {
  maxCorrectionAttempts: 5,
  strategy:              'aggressive',
  includeExamples:       true,
});

const result = await Society.create()
  .addAgent((a) =>
    a
      .withId('extractor')
      .withRole((r) =>
        r.withSystemPrompt(
          'You extract structured user data from unstructured text. ' +
          'Always respond with a single JSON object.'
        )
      )
      .withModel(model)
  )
  .addTask((t) =>
    t
      .withId('extract-user-data')
      .withAgents(['extractor'])
      .sequential()
      .transformResults(async (results) => {
        const output = results[0].output;
        return await validator.validateAndCorrect(output);
      })
  )
  .execute(inputText);

const user = JSON.parse(result.output); // guaranteed valid JSON
```

### `createSelfCorrectingValidator()` Factory

```typescript
import { createSelfCorrectingValidator } from 'societyai';

const validator = createSelfCorrectingValidator(
  schema,   // JSON Schema object
  model,    // AIModel instance
  {
    maxCorrectionAttempts: 3,
    strategy:              'guided',
    includeExamples:       false,
  }
);
```

---

## 🧪 Property-Based Testing

SocietyAI's own test suite uses property-based testing via
[`fast-check`](https://github.com/dubzzz/fast-check) to automatically generate
random inputs and surface edge cases that hand-written tests miss.

**Installation:**

```bash
npm install --save-dev fast-check
```

### Example: Persistence Round-Trip

```typescript
import * as fc from 'fast-check';

// Test: save → load preserves state exactly
test('save/load round-trip preserves all fields', async () => {
  await fc.assert(
    fc.asyncProperty(workflowStateArbitrary(), async (state) => {
      await storage.save(state.executionId, state);
      const loaded = await storage.load(state.executionId);
      expect(loaded).toEqual(state);
      await storage.delete(state.executionId); // cleanup
    }),
    { numRuns: 100 }
  );
});
```

### Example: Vector Similarity Symmetry

```typescript
import * as fc from 'fast-check';
import { InMemoryVectorStore } from 'societyai';

test('cosine similarity is symmetric: sim(a,b) === sim(b,a)', () => {
  const store = new InMemoryVectorStore({ dimensions: 128 });

  fc.assert(
    fc.property(
      vectorEmbeddingArbitrary(128),
      vectorEmbeddingArbitrary(128),
      (vec1, vec2) => {
        const score1 = store['cosineSimilarity'](vec1, vec2);
        const score2 = store['cosineSimilarity'](vec2, vec1);
        expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Tested Properties

| Module | Properties Verified |
|---|---|
| **Persistence** | Round-trip fidelity, FIFO eviction, list consistency |
| **Validation** | Determinism, schema compliance across random inputs |
| **Vector Store** | Similarity symmetry, score bounds (0–1), FIFO eviction |
| **Loops** | Iteration count never exceeds `maxIterations` |

See `src/__tests__/integration/property-based.test.ts` for the full suite.

---

## 📚 Next Steps

- **[Persistence](../3-capabilities/persistence.md)** — Core persistence
  concepts, `FileStorageAdapter`, Human-in-the-Loop, and `WorkflowState`
  structure.
- **[Memory Systems](../3-capabilities/memory.md)** — `MemoryBuilder`
  configuration, the three memory layers, and `InMemoryVectorStore` integration.
- **[Validation](../3-capabilities/validation.md)** — Basic `StructuredOutputValidator`,
  JSON Schema definitions, and Zod integration.
- **[Execution Engine](../5-architecture/execution-engine.md)** — `EngineAsModel`,
  `GraphBuilder`, and the full node type reference.
- **[Architecture Overview](../5-architecture/overview.md)** — High-level
  architectural map showing how all components fit together.
- **[Reference Index](../reference/index.md)** — Complete list of all public
  exports including `RedisStorageAdapter`, `PostgresStorageAdapter`,
  `InMemoryVectorStore`, `EngineAsModel`, and `SelfCorrectingValidator`.