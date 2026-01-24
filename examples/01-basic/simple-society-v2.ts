/**
 * Example: Simple Society (v2 API)
 * 
 * This example demonstrates the new fluent builder API introduced in v2.0.
 * It's the recommended way to create societies with a modern, intuitive interface.
 */

import { Society, Strategies, StandardModelBase, setGlobalLogLevel, LogLevel } from '../../src';

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
          `This is a simulated response. In production, connect to a real AI API like OpenAI, Anthropic, or Google AI.`;
      }
    );
  }
}

/**
 * Example 1: Simple Scatter-Gather Pattern
 * Multiple agents analyze the same prompt and results are merged
 */
async function scatterGatherExample(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Scatter-Gather Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('GPT-4');

  const result = await Society.create()
    .withName('Analysis Team')
    .addAgent(a => a
      .withId('analyst-1')
      .withRole(r => r
        .withSystemPrompt('You are a technical analyst. Focus on technical details and implementation.')
        .withCapabilities(['technical-analysis', 'implementation']))
      .withModel(model))
    .addAgent(a => a
      .withId('analyst-2')
      .withRole(r => r
        .withSystemPrompt('You are a business analyst. Focus on business value and ROI.')
        .withCapabilities(['business-analysis', 'strategy']))
      .withModel(model))
    .addAgent(a => a
      .withId('analyst-3')
      .withRole(r => r
        .withSystemPrompt('You are a user experience analyst. Focus on usability and user needs.')
        .withCapabilities(['ux-analysis', 'usability']))
      .withModel(model))
    .scatterGather(Strategies.concat('\n\n---\n\n').aggregate)
    .execute('What are the benefits of renewable energy?');

  console.log('\nResult:', result.output);
  console.log(`\nDuration: ${result.duration}ms`);
  console.log(`Success: ${result.success}`);
}

/**
 * Example 2: Sequential Chain Pattern
 * Agents process information one after another
 */
async function sequentialChainExample(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Sequential Chain Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('Claude-3');

  const result = await Society.create()
    .withName('Content Pipeline')
    .addAgent(a => a
      .withId('researcher')
      .withRole(r => r
        .withSystemPrompt('Research and gather information on the topic.')
        .withCapabilities(['research', 'fact-checking']))
      .withModel(model))
    .addAgent(a => a
      .withId('writer')
      .withRole(r => r
        .withSystemPrompt('Write engaging content based on research.')
        .withCapabilities(['writing', 'storytelling']))
      .withModel(model))
    .addAgent(a => a
      .withId('editor')
      .withRole(r => r
        .withSystemPrompt('Edit and polish the content for publication.')
        .withCapabilities(['editing', 'quality-assurance']))
      .withModel(model))
    .usePipeline(p => p.chain(['researcher', 'writer', 'editor']))
    .execute('How can we improve urban transportation?');

  console.log('\nResult:', result.output);
  console.log(`\nDuration: ${result.duration}ms`);
}

/**
 * Example 3: Consensus Building Pattern
 * Multiple experts reach consensus with a finalizer
 */
async function consensusExample(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Consensus Building Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('Gemini-Pro');

  const result = await Society.create()
    .withName('Expert Panel')
    .addAgent(a => a
      .withId('expert-1')
      .withRole(r => r.withSystemPrompt('Expert in medical applications of AI'))
      .withModel(model))
    .addAgent(a => a
      .withId('expert-2')
      .withRole(r => r.withSystemPrompt('Expert in AI ethics and safety'))
      .withModel(model))
    .addAgent(a => a
      .withId('expert-3')
      .withRole(r => r.withSystemPrompt('Expert in healthcare technology'))
      .withModel(model))
    .addAgent(a => a
      .withId('synthesizer')
      .withRole(r => r.withSystemPrompt('Synthesize expert opinions into a balanced conclusion'))
      .withModel(model))
    .usePipeline(p => p
      .scatterGather(['expert-1', 'expert-2', 'expert-3'], Strategies.consensus(0.7))
      .then('synthesizer'))
    .execute('Evaluate the potential of AI in healthcare');

  console.log('\nResult:', result.output);
  console.log(`\nDuration: ${result.duration}ms`);
}

/**
 * Example 4: Review Pattern
 * Draft and review workflow
 */
async function reviewPatternExample(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Review Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('GPT-4-Turbo');

  const result = await Society.create()
    .withName('Review Workflow')
    .addAgent(a => a
      .withId('writer')
      .withRole(r => r.withSystemPrompt('Create a first draft of the content'))
      .withModel(model))
    .addAgent(a => a
      .withId('reviewer')
      .withRole(r => r
        .withSystemPrompt('Review the draft and provide detailed feedback')
        .withCapabilities(['critical-thinking', 'quality-assurance']))
      .withModel(model))
    .usePipeline(p => p.chain(['writer', 'reviewer']))
    .execute('Write a brief article about quantum computing');

  console.log('\nResult:', result.output);
  console.log(`\nDuration: ${result.duration}ms`);
}

/**
 * Example 5: Custom Aggregation Strategy
 * Use a custom strategy to combine results
 */
async function customStrategyExample(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Custom Aggregation Strategy');
  console.log('='.repeat(60) + '\n');

  const model = new SimulatedModel('Custom-Model');

  // Create a custom aggregation strategy that selects the longest response
  const longestStrategy = Strategies.longest();

  const result = await Society.create()
    .withName('Multi-Perspective Analysis')
    .addAgent(a => a
      .withId('optimist')
      .withRole(r => r.withSystemPrompt('Provide an optimistic perspective'))
      .withModel(model))
    .addAgent(a => a
      .withId('realist')
      .withRole(r => r.withSystemPrompt('Provide a realistic, balanced perspective'))
      .withModel(model))
    .addAgent(a => a
      .withId('critic')
      .withRole(r => r.withSystemPrompt('Provide a critical, skeptical perspective'))
      .withModel(model))
    .scatterGather(longestStrategy.aggregate)
    .execute('What will be the impact of AI on jobs in the next decade?');

  console.log('\nResult:', result.output);
  console.log(`\nDuration: ${result.duration}ms`);
}

/**
 * Run all examples
 */
async function runAllExamples(): Promise<void> {
  try {
    await scatterGatherExample();
    await sequentialChainExample();
    await consensusExample();
    await reviewPatternExample();
    await customStrategyExample();
    
    console.log('\n' + '='.repeat(60));
    console.log('All examples completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  scatterGatherExample,
  sequentialChainExample,
  consensusExample,
  reviewPatternExample,
  customStrategyExample,
};
