# Memory Systems

SocietyAI provides a sophisticated, multi-layered memory architecture that
allows agents to maintain context over long conversations and across different
sessions. Rather than a simple array of messages, the system uses tiered storage
to optimise for both relevance and token usage.

---

## 📋 Table of Contents

- [Memory Layers](#memory-layers)
- [Configuration](#configuration)
- [Usage in Agents](#usage-in-agents)
- [Manual Operations](#manual-operations)
- [Persistence](#persistence)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🧠 Memory Layers

SocietyAI's memory system is composed of three complementary layers, each
optimised for a different access pattern.

### 1. Short-Term Memory (Working Memory)

Holds the immediate context of the current interaction. It is ephemeral and
typically bounded by the model's context window.

| Property | Details |
|---|---|
| **Storage** | In-memory array or simple cache |
| **Eviction** | FIFO (First-In-First-Out) with automatic pruning |
| **Best For** | Follow-up questions within a single session |

### 2. Long-Term Memory (Semantic)

Stores facts and interactions permanently using vector embeddings. Enables
agents to recall information from days or months ago via semantic similarity
search.

| Property | Details |
|---|---|
| **Storage** | Vector database (Pinecone, Weaviate, local FAISS, or `InMemoryVectorStore`) |
| **Retrieval** | Semantic search (RAG — Retrieval-Augmented Generation) |
| **Best For** | *"What did we discuss about Project X last week?"* |

### 3. Entity Memory

Structured storage for specific facts about named entities (users, companies,
products). Updated automatically via Named Entity Recognition (NER).

| Property | Details |
|---|---|
| **Storage** | Key-value or relational store |
| **Retrieval** | Direct lookup by entity name |
| **Best For** | *"My name is Ben"*, *"I prefer Python over Java"* |

---

## 🛠️ Configuration

Configure memory capabilities using the `MemoryBuilder`.

```typescript
import { MemoryBuilder } from 'societyai';

const memory = MemoryBuilder.create()
  // ── Working Memory ──────────────────────────────────────────────────────────
  .withShortTermMemory({
    maxMessages: 20,
    summarizeAfter: 15, // auto-summarise when approaching the limit
  })

  // ── Semantic Search (Long-Term) ─────────────────────────────────────────────
  .withLongTermMemory({
    provider: new PineconeProvider({ apiKey: process.env.PINECONE_API_KEY }),
    embeddingModel: 'text-embedding-3-small',
    threshold: 0.8, // minimum similarity score to include a result
  })

  // ── Entity Extraction ───────────────────────────────────────────────────────
  .withEntityMemory()

  .build();
```

### Using the Built-in `InMemoryVectorStore`

For prototyping or testing without an external vector database, use the
built-in `InMemoryVectorStore`:

```typescript
import { MemoryBuilder, InMemoryVectorStore, VectorStoreAdapter } from 'societyai';

const vectorStore = new InMemoryVectorStore({
  dimensions: 1536,       // match your embedding model's output size
  distance: 'cosine',
  maxEntries: 10_000,
});

const memory = MemoryBuilder.create()
  .withLongTermMemory({
    vectorStore: new VectorStoreAdapter(vectorStore),
    embeddingModel: myEmbeddingModel,
    threshold: 0.75,
  })
  .build();
```

> **⚠️ Limitation:** `InMemoryVectorStore` is RAM-only, uses linear O(n) search,
> and is not suitable for production workloads beyond ~10 000 vectors. For
> production, use Pinecone, Weaviate, or pgvector.

---

## 📖 Usage in Agents

Attach a memory system to an agent via `.withMemory()`. Once attached, the
agent automatically:

1. Retrieves relevant entries from Long-Term memory based on the current input.
2. Fetches recent messages from Short-Term memory.
3. Injects both into the prompt via the `{memory}` placeholder.

```typescript
import { Society, createAgent } from 'societyai';

const agent = createAgent('assistant', assistantRole, model, {
  memory,
});

// Or inline via the builder
Society.create()
  .addAgent((a) =>
    a
      .withId('assistant')
      .withRole((r) =>
        r.withSystemPrompt('You are a helpful assistant with memory.')
      )
      .withModel(model)
      .withMemory(memory)   // ← attach memory
  )
  .addTask((t) =>
    t.withId('chat').withAgents(['assistant']).sequential()
  )
  .execute('Do you remember my favourite colour?');
```

### Prompt Integration

Use the `{memory}` placeholder in your role's prompt template to control where
memory is injected:

```typescript
const role = createRole('assistant')
  .withSystemPrompt('You are a helpful assistant.')
  .withPromptTemplate(`
{system}

Relevant Memory:
{memory}

Current Request:
{input}
`);
```

If `{memory}` is omitted from the template, memory content is appended
automatically before `{input}`.

---

## 🔧 Manual Operations

You can interact with the memory system directly for explicit store and search
operations.

### Storing a Fact

```typescript
await memory.save({
  content: 'User prefers dark mode and TypeScript over JavaScript.',
  type: 'preference',
  tags: ['ui', 'config', 'language'],
});
```

### Searching by Semantic Similarity

```typescript
const results = await memory.search('UI preferences', { limit: 5 });
// Returns: [{ content: "User prefers dark mode...", score: 0.95 }, ...]

for (const entry of results) {
  console.log(`Score: ${entry.score.toFixed(2)} — ${entry.content}`);
}
```

### Clearing Memory

```typescript
// Clear short-term memory only
await memory.shortTerm?.clear();

// Clear all memory layers
await memory.clear();
```

---

## 🔄 Persistence

By default, Short-Term memory is lost when the process exits. To persist it
across restarts, provide a storage backend:

```typescript
import { MemoryBuilder } from 'societyai';

const memory = MemoryBuilder.create()
  .withShortTermMemory({
    maxMessages: 50,
    storage: new RedisStorage({ url: 'redis://localhost:6379' }),
    sessionId: 'user-session-abc123',   // scopes memory to a specific session
  })
  .build();
```

Long-Term memory is inherently persistent because it writes to an external
vector database.

---

## ✅ Best Practices

1. **Start with Short-Term only** — Add Long-Term memory only when agents need
   to recall information across separate sessions or large conversation
   histories.

2. **Choose the right embedding model** — The quality of Long-Term memory
   retrieval depends entirely on your embedding model. Use a model with
   sufficient dimensions for your domain (e.g., `text-embedding-3-small` for
   general use, a domain-specific model for specialised tasks).

3. **Set a similarity threshold** — A threshold of `0.75–0.85` is usually a
   good starting point. Too low and you get irrelevant results; too high and you
   miss useful context.

4. **Keep stored facts concise** — Long, verbose memory entries reduce retrieval
   precision. Store atomic facts or short summaries rather than raw agent
   outputs.

5. **Scope sessions with `sessionId`** — When building multi-user systems,
   always scope Short-Term memory with a unique `sessionId` to prevent context
   bleed between users.

6. **Use `InMemoryVectorStore` for testing only** — Replace it with a real
   vector database before moving to production.

---

## 📚 Next Steps

- **[Tools & Functions](./tools-functions.md)** — Combine memory with tools to
  give agents both recall and the ability to act.
- **[Prompt Templates](../2-building-societies/prompts.md)** — Control exactly
  how and where memory is injected into agent prompts.
- **[Advanced Features](../6-advanced-features/advanced-features.md)** — Full
  `InMemoryVectorStore` API, `VectorStoreAdapter`, and production vector store
  integration.
- **[Persistence](./persistence.md)** — Persist Short-Term memory across process
  restarts with `RedisStorage` or `FileStorage`.
- **[Observability](../4-advanced/observability.md)** — Inspect memory
  retrieval events in real time via the event system.