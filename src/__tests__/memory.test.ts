/**
 * Tests for Memory System
 */

import {
  MemoryBuilder,
  ShortTermMemory,
  LongTermMemory,
  EntityMemory,
} from '..';

describe('Memory System', () => {
  describe('ShortTermMemory', () => {
    let memory: ShortTermMemory;

    beforeEach(() => {
      memory = new ShortTermMemory({
        maxMessages: 10,
        summarizeAfter: 20,
      });
    });

    it('should add and retrieve memories', () => {
      memory.add('Test message 1');
      memory.add('Test message 2');

      const recent = memory.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Test message 1');
    });

    it('should limit recent messages', () => {
      for (let i = 0; i < 15; i++) {
        memory.add(`Message ${i}`);
      }

      const recent = memory.getRecent(5);
      expect(recent).toHaveLength(5);
    });

    it('should search memories', () => {
      memory.add('TypeScript is great');
      memory.add('JavaScript is popular');
      memory.add('Python is versatile');

      const results = memory.search({ query: 'TypeScript' });
      expect(results.memories).toHaveLength(1);
      expect(results.memories[0].content).toContain('TypeScript');
    });

    it('should filter by importance', () => {
      memory.add('Low importance', { importance: 0.3 });
      memory.add('High importance', { importance: 0.9 });

      const results = memory.search({
        query: '',
        minImportance: 0.5,
      });

      expect(results.memories).toHaveLength(1);
      expect(results.memories[0].content).toBe('High importance');
    });

    it('should filter by time range', () => {
      const now = Date.now();
      memory.add('Old message');

      // Wait a bit
      setTimeout(() => {
        memory.add('New message');

        const results = memory.search({
          query: '',
          timeRange: { start: now },
        });

        expect(results.memories).toHaveLength(1);
        expect(results.memories[0].content).toBe('New message');
      }, 10);
    });

    it('should clear memories', () => {
      memory.add('Message 1');
      memory.add('Message 2');

      memory.clear();

      const all = memory.getAll();
      expect(all.memories).toHaveLength(0);
    });
  });

  describe('LongTermMemory', () => {
    let memory: LongTermMemory;

    beforeEach(() => {
      memory = new LongTermMemory({ maxEntries: 100 });
    });

    it('should add and retrieve memories', async () => {
      const id = await memory.add('Test fact');
      const retrieved = memory.get(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Test fact');
    });

    it('should search memories', async () => {
      await memory.add('TypeScript is a typed superset');
      await memory.add('JavaScript runs in browsers');

      const results = await memory.retrieve({ query: 'TypeScript' });
      expect(results.memories.length).toBeGreaterThan(0);
    });

    it('should delete memories', async () => {
      const id = await memory.add('To be deleted');
      await memory.delete(id);

      const retrieved = memory.get(id);
      expect(retrieved).toBeUndefined();
    });

    it('should get statistics', async () => {
      await memory.add('Fact 1', { type: 'technical' });
      await memory.add('Fact 2', { type: 'business' });

      const stats = memory.getStats();
      expect(stats.total).toBe(2);
    });

    it('should clear all memories', async () => {
      await memory.add('Fact 1');
      await memory.add('Fact 2');

      await memory.clear();

      const stats = memory.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('EntityMemory', () => {
    let memory: EntityMemory;

    beforeEach(() => {
      memory = new EntityMemory();
    });

    it('should create and retrieve entities', () => {
      const id = memory.upsert('John Doe', 'person', ['Software engineer']);
      const entity = memory.get(id);

      expect(entity).toBeDefined();
      expect(entity?.name).toBe('John Doe');
      expect(entity?.facts).toContain('Software engineer');
    });

    it('should update existing entities', () => {
      memory.upsert('John Doe', 'person', ['Fact 1']);
      memory.upsert('John Doe', 'person', ['Fact 2']);

      const entity = memory.get('John Doe', 'person');
      expect(entity?.facts).toHaveLength(2);
      expect(entity?.facts).toContain('Fact 1');
      expect(entity?.facts).toContain('Fact 2');
    });

    it('should search entities', () => {
      memory.upsert('TypeScript', 'language', ['Statically typed']);
      memory.upsert('JavaScript', 'language', ['Dynamically typed']);

      const results = memory.search('TypeScript');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('TypeScript');
    });

    it('should filter by type', () => {
      memory.upsert('Alice', 'person', ['Developer']);
      memory.upsert('React', 'framework', ['UI library']);

      const people = memory.getByType('person');
      expect(people).toHaveLength(1);
      expect(people[0].name).toBe('Alice');
    });

    it('should delete entities', () => {
      const id = memory.upsert('Test', 'test', ['fact']);
      memory.delete(id);

      const entity = memory.get(id);
      expect(entity).toBeUndefined();
    });

    it('should get statistics', () => {
      memory.upsert('Entity1', 'type1', ['fact']);
      memory.upsert('Entity2', 'type2', ['fact']);

      const stats = memory.getStats();
      expect(stats.total).toBe(2);
      expect(stats.byType['type1']).toBe(1);
      expect(stats.byType['type2']).toBe(1);
    });
  });

  describe('MemorySystem', () => {
    it('should integrate all memory types', async () => {
      const system = MemoryBuilder.create()
        .withShortTermMemory({ maxMessages: 10 })
        .withLongTermMemory({ maxEntries: 100 })
        .build();

      // Add conversation
      await system.add('User asked about TypeScript', {
        type: 'conversation',
      });

      // Add fact
      await system.add('TypeScript is statically typed', {
        type: 'fact',
      });

      // Add entity
      await system.add('John loves TypeScript', {
        type: 'entity',
        entityName: 'John',
        entityType: 'person',
      });

      const stats = system.getStats();
      expect(stats.shortTerm.messages).toBeGreaterThan(0);
      expect(stats.longTerm.total).toBeGreaterThan(0);
      expect(stats.entities.total).toBeGreaterThan(0);
    });

    it('should retrieve combined context', async () => {
      const system = MemoryBuilder.create()
        .withShortTermMemory({ maxMessages: 10 })
        .withLongTermMemory({ maxEntries: 100 })
        .build();

      await system.add('Recent conversation', { type: 'conversation' });
      await system.add('Important conversation fact', { type: 'fact' });

      const context = await system.retrieve('conversation', {
        includeShortTerm: true,
        includeLongTerm: true,
      });

      expect(context).toContain('Recent Context');
      expect(context).toContain('Relevant Facts');
    });

    it('should clear all memory systems', async () => {
      const system = MemoryBuilder.create()
        .withShortTermMemory({ maxMessages: 10 })
        .withLongTermMemory({ maxEntries: 100 })
        .build();

      await system.add('Test 1', { type: 'conversation' });
      await system.add('Test 2', { type: 'fact' });

      await system.clearAll();

      const stats = system.getStats();
      expect(stats.shortTerm.messages).toBe(0);
      expect(stats.longTerm.total).toBe(0);
    });
  });
});
