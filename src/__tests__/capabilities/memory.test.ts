import { ShortTermMemory, EntityMemory } from '../../capabilities/memory';

describe('Memory System', () => {
  describe('ShortTermMemory', () => {
    test('should add and retrieve recent memories', () => {
      const memory = new ShortTermMemory();
      memory.add('first memory');
      memory.add('second memory');

      const recent = memory.getRecent();
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('first memory');
      expect(recent[1].content).toBe('second memory');
      expect(recent[0].id).toBeDefined();
      expect(recent[0].timestamp).toBeDefined();
    });

    test('should limit number of memories', () => {
      const memory = new ShortTermMemory({ maxMessages: 2 });
      memory.add('1');
      memory.add('2');
      memory.add('3');

      const recent = memory.getRecent();
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('2');
      expect(recent[1].content).toBe('3');
    });

    test('should search memories', () => {
      const memory = new ShortTermMemory();
      memory.add('The sun is yellow', { type: 'fact' });
      memory.add('The moon is white', { type: 'fact' });
      memory.add('Hello world', { type: 'conversation' });

      // Search by text
      const result = memory.search({ query: 'yellow' });
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toBe('The sun is yellow');

      // Search by type
      const typeResult = memory.search({ query: '', types: ['conversation'] });
      expect(typeResult.memories).toHaveLength(1);
      expect(typeResult.memories[0].content).toBe('Hello world');
    });

    test('should trigger summarization', () => {
      const memory = new ShortTermMemory({ summarizeAfter: 2 });
      memory.add('1');
      memory.add('2');
      memory.add('3'); // Trigger

      // summarize() cuts list in half (floored).
      // Initial: [1, 2, 3] (len 3)
      // summarizeAfter is 2. 3 > 2 => summarize()
      // toSummarize = slice(0, floor(1.5)) = slice(0, 1) = ['1']
      // new memories = slice(1) = ['2', '3']

      const { memories, summaries } = memory.getAll();
      expect(memories).toHaveLength(2);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toContain('Summary');
    });
  });

  describe('EntityMemory', () => {
    test('should create and retrieve entities', () => {
      const memory = new EntityMemory();
      const id = memory.upsert('Alice', 'person', ['is a developer']);

      const entity = memory.get(id);
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('Alice');
      expect(entity?.type).toBe('person');
      expect(entity?.facts).toContain('is a developer');
    });

    test('should merge facts for existing entities', () => {
      const memory = new EntityMemory();
      const id = memory.upsert('Bob', 'person', ['likes coffee']);

      memory.upsert('Bob', 'person', ['uses TypeScript']);
      // Note: updateEntity uses generateId internally if ID not passed,
      // but the method signature in the file snippet was updateEntity(nameOrId, type, facts...)
      // Wait, looking at snippet:
      // updateEntity(nameOrId: string, type: string, facts: string[], metadata?: Record<string, unknown>): string
      // inside: tries to get(nameOrId), if not found generatedId(nameOrId, type).

      // So passing 'Bob' twice with 'person' type should resolve to same ID if generateId is deterministic.
      // generateId: `${type}_${name.toLowerCase().replace(/\s+/g, '_')}`

      const entity = memory.get(id);
      expect(entity?.facts).toHaveLength(2);
      expect(entity?.facts).toContain('likes coffee');
      expect(entity?.facts).toContain('uses TypeScript');
    });

    test('should search entities', () => {
      const memory = new EntityMemory();
      memory.upsert('Paris', 'city', ['is capital of France']);
      memory.upsert('London', 'city', ['is capital of UK']);

      const results = memory.search('France');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Paris');
    });
  });
});
