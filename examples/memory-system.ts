import { MemoryBuilder } from '../src';

async function run(): Promise<void> {
  // Create memory system
  const memory = MemoryBuilder.create()
    .withShortTermMemory({ maxMessages: 5 })
    //.withLongTermMemory({ maxSize: 100 }) // Assuming LongTerm options availability
    .build();

  console.log('Adding entry to memory...');
  await memory.add('User likes TypeScript', { type: 'conversation', importance: 1.0 });

  // Depending on implementation, retrieve might check both short and long term
  // Assuming a retrieve method on the built memory system
  if ('search' in memory) {
    // @ts-expect-error - search is dynamically added
    const result = await memory.search({ query: 'What does the user like?' });
    console.log('Retrieved:', result.memories);
  } else {
    console.log('Memory built completely.');
  }
}

run().catch(console.error);
