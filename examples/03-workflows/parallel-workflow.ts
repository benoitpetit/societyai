/**
 * Example: Parallel Workflow
 * 
 * Multiple agents execute simultaneously for faster results.
 * Ideal when tasks are independent and can run concurrently.
 */

import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
  MessageBus,
  StandardModelBase,
  WorkflowContext,
} from '../../src';

/**
 * Simulated model with variable response time
 */
class VariableSpeedModel extends StandardModelBase {
  constructor(
    name: string,
    private minDelay: number = 200,
    private maxDelay: number = 800
  ) {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        return `[${name}] (${Math.round(delay)}ms) Analyzed: ${String(prompt).substring(0, 50)}...`;
      }
    );
  }
}

/**
 * Example 1: Basic Parallel Execution
 */
async function basicParallelWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Parallel Execution');
  console.log('='.repeat(60) + '\n');

  // Create multiple agents that will run in parallel
  const agents = [
    new AgentBuilder('analyst-1')
      .withRole(new RoleBuilder('Financial Analyst').build())
      .withModel(new VariableSpeedModel('Finance-GPT'))
      .build(),

    new AgentBuilder('analyst-2')
      .withRole(new RoleBuilder('Market Analyst').build())
      .withModel(new VariableSpeedModel('Market-GPT'))
      .build(),

    new AgentBuilder('analyst-3')
      .withRole(new RoleBuilder('Risk Analyst').build())
      .withModel(new VariableSpeedModel('Risk-GPT'))
      .build(),
  ];

  // All agents in one parallel step
  const parallelStep = new StepBuilder('parallel-analysis')
    .withName('Parallel Analysis')
    .withDescription('All analysts work simultaneously')
    .withAgents(agents.map(a => a.id))
    .withExecutionType('parallel')
    .build();

  const workflow = new WorkflowConfigBuilder('parallel-analysis')
    .withName('Parallel Analysis Workflow')
    .addSteps([parallelStep])
    .withAgents(agents)
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const startTime = Date.now();
  
  console.log(`Starting ${agents.length} parallel agents...`);
  console.log('If sequential, this would take ~1500ms total.');
  console.log('With parallel, all complete in ~500ms.\n');

  const result = await executor.execute(workflow, {
    prompt: 'Analyze investment opportunity in renewable energy',
    stepResults: new Map(),
    metadata: {},
  });

  console.log(`\n✓ All ${agents.length} agents completed`);
  console.log(`  Total time: ${Date.now() - startTime}ms`);
  console.log(`  Parallel efficiency: ${result.success ? 'Optimal' : 'Degraded'}`);
}

/**
 * Example 2: Fan-Out / Fan-In Pattern
 */
async function fanOutFanInWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Fan-Out / Fan-In Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new VariableSpeedModel('GPT-4', 200, 500);

  // Coordinator that starts the work
  const coordinator = new AgentBuilder('coordinator')
    .withRole(new RoleBuilder('Coordinator').build())
    .withModel(model)
    .build();

  // Worker agents that run in parallel
  const workers = Array.from({ length: 5 }, (_, i) =>
    new AgentBuilder(`worker-${i + 1}`)
      .withRole(new RoleBuilder(`Worker ${i + 1}`).build())
      .withModel(new VariableSpeedModel(`Worker-${i + 1}-GPT`))
      .build()
  );

  // Aggregator that combines results
  const aggregator = new AgentBuilder('aggregator')
    .withRole(new RoleBuilder('Aggregator').build())
    .withModel(model)
    .build();

  const steps = [
    // Step 1: Coordinator distributes work
    new StepBuilder('distribute')
      .withName('Distribute Work')
      .withAgents([coordinator.id])
      .withExecutionType('sequential')
      .build(),

    // Step 2: Workers process in parallel (FAN-OUT)
    new StepBuilder('process')
      .withName('Parallel Processing')
      .withDescription('Workers process tasks concurrently')
      .withAgents(workers.map(w => w.id))
      .withExecutionType('parallel')
      .build(),

    // Step 3: Aggregator combines results (FAN-IN)
    new StepBuilder('aggregate')
      .withName('Aggregate Results')
      .withAgents([aggregator.id])
      .withExecutionType('sequential')
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('fan-out-fan-in')
    .withName('Fan-Out / Fan-In Workflow')
    .addSteps(steps)
    .withAgents([coordinator, ...workers, aggregator])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  console.log('Workflow Pattern:');
  console.log('  [Coordinator] → [5 Workers in Parallel] → [Aggregator]');
  console.log('');

  const result = await executor.execute(workflow, {
    prompt: 'Process customer feedback from multiple regions',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nExecution Summary:');
  result.stepResults.forEach((stepResult, stepId) => {
    console.log(`  ${stepId}: ${stepResult.duration}ms`);
  });
  console.log(`  Total: ${result.totalDuration}ms`);
}

/**
 * Example 3: Parallel Expert Panel
 */
async function parallelExpertPanel(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Parallel Expert Panel');
  console.log('='.repeat(60) + '\n');

  // Create diverse experts
  const experts = [
    { id: 'tech-expert', name: 'Technology Expert', domain: 'Technical feasibility' },
    { id: 'business-expert', name: 'Business Expert', domain: 'Market viability' },
    { id: 'legal-expert', name: 'Legal Expert', domain: 'Regulatory compliance' },
    { id: 'finance-expert', name: 'Finance Expert', domain: 'Financial analysis' },
    { id: 'ethics-expert', name: 'Ethics Expert', domain: 'Ethical considerations' },
  ];

  const expertAgents = experts.map(expert =>
    new AgentBuilder(expert.id)
      .withRole(
        new RoleBuilder(expert.name)
          
          .withSystemPrompt(`You are an expert in ${expert.domain}. Provide insights from your domain expertise.`)
          .withCapabilities([expert.domain.toLowerCase().replace(' ', '-')])
          .build()
      )
      .withModel(new VariableSpeedModel(expert.name))
      .build()
  );

  const moderator = new AgentBuilder('moderator')
    .withRole(
      new RoleBuilder('Panel Moderator')
        
        .withSystemPrompt('Synthesize expert opinions into balanced recommendations.')
        .build()
    )
    .withModel(new VariableSpeedModel('Moderator-GPT'))
    .build();

  const steps = [
    // All experts analyze in parallel
    new StepBuilder('expert-analysis')
      .withName('Expert Panel Analysis')
      .withDescription('All experts provide their perspective simultaneously')
      .withAgents(expertAgents.map(a => a.id))
      .withExecutionType('parallel')
      .build(),

    // Moderator synthesizes
    new StepBuilder('synthesis')
      .withName('Panel Synthesis')
      .withAgents([moderator.id])
      .withExecutionType('sequential')
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('expert-panel')
    .withName('Expert Panel Review')
    .addSteps(steps)
    .withAgents([...expertAgents, moderator])
    .build();

  console.log('Expert Panel:');
  experts.forEach(e => console.log(`  • ${e.name}: ${e.domain}`));
  console.log(`  + Moderator for synthesis`);
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Evaluate the proposal for AI-powered healthcare diagnostics',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nPanel Review Complete:');
  console.log(`  Experts consulted: ${experts.length}`);
  console.log(`  Total time: ${result.totalDuration}ms`);
  console.log(`  Status: ${result.success ? '✓ Consensus reached' : '✗ Review incomplete'}`);
}

/**
 * Example 4: Parallel with Individual Timeouts
 */
async function parallelWithTimeouts(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Parallel with Timeout Handling');
  console.log('='.repeat(60) + '\n');

  // Create agents with different speeds
  const agents = [
    { id: 'fast-agent', name: 'Fast Agent', delay: [100, 200] as [number, number] },
    { id: 'medium-agent', name: 'Medium Agent', delay: [300, 400] as [number, number] },
    { id: 'slow-agent', name: 'Slow Agent', delay: [600, 800] as [number, number] },
  ];

  const agentConfigs = agents.map(({ id, name, delay }) =>
    new AgentBuilder(id)
      .withRole(new RoleBuilder(name).build())
      .withModel(new VariableSpeedModel(name, ...delay))
      .build()
  );

  const parallelStep = new StepBuilder('timed-parallel')
    .withName('Parallel with Timeout')
    .withAgents(agentConfigs.map(a => a.id))
    .withExecutionType('parallel')
    .withTimeout(500) // 500ms timeout
    .build();

  const workflow = new WorkflowConfigBuilder('parallel-timeout')
    .withName('Parallel Execution with Timeouts')
    .addSteps([parallelStep])
    .withAgents(agentConfigs)
    .build();

  console.log('Agent Response Times:');
  agents.forEach(a => console.log(`  ${a.name}: ${a.delay[0]}-${a.delay[1]}ms`));
  console.log(`  Timeout: 500ms`);
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Process with time constraints',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Execution Results:');
  console.log(`  Total duration: ${result.totalDuration}ms`);
  console.log(`  Overall success: ${result.success}`);
  console.log('  Note: Slow agents may timeout while fast agents complete.');
}

/**
 * Example 5: Parallel Map-Reduce
 */
async function parallelMapReduce(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Map-Reduce Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new VariableSpeedModel('GPT-4', 200, 400);

  // Data chunks to process
  const dataChunks = ['Region A', 'Region B', 'Region C', 'Region D'];

  // Map: Create an agent for each chunk
  const mapperAgents = dataChunks.map((chunk, i) =>
    new AgentBuilder(`mapper-${i}`)
      .withRole(
        new RoleBuilder(`${chunk} Processor`)
          
          .withSystemPrompt(`Process data for ${chunk}`)
          .build()
      )
      .withModel(model)
      
      .build()
  );

  // Reduce: Single agent to combine results
  const reducerAgent = new AgentBuilder('reducer')
    .withRole(
      new RoleBuilder('Result Combiner')
        
        .withSystemPrompt('Combine all regional results into a unified report.')
        .build()
    )
    .withModel(model)
    .build();

  const steps = [
    // Map phase: parallel processing of all chunks
    new StepBuilder('map')
      .withName('Map Phase')
      .withDescription('Process each data chunk in parallel')
      .withAgents(mapperAgents.map(a => a.id))
      .withExecutionType('parallel')
      .build(),

    // Reduce phase: combine all results
    new StepBuilder('reduce')
      .withName('Reduce Phase')
      .withDescription('Combine all mapped results')
      .withAgents([reducerAgent.id])
      .withExecutionType('sequential')
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('map-reduce')
    .withName('Map-Reduce Workflow')
    .addSteps(steps)
    .withAgents([...mapperAgents, reducerAgent])
    .build();

  console.log('Map-Reduce Pattern:');
  console.log('  MAP (Parallel):');
  dataChunks.forEach(chunk => console.log(`    • Process ${chunk}`));
  console.log('  REDUCE (Sequential):');
  console.log('    • Combine all results');
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Analyze sales data across all regions',
    stepResults: new Map(),
    metadata: { regions: dataChunks },
  });

  console.log('Map-Reduce Complete:');
  console.log(`  Data chunks processed: ${dataChunks.length}`);
  console.log(`  Total time: ${result.totalDuration}ms`);
  console.log(`  Status: ${result.success ? '✓ Success' : '✗ Failed'}`);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicParallelWorkflow();
    await fanOutFanInWorkflow();
    await parallelExpertPanel();
    await parallelWithTimeouts();
    await parallelMapReduce();

    console.log('\n✨ All parallel workflow examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  basicParallelWorkflow,
  fanOutFanInWorkflow,
  parallelExpertPanel,
  parallelWithTimeouts,
  parallelMapReduce,
};
