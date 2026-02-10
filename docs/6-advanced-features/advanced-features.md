# Advanced Features Implementation Guide

This guide explains how to use the advanced features of SocietyAI.

## 📦 Persistence Drivers

### Redis Adapter

For distributed and high-performance scenarios:

```typescript
import Redis from 'ioredis';
import { RedisStorageAdapter } from 'societyai';
import { Society } from 'societyai';

// Required installation
// npm install ioredis

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'your-password',
});

const storage = new RedisStorageAdapter({
  client: redis,
  keyPrefix: 'myapp:society:',
  ttl: 3600, // 1 hour TTL
});

const result = await Society.create()
  .addAgent(/* ... */)
  .addTask(/* ... */)
  .execute(input, signal, undefined, undefined, undefined, storage);
```

**Use Cases:**

- Distributed multi-instance applications
- Shared state between multiple servers
- Distributed caching
- Automatic cleanup via TTL

### PostgreSQL Adapter

For robust transactional persistence:

```typescript
import { Pool } from 'pg';
import { PostgresStorageAdapter } from 'societyai';

// Required installation
// npm install pg

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password',
});

const storage = new PostgresStorageAdapter({
  pool,
  tableName: 'workflow_states',
  schemaName: 'public',
});

// Initialize schema (once)
await storage.initialize();

// Use it
const result = await Society.create()
  .addAgent(/* ... */)
  .execute(input, signal, undefined, undefined, undefined, storage);

// Advanced queries
const pausedWorkflows = await storage.listByStatus('paused');
const cleanedCount = await storage.cleanup(7); // Delete states older than 7 days
```

**Use Cases:**

- Applications requiring ACID compliance
- Complete audit trail
- Complex queries on workflow states
- Regulatory compliance

---

## 🧠 InMemoryVectorStore

A simple vector store for prototyping without external dependencies.

### Basic Usage

```typescript
import { InMemoryVectorStore } from 'societyai';

const store = new InMemoryVectorStore({
  dimensions: 1536, // OpenAI ada-002
  distance: 'cosine',
  maxEntries: 10000,
});

// Insert embeddings
await store.upsert({
  id: 'doc-1',
  vector: [0.1, 0.2, ..., 0.5], // 1536 dimensions
  metadata: {
    text: 'This is a document about AI',
    source: 'manual',
    category: 'tech',
  },
});

// Semantic search
const queryVector = await getEmbedding('user query');
const results = await store.search(queryVector, {
  topK: 5,
  threshold: 0.7,
  filter: { category: 'tech' },
});

for (const result of results) {
  console.log(`Score: ${result.score}, Text: ${result.entry.metadata.text}`);
}
```

### Integration with Memory System

```typescript
import { MemoryBuilder } from 'societyai';

// Use InMemoryVectorStore as backend
const memory = MemoryBuilder.create()
  .withLongTermMemory({
    vectorStore: store,
    embeddingModel: myEmbeddingModel,
  })
  .build();

agent.useMemory(memory);
```

**⚠️ Limitations:**

- No persistence (RAM only)
- Linear search O(n)
- Maximum ~10K vectors in practice
- Single-threaded

**Production:** Use Pinecone, Weaviate, or pgvector.

---

## 🏗️ Hierarchical Societies

Encapsulate entire societies as "models" to create hierarchical architectures.

### Complete Example

```typescript
import { Society, GraphBuilder, NodeType, EngineAsModel } from 'societyai';

// 1. Create a specialized team (Inner Society)
const codeTeamGraph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('coder', NodeType.AGENT, { agentId: 'coder-agent' })
  .addNode('tester', NodeType.AGENT, { agentId: 'tester-agent' })
  .addNode('reviewer', NodeType.AGENT, { agentId: 'reviewer-agent' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'coder')
  .addEdge('coder', 'tester')
  .addEdge('tester', 'reviewer')
  .addEdge('reviewer', 'end')
  .build();

// 2. Wrap the team as a reusable "model"
const codeTeamModel = new EngineAsModel({
  engine: codeTeamGraph,
  agents: [coderAgent, testerAgent, reviewerAgent],
  name: 'code-team',
  timeout: 300000, // 5 minutes
  onError: 'return-error-message',
});

// 3. Create a higher-level society (Manager)
const managerSociety = Society.create()
  .addAgent(
    (a) => a.withId('manager').withRole(managerRole).withModel(codeTeamModel) // ✨ Use the team as a model!
  )
  .addAgent((a) =>
    a.withId('architect').withRole(architectRole).withModel(architectModel)
  )
  .addTask((t) => t.withId('design').withAgents(['architect']).sequential())
  .addTask((t) =>
    t
      .withId('implement')
      .withAgents(['manager']) // Manager delegates to the team
      .dependsOn('design')
      .sequential()
  )
  .execute('Build a REST API for user management');
```

### Use Cases

- **Manager → Sub-teams**: Hierarchical orchestration
- **Multi-stage pipeline**: Each stage = a society
- **Domain-specific workflows**: Reusable components
- **Recursive problem solving**: Automatic decomposition

---

## ✅ Advanced Validation with Auto-Correction

The LLM corrects itself using validation errors.

### Basic Usage

```typescript
import { SelfCorrectingValidator } from 'societyai';

const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    age: { type: 'number', minimum: 0, maximum: 150 },
    role: { type: 'string', enum: ['admin', 'user', 'guest'] },
  },
  required: ['name', 'email', 'age'],
};

const validator = new SelfCorrectingValidator({
  schema: userSchema,
  model: myLLM,
  maxCorrectionAttempts: 3,
  strategy: 'guided', // or 'aggressive' or 'minimal'
  includeExamples: true,
});

try {
  const validData = await validator.validateAndCorrect(agentOutput);
  console.log('✅ Valid data:', validData);
} catch (error) {
  console.error('❌ Failed after 3 attempts:', error);
}

// Attempt history
const attempts = validator.getAttempts();
console.log(`Number of attempts: ${attempts.length}`);
```

### Correction Strategies

#### Minimal

```typescript
strategy: 'minimal';
// Provides only the JSON schema
```

#### Guided (Recommended)

```typescript
strategy: 'guided';
// Schema + detailed errors + suggestions
```

#### Aggressive

```typescript
strategy: 'aggressive';
// Schema + errors + suggestions + examples + steps
```

### Integration with Tasks

```typescript
import { createSelfCorrectingValidator } from 'societyai';

const validator = createSelfCorrectingValidator(userSchema, myLLM, {
  maxCorrectionAttempts: 5,
  strategy: 'aggressive',
});

Society.create()
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
```

---

## 🧪 Property-Based Testing

Tests that automatically generate random cases to find edge cases.

### Installation

```bash
npm install --save-dev fast-check
```

### Example Tests

```typescript
import * as fc from 'fast-check';
import {
  workflowStateArbitrary,
  vectorEmbeddingArbitrary,
} from 'societyai'; // or define your own test arbitraries

// Test: Persistence round-trip
test('save/load preserves data', async () => {
  await fc.assert(
    fc.asyncProperty(workflowStateArbitrary(), async (state) => {
      await storage.save(state.executionId, state);
      const loaded = await storage.load(state.executionId);
      expect(loaded).toEqual(state);
    }),
    { numRuns: 100 } // 100 random cases
  );
});

// Test: Vector similarity symmetry
test('similarity(a,b) === similarity(b,a)', () => {
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

✅ **Persistence**: Round-trip, FIFO eviction, list consistency  
✅ **Validation**: Determinism, schema compliance  
✅ **Vector Store**: Symmetry, bounds, FIFO  
✅ **Loops**: Iteration bounds

See `src/__tests__/integration/property-based.test.ts` for more examples.

---

## 📚 Resources

- [Persistence Drivers](../3-capabilities/persistence.md)
- [Memory Systems](../3-capabilities/memory.md)
- [Validation](../3-capabilities/validation.md)
- [Architecture Overview](../5-architecture/overview.md)
