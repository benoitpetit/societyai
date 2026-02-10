# Memory Systems

SocietyAI provides a sophisticated, multi-layered memory architecture that
allows agents to maintain context over long conversations and across different
sessions. Rather than a simple array of messages, the system uses tiered storage
to optimize for both relevance and token usage.

## 🧠 Memory Layers

### 1. Short-Term Memory (Working Memory)

Holds the immediate context of the current interaction. It is ephemeral and
typically limited by the model's context window.

- **Storage**: In-memory array or simple cache.
- **Behavior**: FIFO (First-In-First-Out) with automatic pruning.
- **Usage**: Good for follow-up questions in a chat.

### 2. Long-Term Memory (Semantic)

Stores facts and interactions permanently using Vector Databases. It allows
agents to recall information from days or months ago.

- **Storage**: Vector Database (Pinecone, Weaviate, or local FAISS).
- **Behavior**: Semantic search (RAG - Retrieval Augmented Generation).
- **Usage**: "What did we discuss about Project X last week?"

### 3. Entity Memory

Structured storage for specific facts about entities (Users, Companies,
Products).

- **Storage**: Key-Value or Relational.
- **Behavior**: Named Entity Recognition (NER) updates these records.
- **Usage**: "My name is Ben", "I prefer Python over Java".

## 🛠️ Configuration

You can configure memory capabilities using the `MemoryBuilder`.

```typescript
import { MemoryBuilder } from 'societyai';

const memory = MemoryBuilder.create()
  // Configure Working Memory
  .withShortTermMemory({
    maxMessages: 20,
    summarizeAfter: 15, // Auto-summarize when limit approached
  })

  // Configure Semantic Search
  .withLongTermMemory({
    provider: new PineconeProvider({ apiKey: '...' }),
    embeddingModel: 'text-embedding-3-small',
    threshold: 0.8,
  })

  // Configure Entity extraction
  .withEntityMemory()
  .build();
```

## 📖 Usage in Agents

When memory is attached to an agent, it handles the context management
automatically.

```typescript
// Add memory to an agent
agent.useMemory(memory);

// Run task - Agent will:
// 1. Retrieve relevant info from LongTerm memory based on query
// 2. Fetch recent history from ShortTerm memory
// 3. Inject both into the prompt
const response = await agent.run('Do you remember my favorite color?');
```

### Manual Operations

You can also interact with the memory system directly:

```typescript
// Store a fact explicitly
await memory.save({
  content: 'User prefers dark mode',
  type: 'preference',
  tags: ['ui', 'config'],
});

// Search specifically
const results = await memory.search('ui preferences', { limit: 5 });
// returns: [{ content: "User prefers dark mode", score: 0.95 }, ...]
```

## 🔄 Persistence

To ensure Short-Term memory survives server restarts, you can provide a storage
backend.

```typescript
.withShortTermMemory({
    storage: new RedisStorage({ url: 'redis://localhost:6379' }),
    sessionId: 'user-123'
})
```
