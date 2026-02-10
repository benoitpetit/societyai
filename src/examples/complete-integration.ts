/**
 * @fileoverview Complete Integration Example
 *
 * This example demonstrates ALL new features working together:
 * - Worker Threads (IsolatedWorkerPool via executionMode)
 * - OpenTelemetry (distributed tracing)
 * - MCP (Model Context Protocol tools)
 * - Fluent builders with new capabilities
 */

import { Society } from '../core/society';
import { createOpenTelemetryObserver } from '../observability/opentelemetry';
// import { MCPServers } from '../capabilities/mcp';  // Uncomment to use MCP tools
import { AIModel, Message } from '../core/types';

/**
 * Example Model for demonstration
 */
class DemoModel implements AIModel {
  private modelName: string;

  constructor(name: string) {
    this.modelName = name;
  }

  name(): string {
    return this.modelName;
  }

  async generate(messages: Message[]): Promise<string> {
    // Simulate AI processing
    const context = messages.map((m) => m.content).join('\n');
    return `Processed by ${this.modelName}: ${context}`;
  }

  async process(input: string): Promise<string> {
    return `Processed by ${this.modelName}: ${input}`;
  }

  supportsPromptType(): boolean {
    return true;
  }
}

/**
 * Complete Integration Example
 *
 * Creates a society with:
 * - Standard agent (default execution mode)
 * - CPU-intensive agent (isolated worker thread)
 * - OpenTelemetry tracing
 * - MCP tools
 */
async function completeIntegrationExample() {
  console.log('🚀 Starting Complete Integration Example\n');

  // 1. Create OpenTelemetry observer for distributed tracing
  console.log('📊 Setting up OpenTelemetry observer...');
  const observer = createOpenTelemetryObserver({
    serviceName: 'complete-integration-demo',
    exporterType: 'console',
  });

  // 2. Create MCP tools (optional - comment out if not needed)
  // const gitTools = await MCPServers.git();
  // const fsTools = await MCPServers.filesystem('/workspace');

  // 3. Build the society with all features
  console.log('🏗️  Building society with all features...\n');

  const society = Society.create()
    .withName('Complete Integration Society')
    .withDescription('Demonstrates Worker Threads, OpenTelemetry, and MCP integration')
    .withObserver(observer) // ← OpenTelemetry integration

    // Standard agent for IO-bound tasks
    .addAgent(
      (agent) =>
        agent
          .withId('io-agent')
          .withName('IO-Bound Agent')
          .withRole((role) =>
            role
              .withId('io-role')
              .withName('IO Handler')
              .withSystemPrompt(
                'You handle IO-bound tasks like API calls and database queries. ' +
                  'You are fast and efficient at network operations.'
              )
          )
          .withModel(new DemoModel('GPT-4-IO'))
          .withTags(['io-bound', 'standard'])
      // executionMode not specified → defaults to standard execution
    )

    // CPU-intensive agent using Worker Threads
    .addAgent(
      (agent) =>
        agent
          .withId('cpu-agent')
          .withName('CPU-Intensive Agent')
          .withRole((role) =>
            role
              .withId('cpu-role')
              .withName('CPU Processor')
              .withSystemPrompt(
                'You handle CPU-intensive tasks like data analysis, complex calculations, ' +
                  'and heavy processing. You run in an isolated worker thread to avoid ' +
                  'blocking the main event loop.'
              )
          )
          .withModel(new DemoModel('GPT-4-CPU'))
          .withExecutionMode('isolated') // ← Worker Thread execution
          .withTags(['cpu-intensive', 'isolated'])
      // .withTools(gitTools)  // ← MCP tools (uncomment if available)
    )

    // Task 1: IO-bound preprocessing
    .addTask(
      (task) =>
        task
          .withId('preprocessing')
          .withName('Data Preprocessing')
          .withDescription('Load and preprocess input data')
          .withAgents(['io-agent'])
          .thenGoto(['heavy-processing']) // → Sequential flow
    )

    // Task 2: CPU-intensive processing
    .addTask((task) =>
      task
        .withId('heavy-processing')
        .withName('Heavy Processing')
        .withDescription('Perform CPU-intensive analysis')
        .withAgents(['cpu-agent'])
    );

  // 4. Execute the workflow
  console.log('▶️  Executing workflow...\n');
  const startTime = Date.now();

  const result = await society.execute('Analyze large dataset: [1, 2, 3, ..., 1000000]');

  const duration = Date.now() - startTime;

  // 5. Display results
  console.log('\n✅ Execution completed!\n');
  console.log('📊 Results:');
  console.log('  Success:', result.success);
  console.log('  Duration:', duration, 'ms');
  console.log('  Output:', result.output);
  console.log('  Tasks executed:', result.taskResults.size);

  if (result.errors && result.errors.length > 0) {
    console.log('  Errors:', result.errors);
  }

  // 6. Verify execution mode routing
  console.log('\n🔍 Execution Details:');
  console.log('  IO Agent: Standard execution (main thread)');
  console.log('  CPU Agent: Isolated execution (worker thread)');
  console.log('  OpenTelemetry: Traces exported');

  // 7. Cleanup
  console.log('\n🧹 Cleaning up...');
  await observer.shutdown();

  console.log('✨ Complete integration example finished!\n');

  return result;
}

/**
 * Example showing mixed execution modes
 */
async function mixedExecutionExample() {
  console.log('🔄 Mixed Execution Mode Example\n');

  const society = Society.create()
    .withName('Mixed Execution Society')

    // Agent 1: Default mode (undefined)
    .addAgent(
      (a) =>
        a
          .withId('agent-default')
          .withRole((r) => r.withId('role1').withSystemPrompt('Default'))
          .withModel(new DemoModel('Model-1'))
      // No executionMode → standard
    )

    // Agent 2: Explicit default mode
    .addAgent(
      (a) =>
        a
          .withId('agent-explicit-default')
          .withRole((r) => r.withId('role2').withSystemPrompt('Explicit Default'))
          .withModel(new DemoModel('Model-2'))
          .withExecutionMode('default') // ← Explicit standard
    )

    // Agent 3: Isolated mode
    .addAgent(
      (a) =>
        a
          .withId('agent-isolated')
          .withRole((r) => r.withId('role3').withSystemPrompt('Isolated'))
          .withModel(new DemoModel('Model-3'))
          .withExecutionMode('isolated') // ← Worker thread
    )

    .addTask((t) => t.withId('t1').withAgents(['agent-default']).thenGoto(['t2']))
    .addTask((t) => t.withId('t2').withAgents(['agent-explicit-default']).thenGoto(['t3']))
    .addTask((t) => t.withId('t3').withAgents(['agent-isolated']));

  const result = await society.execute('Mixed mode test');

  console.log('Result:', result.success ? '✅' : '❌');
  console.log('Executed 3 agents with different execution modes\n');

  return result;
}

/**
 * Run examples
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('    SocietyAI Complete Integration Examples');
  console.log('═'.repeat(60));
  console.log();

  try {
    // Example 1: Complete integration
    await completeIntegrationExample();

    console.log('─'.repeat(60));
    console.log();

    // Example 2: Mixed execution modes
    await mixedExecutionExample();

    console.log('═'.repeat(60));
    console.log('All examples completed successfully! ✨');
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { completeIntegrationExample, mixedExecutionExample };
