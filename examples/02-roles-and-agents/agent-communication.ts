/**
 * Example: Agent Communication with MessageBus
 * 
 * Demonstrates how agents can communicate using the MessageBus system.
 */

import {
  MessageBus,
  AgentMessage,
} from '../../src';

/**
 * Example 1: Basic Message Sending
 */
async function basicMessaging(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Message Sending');
  console.log('='.repeat(60) + '\n');

  const messageBus = new MessageBus();

  // Subscribe agents to receive messages
  messageBus.subscribe('agent-alice', (msg) => {
    console.log(`  [Alice received] From ${msg.from}: ${msg.content}`);
  });
  
  messageBus.subscribe('agent-bob', (msg) => {
    console.log(`  [Bob received] From ${msg.from}: ${msg.content}`);
  });
  
  messageBus.subscribe('agent-carol', (msg) => {
    console.log(`  [Carol received] From ${msg.from}: ${msg.content}`);
  });

  // Send messages
  await messageBus.send({
    from: 'agent-alice',
    to: 'agent-bob',
    type: 'data',
    content: 'I\'ve completed the initial analysis. Ready for implementation.',
    timestamp: Date.now(),
    messageId: 'msg-1',
  });

  await messageBus.send({
    from: 'agent-bob',
    to: 'agent-alice',
    type: 'data',
    content: 'Got it! I\'ll start working on the implementation.',
    timestamp: Date.now(),
    messageId: 'msg-2',
  });

  await messageBus.send({
    from: 'agent-bob',
    to: 'agent-carol',
    type: 'data',
    content: 'Implementation is ready for review.',
    timestamp: Date.now(),
    messageId: 'msg-3',
  });

  await messageBus.send({
    from: 'agent-carol',
    to: 'broadcast',
    type: 'data',
    content: 'Review complete. All looks good!',
    timestamp: Date.now(),
    messageId: 'msg-4',
  });

  // Get message history
  console.log('\nFull Message History:');
  messageBus.getHistory().forEach((msg, i) => {
    const recipient = msg.to === 'broadcast' ? 'ALL' : msg.to;
    console.log(`  ${i + 1}. ${msg.from} → ${recipient}: "${msg.content}"`);
  });
}

/**
 * Example 2: Filtered Message History
 */
async function filteredMessaging(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Filtered Message History');
  console.log('='.repeat(60) + '\n');

  const messageBus = new MessageBus();

  // Send various messages
  await messageBus.send({
    from: 'alice',
    to: 'bob',
    type: 'data',
    content: 'Can you review my PR?',
    timestamp: Date.now(),
    messageId: 'msg-1',
  });
  
  await messageBus.send({
    from: 'bob',
    to: 'alice',
    type: 'data',
    content: 'Sure, I\'ll take a look.',
    timestamp: Date.now(),
    messageId: 'msg-2',
  });
  
  await messageBus.send({
    from: 'charlie',
    to: 'alice',
    type: 'request',
    content: 'Lunch at noon?',
    timestamp: Date.now(),
    messageId: 'msg-3',
  });
  
  await messageBus.send({
    from: 'alice',
    to: 'charlie',
    type: 'response',
    content: 'Sounds good!',
    timestamp: Date.now(),
    messageId: 'msg-4',
  });

  // Filter by sender
  console.log('Messages FROM alice:');
  messageBus.getHistory({ from: 'alice' }).forEach(msg => {
    console.log(`  → ${msg.to}: "${msg.content}"`);
  });

  // Filter by recipient
  console.log('\nMessages TO alice:');
  messageBus.getHistory({ to: 'alice' }).forEach(msg => {
    console.log(`  ${msg.from}: "${msg.content}"`);
  });

  // Filter by type
  console.log('\nMessages of type "data":');
  messageBus.getHistory({ type: 'data' }).forEach(msg => {
    console.log(`  ${msg.from} → ${msg.to}: "${msg.content}"`);
  });
}

/**
 * Example 3: Broadcast Communication
 */
async function broadcastCommunication(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Broadcast Communication');
  console.log('='.repeat(60) + '\n');

  const messageBus = new MessageBus();

  // Setup agent subscribers
  ['agent-1', 'agent-2', 'agent-3'].forEach(id => {
    messageBus.subscribe(id, (msg) => {
      console.log(`  [${id} received] ${msg.content}`);
    });
  });

  // Send a broadcast message
  console.log('Sending broadcast...\n');
  await messageBus.send({
    from: 'system',
    to: 'broadcast',
    type: 'announcement',
    content: 'System maintenance scheduled for tonight',
    timestamp: Date.now(),
    messageId: 'broadcast-1',
  });

  console.log('\nMessage History:');
  messageBus.getHistory().forEach(msg => {
    console.log(`  ${msg.from} → ${msg.to}: "${msg.content}"`);
  });
}

/**
 * Example 4: Subscriber Callbacks
 */
async function subscriberCallbacks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Subscriber Callbacks');
  console.log('='.repeat(60) + '\n');

  const messageBus = new MessageBus();

  // Agents with different behaviors
  messageBus.subscribe('analyzer', (msg) => {
    console.log(`  [ANALYZER] Processing: "${msg.content.substring(0, 30)}..."`);
  });

  messageBus.subscribe('logger', (msg) => {
    console.log(`  [LOGGER] Logged message from ${msg.from} at ${new Date(msg.timestamp).toISOString()}`);
  });

  messageBus.subscribe('validator', (msg) => {
    const isValid = msg.content.length > 0;
    console.log(`  [VALIDATOR] Message ${isValid ? 'valid' : 'invalid'}`);
  });

  console.log('Sending message to multiple subscribers...\n');
  
  await messageBus.send({
    from: 'user',
    to: 'analyzer',
    type: 'data',
    content: 'This is an important message that needs to be processed',
    timestamp: Date.now(),
    messageId: 'msg-1',
  });

  await messageBus.send({
    from: 'user',
    to: 'logger',
    type: 'data',
    content: 'Log this message',
    timestamp: Date.now(),
    messageId: 'msg-2',
  });

  await messageBus.send({
    from: 'user',
    to: 'validator',
    type: 'data',
    content: 'Validate me',
    timestamp: Date.now(),
    messageId: 'msg-3',
  });
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicMessaging();
    await filteredMessaging();
    await broadcastCommunication();
    await subscriberCallbacks();

    console.log('\n✨ All agent communication examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { 
  basicMessaging, 
  filteredMessaging,
  broadcastCommunication,
  subscriberCallbacks,
};
