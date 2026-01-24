/**
 * Example: Simple Society (Legacy API)
 * 
 * This is the simplest way to use SocietyAI.
 * Perfect for quick prototyping and simple use cases.
 */

import { society, societyCollaborative, StandardModelBase, setGlobalLogLevel, LogLevel } from '../../src';

// Set log level to see what's happening
setGlobalLogLevel(LogLevel.INFO);

/**
 * Create a simple simulated AI model
 * In production, replace this with a real AI API connection
 */
class SimulatedModel extends StandardModelBase {
  constructor(name = 'SimulatedAI') {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const promptText = String(prompt).substring(0, 100);
        return `[${name}] Analysis of: "${promptText}..."\n` +
          `This is a simulated response. In production, connect to a real AI API.`;
      }
    );
  }
}

/**
 * Example 1: Standard Mode
 * Multiple agents analyze the same prompt from different perspectives
 */
async function standardMode(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Standard Mode');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('GPT-4');

  const result = await society(
    'What are the benefits of renewable energy?',
    3,  // 3 agents
    [model],
    false  // single model mode
  );

  console.log('Result:', result);
}

/**
 * Example 2: Collaborative Mode
 * Agents work together through multiple phases
 */
async function collaborativeMode(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Collaborative Mode');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('Claude-3');

  const result = await societyCollaborative(
    'How can we improve urban transportation?',
    4,  // 4 agents exploring different dimensions
    [model],
    false
  );

  console.log('Result:', result);
}

/**
 * Example 3: Custom Perspectives
 * Define your own agent perspectives
 */
async function customPerspectives(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Custom Perspectives');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('Gemini-Pro');

  // Use runSociety for more configuration options
  const { runSociety } = await import('../../src');

  const result = await runSociety(
    {
      prompt: 'Evaluate the potential of AI in healthcare',
      agentCount: 3,
      multiModel: false,
      // Custom perspectives for each agent
      agentPerspectives: [
        'From a medical professional perspective: ',
        'From a patient experience perspective: ',
        'From a healthcare administrator perspective: ',
      ],
    },
    [model]
  );

  console.log('Result:', result);
}

/**
 * Example 4: Custom Dimensions (Collaborative)
 * Define your own dimensions to explore
 */
async function customDimensions(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Custom Dimensions');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('GPT-4');

  const { runSocietyCollaborative } = await import('../../src');

  const result = await runSocietyCollaborative(
    {
      prompt: 'Design a sustainable smart city',
      agentCount: 4,
      multiModel: false,
      collaborative: true,
      // Custom dimensions to explore
      dimensions: [
        'Energy efficiency and renewable sources',
        'Transportation and mobility',
        'Waste management and recycling',
        'Green spaces and biodiversity',
      ],
    },
    [model]
  );

  console.log('Result:', result);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await standardMode();
    await collaborativeMode();
    await customPerspectives();
    await customDimensions();

    console.log('\n✨ All examples completed successfully!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { standardMode, collaborativeMode, customPerspectives, customDimensions };
