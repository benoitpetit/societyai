/**
 * Example: Multi-Model Society
 * 
 * Use different AI models for different agents.
 * This can provide diverse perspectives based on model strengths.
 */

import { society, societyWithSynthesis, StandardModelBase, setGlobalLogLevel, LogLevel } from '../../src';

setGlobalLogLevel(LogLevel.INFO);

/**
 * Simulated fast model - quick but less detailed
 */
class FastModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'FastModel', timeout: 5000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return `[FAST] Quick analysis: ${String(prompt).substring(0, 50)}... ` +
          `Direct and concise response based on key facts.`;
      }
    );
  }
}

/**
 * Simulated detailed model - slower but thorough
 */
class DetailedModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'DetailedModel', timeout: 15000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return `[DETAILED] In-depth analysis:\n\n` +
          `Topic: ${String(prompt).substring(0, 50)}...\n\n` +
          `1. Background Context:\n   Comprehensive examination of the subject matter.\n\n` +
          `2. Key Considerations:\n   Multiple factors analyzed in detail.\n\n` +
          `3. Recommendations:\n   Actionable insights based on thorough analysis.`;
      }
    );
  }
}

/**
 * Simulated creative model - innovative approaches
 */
class CreativeModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'CreativeModel', timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return `[CREATIVE] 💡 Innovative perspective:\n\n` +
          `Question: ${String(prompt).substring(0, 50)}...\n\n` +
          `🚀 Unconventional Approach:\n` +
          `   Thinking outside the box to find unique solutions.\n\n` +
          `🎯 Creative Applications:\n` +
          `   Novel ideas that challenge traditional thinking.`;
      }
    );
  }
}

/**
 * Simulated synthesis model - combines perspectives
 */
class SynthesisModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'SynthesisModel', timeout: 12000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 600));
        return `📊 CONSOLIDATED SYNTHESIS\n\n` +
          `After analyzing all perspectives:\n\n` +
          `✓ Points of Agreement:\n` +
          `  - Key themes identified across all analyses\n\n` +
          `⚠ Different Viewpoints:\n` +
          `  - Complementary approaches identified\n\n` +
          `🎯 UNIFIED CONCLUSION:\n` +
          `  Integrated response combining speed, depth, and creativity.`;
      }
    );
  }
}

/**
 * Example 1: Multi-Model with Rotation
 * Each agent uses a different model
 */
async function multiModelRotation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Multi-Model Rotation');
  console.log('='.repeat(60) + '\n');

  const models = [
    new FastModel(),
    new DetailedModel(),
    new CreativeModel(),
  ];

  // With multiModel=true, agents rotate through available models
  const result = await society(
    'What strategies can improve team productivity?',
    6,  // 6 agents = 2 per model
    models,
    true  // Enable multi-model mode
  );

  console.log('Result:', result);
}

/**
 * Example 2: Multi-Model with Synthesis
 * Use a dedicated model to synthesize all results
 */
async function multiModelWithSynthesis(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Multi-Model with Synthesis');
  console.log('='.repeat(60) + '\n');

  const analysisModels = [
    new FastModel(),
    new DetailedModel(),
    new CreativeModel(),
  ];

  const synthesisModel = new SynthesisModel();

  const result = await societyWithSynthesis(
    'How can technology improve education?',
    3,
    analysisModels,
    true,  // Multi-model mode
    synthesisModel
  );

  console.log('Result:', result);
}

/**
 * Example 3: Model-per-Role Pattern
 * Assign specific models based on their strengths
 */
async function modelPerRole(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Model-per-Role Pattern');
  console.log('='.repeat(60) + '\n');

  // In a real scenario, you might use:
  // - GPT-4 for complex reasoning
  // - Claude for nuanced writing
  // - Gemini for factual accuracy
  
  const models = [
    new DetailedModel(),  // For analysis tasks
    new CreativeModel(),  // For innovation tasks
    new FastModel(),      // For quick validations
  ];

  const result = await society(
    'Design a customer loyalty program',
    3,
    models,
    true
  );

  console.log('Result:', result);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await multiModelRotation();
    await multiModelWithSynthesis();
    await modelPerRole();

    console.log('\n✨ All multi-model examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { multiModelRotation, multiModelWithSynthesis, modelPerRole };
