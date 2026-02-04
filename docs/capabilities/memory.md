# Memory System

SocietyAI includes a multi-tiered memory system for long-running context and state management.

## `ShortTermMemory`

Manages conversational history with automatic summarization.

```typescript
import { ShortTermMemory } from 'societyai';

const memory = new ShortTermMemory({
  maxMessages: 50,
  summarizeAfter: 100
});

memory.add('User Input');
const recent = memory.getRecent();
```

## `EntityMemory`

Tracks facts about specific entities (users, places, concepts).

```typescript
import { EntityMemory } from 'societyai';

const entities = new EntityMemory();
entities.upsert('Alice', 'User', ['Is a developer']);
const alice = entities.get('Alice');
```

## `MemoryBuilder`

```typescript
import { MemoryBuilder } from 'societyai';

const memory = MemoryBuilder.create()
  .withShortTerm({ maxSize: 100 })
  .withLongTerm({
    vectorProvider: myVectorDB,
    maxResults: 5
  })
  .withEntityTracking()
  .build();
```

## `MemorySystem`

### Methods

- **`addEntry(entry: MemoryEntry)`**: Adds an entry to memory.
- **`query(query: MemoryQuery)`**: Searches in memory.
- **`clear()`**: Clears memory.
- **`getShortTermMemory()`**: Gets short-term memory.
- **`getLongTermMemory()`**: Gets long-term memory.
- **`getEntityMemory()`**: Gets entity memory.
