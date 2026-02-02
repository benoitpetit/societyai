/**
 * Getting Started with SocietyAI
 *
 * Simple examples demonstrating the core concepts.
 */

import { Society, AIModel } from '../src';

class MockModel implements AIModel {
  constructor(private modelName: string = 'MockModel') {}

  async process(prompt: unknown, _signal?: AbortSignal): Promise<string> {
    if (Array.isArray(prompt)) {
      const lastMsg = prompt[prompt.length - 1];
      if (lastMsg && typeof lastMsg.content === 'string') {
        return `[${this.modelName}] Response to: ${lastMsg.content.substring(0, 50)}...`;
      }
    }
    if (typeof prompt === 'string') {
      return `[${this.modelName}] Response to: ${prompt.substring(0, 50)}...`;
    }
    return `[${this.modelName}] Processed prompt`;
  }

  name(): string {
    return this.modelName;
  }

  supportsPromptType(promptType: string): boolean {
    return promptType === 'text' || promptType === 'chat';
  }
}

async function example1_SingleAgent(): Promise<void> {
  console.log('\n=== Example 1: Single Agent ===');

  const result = await Society.create()
    .withName('Simple Society')
    .addAgent((agent) =>
      agent
        .withId('assistant')
        .withRole((role) => role.withSystemPrompt('You are helpful'))
        .withModel(new MockModel('Assistant'))
    )
    .addStep((step) => step.withId('main').withAgents(['assistant']).sequential())
    .execute('Hello!');

  console.log('Output:', result.output);
}

async function example2_Sequential(): Promise<void> {
  console.log('\n=== Example 2: Sequential (Chain) ===');

  const result = await Society.create()
    .withName('Sequential Society')
    .addAgent((agent) =>
      agent
        .withId('writer')
        .withRole((role) => role.withSystemPrompt('You write content'))
        .withModel(new MockModel('Writer'))
    )
    .addAgent((agent) =>
      agent
        .withId('editor')
        .withRole((role) => role.withSystemPrompt('You edit content'))
        .withModel(new MockModel('Editor'))
    )
    .chain() // Execute sequentially
    .execute('Write about TypeScript');
  console.log('Final output:', result.output);
}

async function example3_Parallel(): Promise<void> {
  console.log('\n=== Example 3: Parallel (Scatter-Gather) ===');

  const result = await Society.create()
    .withName('Parallel Society')
    .addAgent((agent) =>
      agent
        .withId('agent-1')
        .withRole((role) => role.withSystemPrompt('Expert 1'))
        .withModel(new MockModel('Expert1'))
    )
    .addAgent((agent) =>
      agent
        .withId('agent-2')
        .withRole((role) => role.withSystemPrompt('Expert 2'))
        .withModel(new MockModel('Expert2'))
    )
    .addAgent((agent) =>
      agent
        .withId('agent-3')
        .withRole((role) => role.withSystemPrompt('Expert 3'))
        .withModel(new MockModel('Expert3'))
    )
    .scatterGather() // Execute in parallel
    .execute('Give me your opinion');
  console.log('Combined output:', result.output);
}

async function example4_MixedWorkflow(): Promise<void> {
  console.log('\n=== Example 4: Mixed Workflow ===');

  const result = await Society.create()
    .withName('Mixed Society')
    .addAgent((agent) =>
      agent
        .withId('analyst-1')
        .withRole((role) => role.withSystemPrompt('Financial analyst'))
        .withModel(new MockModel('Analyst1'))
    )
    .addAgent((agent) =>
      agent
        .withId('analyst-2')
        .withRole((role) => role.withSystemPrompt('Market analyst'))
        .withModel(new MockModel('Analyst2'))
    )
    .addAgent((agent) =>
      agent
        .withId('synthesizer')
        .withRole((role) => role.withSystemPrompt('Synthesize information'))
        .withModel(new MockModel('Synthesizer'))
    )
    // First parallel analysis
    .addStep((step) => step.withId('analyze').withAgents(['analyst-1', 'analyst-2']).parallel())
    // Then sequential synthesis
    .addStep((step) => step.withId('synthesize').withAgents(['synthesizer']).sequential())
    .execute('Analyze market trends');
  console.log('Synthesized result:', result.output);
}

async function runAllExamples(): Promise<void> {
  console.log('📚 SocietyAI - Getting Started\n');

  await example1_SingleAgent();
  await example2_Sequential();
  await example3_Parallel();
  await example4_MixedWorkflow();

  console.log('\n✅ All examples completed!');
}

if (require.main === module) {
  runAllExamples().catch(console.error);
}
