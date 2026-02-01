# Memory System

The Memory System provides intelligent context management for AI agents with three levels of memory: short-term, long-term, and entity-based. This enables agents to maintain conversation context, recall important facts, and track entities across interactions.

## Overview

The Memory System provides:

- **ShortTermMemory**: Recent conversation context with automatic decay
- **LongTermMemory**: Persistent facts with semantic search (RAG support)
- **EntityMemory**: Track entities (people, places, objects) and their facts
- **Unified Interface**: MemorySystem combines all three levels
- **Auto-Summarization**: Automatic summarization of long conversations
- **Importance Scoring**: Track memory importance for prioritization
- **RAG Integration**: Optional vector database integration for semantic search

## Core Components

### MemoryItem

Base structure for all memories:

```typescript
interface MemoryItem {
  id: string; // Unique identifier
  content: string; // Memory content
  timestamp: number; // Creation time
  importance: number; // Importance score (0-1)
  metadata?: Record<string, unknown>; // Additional data
}
```

### ShortTermMemory

Manages recent conversation context:

```typescript
import { ShortTermMemory } from 'societyai';

const memory = new ShortTermMemory({
  maxMessages: 20, // Max messages to keep
  summarizeAfter: 50, // Summarize after N messages
  decayRate: 0.1, // Importance decay rate
});

// Add messages
memory.add('User asked about weather');
memory.add('Agent provided weather info');

// Retrieve recent messages
const recent = memory.getRecent(10); // Last 10 messages

// Search by content
const results = memory.search('weather');

// Filter by metadata
const important = memory.filter({ type: 'important' });

// Clear all
memory.clear();

// Get statistics
const stats = memory.getStats();
console.log(stats); // { messages: 2, avgImportance: 0.5, oldestTimestamp: ... }
```

### LongTermMemory

Stores persistent facts with optional semantic search:

```typescript
import { LongTermMemory } from 'societyai';

const memory = new LongTermMemory({
  maxEntries: 1000, // Max entries to store
  pruneStrategy: 'lru', // or 'importance', 'oldest'
  provider: vectorDB, // Optional RAG provider
});

// Add facts
const id1 = await memory.add('Paris is the capital of France', {
  type: 'fact',
  importance: 0.9,
});

const id2 = await memory.add('The Eiffel Tower is in Paris', {
  type: 'fact',
  related: ['paris', 'landmarks'],
});

// Retrieve by query (semantic search if provider available)
const result = await memory.retrieve({
  query: 'French capital city',
  limit: 5,
});

console.log(result.memories); // Relevant memories
console.log(result.scores); // Relevance scores

// Get specific memory
const fact = await memory.get(id1);

// Delete memory
await memory.delete(id1);

// Clear all
await memory.clear();

// Statistics
const stats = memory.getStats();
```

### EntityMemory

Track entities and their associated facts:

```typescript
import { EntityMemory } from 'societyai';

const memory = new EntityMemory({
  maxEntities: 500,
});

// Upsert entity (create or update)
memory.upsert({
  name: 'Alice',
  type: 'person',
  facts: ['Works at TechCorp', 'Lives in Paris', 'Knows Python'],
});

// Update existing entity
memory.upsert({
  name: 'Alice',
  type: 'person',
  facts: ['Works at TechCorp', 'Lives in Paris', 'Knows Python', 'Attended AI conference'],
});

// Get entity
const alice = memory.get('Alice');

// Search entities
const people = memory.search('python'); // Entities with 'python' in facts

// Filter by type
const allPeople = memory.getByType('person');

// Delete entity
memory.delete('Alice');

// Statistics
const stats = memory.getStats();
console.log(stats); // { total: 1, byType: { person: 1 } }
```

### MemorySystem

Unified interface combining all memory types:

```typescript
import { MemoryBuilder } from 'societyai';

// Create integrated memory system
const memory = MemoryBuilder.create()
  .withShortTermMemory({
    maxMessages: 20,
    decayRate: 0.1,
  })
  .withLongTermMemory({
    maxEntries: 1000,
    pruneStrategy: 'importance',
  })
  .withEntityMemory({
    maxEntities: 500,
  })
  .build();

// Add to appropriate memory level
await memory.add('User greeted', { type: 'conversation' }); // Short-term
await memory.add('Important fact about X', { type: 'fact', importance: 0.9 }); // Long-term

// Retrieve combined context
const context = await memory.retrieve('conversation about X', {
  includeShortTerm: true,
  includeLongTerm: true,
  includeEntities: true,
  limit: 10,
});

console.log(context);
// Output:
// ## Recent Context
// User greeted
// ...
//
// ## Relevant Facts
// Important fact about X
// ...
//
// ## Related Entities
// X (concept): fact1, fact2

// Get all statistics
const stats = memory.getStats();
console.log(stats);
// {
//   shortTerm: { messages: 5, avgImportance: 0.5 },
//   longTerm: { total: 100, avgImportance: 0.7 },
//   entities: { total: 20, byType: { person: 10, place: 5 } }
// }

// Clear all memory
await memory.clearAll();
```

## Complete Example

```typescript
import { MemoryBuilder, StandardModelBase } from 'societyai';

// Create memory-aware agent
class MemoryAwareAgent extends StandardModelBase {
  constructor(
    private memory: MemorySystem,
    name: string
  ) {
    super({ name }, async (prompt: unknown) => {
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

      // Retrieve relevant context
      const context = await this.memory.retrieve(promptStr, {
        includeShortTerm: true,
        includeLongTerm: true,
        limit: 5,
      });

      // Add context to prompt
      const enhancedPrompt = `
Context from memory:
${context}

User: ${promptStr}
      `;

      // Process with context
      const response = `Response considering: ${context}`;

      // Store interaction
      await this.memory.add(promptStr, {
        type: 'conversation',
        importance: 0.5,
      });

      await this.memory.add(response, {
        type: 'conversation',
        importance: 0.5,
      });

      return response;
    });
  }
}

// Setup
const memory = MemoryBuilder.create()
  .withShortTermMemory({ maxMessages: 20 })
  .withLongTermMemory({ maxEntries: 1000 })
  .withEntityMemory({ maxEntities: 500 })
  .build();

const agent = new MemoryAwareAgent(memory, 'assistant');

// Use agent
await agent.process('Hello!');
await agent.process('What did we just talk about?');
// Agent can recall the greeting from short-term memory
```

## Auto-Summarization

ShortTermMemory automatically summarizes old messages:

```typescript
const memory = new ShortTermMemory({
  maxMessages: 10,
  summarizeAfter: 20,
  summarizer: async (messages) => {
    // Custom summarization logic
    return `Summary of ${messages.length} messages: ...`;
  },
});

// After 20 messages, older messages are summarized
for (let i = 0; i < 25; i++) {
  memory.add(`Message ${i}`);
}

// Recent messages + summary available
const recent = memory.getRecent(10);
const summary = memory.getSummary();
```

## Importance Scoring

Memories can have importance scores that affect retrieval:

```typescript
// High importance
await memory.add('Critical system update', {
  type: 'alert',
  importance: 1.0,
});

// Medium importance
await memory.add('User preference noted', {
  type: 'setting',
  importance: 0.6,
});

// Low importance
await memory.add('Casual greeting', {
  type: 'conversation',
  importance: 0.2,
});

// Retrieve prioritizes high importance
const important = memory.filter({ importance: { min: 0.7 } });
```

## Time-Based Decay

ShortTermMemory importance decays over time:

```typescript
const memory = new ShortTermMemory({
  maxMessages: 100,
  decayRate: 0.1, // Decay 10% per hour
});

memory.add('Important message', { importance: 1.0 });

// After 1 hour, importance is ~0.9
// After 10 hours, importance is ~0.35
// Older messages naturally become less important
```

## RAG Integration

Integrate vector databases for semantic search:

```typescript
interface VectorProvider {
  add(id: string, text: string, embedding: number[]): Promise<void>;
  search(embedding: number[], limit: number): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
}

class PineconeProvider implements VectorProvider {
  // Implementation using Pinecone
  async add(id: string, text: string, embedding: number[]): Promise<void> {
    // Store in Pinecone
  }

  async search(embedding: number[], limit: number): Promise<SearchResult[]> {
    // Search Pinecone
    return [];
  }

  async delete(id: string): Promise<void> {
    // Delete from Pinecone
  }
}

// Use with long-term memory
const memory = new LongTermMemory({
  maxEntries: 10000,
  provider: new PineconeProvider(),
});

// Searches use semantic similarity
const results = await memory.retrieve({
  query: 'artificial intelligence applications',
  limit: 5,
});
```

## Entity Tracking Example

Track conversation participants and subjects:

```typescript
const memory = new EntityMemory({ maxEntities: 1000 });

// Track people
memory.upsert({
  name: 'Alice',
  type: 'person',
  facts: ['Software engineer', 'Interested in AI', 'Asked about memory systems'],
});

memory.upsert({
  name: 'Bob',
  type: 'person',
  facts: ['Project manager', 'Managing AI project', 'Needs documentation'],
});

// Track projects
memory.upsert({
  name: 'Project X',
  type: 'project',
  facts: ['AI-powered analytics', 'Led by Bob', 'Team includes Alice'],
});

// Search related entities
const team = memory.search('AI project');
// Returns: Alice, Bob, Project X
```

## Memory Pruning Strategies

Control how long-term memory is pruned when full:

```typescript
// Least Recently Used (LRU)
const lruMemory = new LongTermMemory({
  maxEntries: 100,
  pruneStrategy: 'lru',
});

// By importance (keep most important)
const importanceMemory = new LongTermMemory({
  maxEntries: 100,
  pruneStrategy: 'importance',
});

// Oldest first (FIFO)
const fifoMemory = new LongTermMemory({
  maxEntries: 100,
  pruneStrategy: 'oldest',
});
```

## Integration with Graph

Use memory in graph-based workflows:

```typescript
const memory = MemoryBuilder.create()
  .withShortTermMemory({ maxMessages: 20 })
  .withLongTermMemory({ maxEntries: 1000 })
  .build();

// Create memory-aware agent
const agent = AgentBuilder.create()
  .withId('memory-agent')
  .withRole(role)
  .withModel(new MemoryAwareModel(memory))
  .build();

// Use in graph
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent', NodeType.AGENT, { agentId: 'memory-agent' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent')
  .addEdge('agent', 'end')
  .build();

const result = await graph.execute('User input', [agent]);
```

## Best Practices

1. **Choose Right Memory Level**:
   - Short-term: Conversations, temporary context
   - Long-term: Facts, knowledge, persistent data
   - Entity: People, places, objects being discussed

2. **Set Importance**: Assign meaningful importance scores to prioritize memories

3. **Use Metadata**: Tag memories with metadata for easy filtering

4. **Regular Cleanup**: Clear old memories to maintain performance

5. **RAG for Scale**: Use vector databases for large knowledge bases

6. **Monitor Stats**: Track memory usage with getStats()

7. **Summarize Wisely**: Implement meaningful summarization for conversations

8. **Entity Normalization**: Normalize entity names (e.g., "Alice" vs "alice")

## Next Steps

- See [Graph Execution](./graph-execution.md) for complex workflows
- See [Tool Calling](./tool-calling.md) for external interactions
- See [Structured Output](./structured-output.md) for validation
- See [Examples](./examples.md) for complete implementations
