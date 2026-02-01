/**
 * Example: Memory System
 * 
 * This example demonstrates the multi-level memory system including
 * short-term, long-term, and entity memory.
 */

import {
  MemoryBuilder,
} from '../src';

async function runMemoryExample(): Promise<void> {
  console.log('=== Memory System Example ===\n');

  // Create memory system
  const memory = MemoryBuilder.create()
    .withShortTermMemory({
      maxMessages: 10,
      summarizeAfter: 20,
      decayRate: 0.1,
    })
    .withLongTermMemory({
      maxEntries: 100,
    })
    .build();

  console.log('--- Short-Term Memory ---');
  
  // Add conversation history
  await memory.add('User asked about TypeScript features', {
    type: 'conversation',
    importance: 0.7,
  });

  await memory.add('Explained TypeScript generics', {
    type: 'conversation',
    importance: 0.8,
  });

  await memory.add('User wants to learn about decorators', {
    type: 'conversation',
    importance: 0.9,
  });

  const shortTerm = memory.getShortTerm();
  const recentMemories = shortTerm.getRecent(5);
  
  console.log(`Recent memories: ${recentMemories.length}`);
  recentMemories.forEach(m => {
    console.log(`- ${m.content} (importance: ${m.importance?.toFixed(2)})`);
  });

  console.log('\n--- Long-Term Memory ---');
  
  // Add facts to long-term memory
  await memory.add('TypeScript is a typed superset of JavaScript', {
    type: 'fact',
    importance: 1.0,
  });

  await memory.add('TypeScript compiles to plain JavaScript', {
    type: 'fact',
    importance: 0.9,
  });

  await memory.add('Generics provide type-safe reusable components', {
    type: 'fact',
    importance: 0.8,
  });

  // Retrieve relevant facts
  const context = await memory.retrieve('TypeScript generics', {
    includeShortTerm: true,
    includeLongTerm: true,
    limit: 3,
  });

  console.log('Retrieved context for "TypeScript generics":');
  console.log(context);

  console.log('\n--- Entity Memory ---');
  
  const entities = memory.getEntities();

  // Add entities
  entities.upsert('John Doe', 'person', [
    'Prefers TypeScript over JavaScript',
    'Learning about decorators',
    'Works as a software engineer',
  ]);

  entities.upsert('React', 'framework', [
    'Popular UI library',
    'Works well with TypeScript',
    'Uses JSX syntax',
  ]);

  entities.upsert('TypeScript', 'language', [
    'Statically typed',
    'Compiles to JavaScript',
    'Developed by Microsoft',
  ]);

  // Search entities
  const foundEntities = entities.search('TypeScript');
  console.log(`Found ${foundEntities.length} entities related to "TypeScript":`);
  
  foundEntities.forEach(entity => {
    console.log(`\n${entity.name} (${entity.type}):`);
    entity.facts.forEach(fact => console.log(`  - ${fact}`));
  });

  // Get entity by type
  const people = entities.getByType('person');
  console.log(`\n${people.length} person entities:`);
  people.forEach(p => console.log(`- ${p.name}`));

  console.log('\n--- Memory Statistics ---');
  
  const stats = memory.getStats();
  console.log('Short-term messages:', stats.shortTerm.messages);
  console.log('Long-term total:', stats.longTerm.total);
  console.log('Long-term by type:', stats.longTerm.byType);
  console.log('Entities total:', stats.entities.total);
  console.log('Entities by type:', stats.entities.byType);

  console.log('\n--- Advanced: Importance Decay ---');
  
  // Simulate time passing
  shortTerm.applyDecay();
  
  const decayedMemories = shortTerm.getRecent(5);
  console.log('After decay:');
  decayedMemories.forEach(m => {
    console.log(`- ${m.content} (importance: ${m.importance?.toFixed(2)})`);
  });

  console.log('\n--- Advanced: Entity Updates ---');
  
  // Update existing entity with new facts
  entities.upsert('John Doe', 'person', [
    'Completed TypeScript decorators tutorial',
  ]);

  const john = entities.get('John Doe', 'person');
  console.log(`\nJohn Doe's facts (${john?.facts.length} total):`);
  john?.facts.forEach(fact => console.log(`  - ${fact}`));
}

// Run the example
if (require.main === module) {
  runMemoryExample().catch(console.error);
}

export { runMemoryExample };
