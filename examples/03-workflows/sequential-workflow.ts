/**
 * Example: Sequential Workflow
 * 
 * Steps execute one after another, each building on the previous.
 * Perfect for linear processes where order matters.
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
 * Simulated model that acknowledges context
 */
class ContextAwareModel extends StandardModelBase {
  constructor(name: string) {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return `[${name}] Processed: ${String(prompt).substring(0, 100)}...`;
      }
    );
  }
}

/**
 * Example 1: Basic Sequential Workflow
 */
async function basicSequentialWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Sequential Workflow');
  console.log('='.repeat(60) + '\n');

  const model = new ContextAwareModel('GPT-4');

  // Define roles
  const researcherRole = new RoleBuilder('Researcher')
    
    .withSystemPrompt('Research and gather information on the topic.')
    .withCapabilities(['research', 'data-gathering'])
    .build();

  const writerRole = new RoleBuilder('Writer')
    
    .withSystemPrompt('Write content based on research findings.')
    .withCapabilities(['writing', 'content-creation'])
    .build();

  const editorRole = new RoleBuilder('Editor')
    
    .withSystemPrompt('Edit and improve the written content.')
    .withCapabilities(['editing', 'quality-assurance'])
    .build();

  // Create agents
  const researcher = new AgentBuilder('researcher-1')
    .withRole(researcherRole)
    .withModel(model)
    .build();

  const writer = new AgentBuilder('writer-1')
    .withRole(writerRole)
    .withModel(model)
    .build();

  const editor = new AgentBuilder('editor-1')
    .withRole(editorRole)
    .withModel(model)
    .build();

  // Define sequential steps
  const steps = [
    new StepBuilder('research')
      .withName('Research Phase')
      .withDescription('Gather information on the topic')
      .withAgents([researcher.id])
      .withExecutionType('sequential')
      .build(),

    new StepBuilder('write')
      .withName('Writing Phase')
      .withDescription('Create content based on research')
      .withAgents([writer.id])
      .withExecutionType('sequential')
      .build(),

    new StepBuilder('edit')
      .withName('Editing Phase')
      .withDescription('Review and improve content')
      .withAgents([editor.id])
      .withExecutionType('sequential')
      .build(),
  ];

  // Build workflow configuration
  const workflow = new WorkflowConfigBuilder('content-creation')
    .withName('Content Creation Pipeline')
    .withDescription('Sequential workflow: Research → Write → Edit')
    .addSteps(steps)
    .withAgents([researcher, writer, editor])
    .build();

  console.log('Workflow:', workflow.name);
  console.log('Steps:', workflow.steps.map(s => s.name).join(' → '));

  // Execute the workflow
  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const context: WorkflowContext = {
    prompt: 'Create an article about the benefits of remote work',
    stepResults: new Map(),
    metadata: {},
  };

  console.log('\nExecuting workflow...\n');
  const result = await executor.execute(workflow, context);

  console.log('Status:', result.success ? '✓ Success' : '✗ Failed');
  console.log('Total Duration:', result.totalDuration, 'ms');
  console.log('Step Results:');
  result.stepResults.forEach((stepResult, stepId) => {
    console.log(`  ${stepId}: ${stepResult.success ? '✓' : '✗'} (${stepResult.duration}ms)`);
  });
}

/**
 * Example 2: Sequential with Data Transformation
 */
async function sequentialWithTransformation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Sequential with Transformation');
  console.log('='.repeat(60) + '\n');

  const model = new ContextAwareModel('Claude');

  // Define a pipeline with transformations
  const analyzerRole = new RoleBuilder('Data Analyzer')
    
    .withSystemPrompt('Analyze data and extract insights.')
    .build();

  const formatterRole = new RoleBuilder('Report Formatter')
    
    .withSystemPrompt('Format analysis into a structured report.')
    .build();

  const summarizerRole = new RoleBuilder('Summarizer')
    
    .withSystemPrompt('Create an executive summary.')
    .build();

  const analyzer = new AgentBuilder('analyzer')
    .withRole(analyzerRole)
    .withModel(model)
    .build();

  const formatter = new AgentBuilder('formatter')
    .withRole(formatterRole)
    .withModel(model)
    .build();

  const summarizer = new AgentBuilder('summarizer')
    .withRole(summarizerRole)
    .withModel(model)
    .build();

  const steps = [
    new StepBuilder('analyze')
      .withName('Data Analysis')
      .withAgents([analyzer.id])
      .withExecutionType('sequential')
      .withResultTransformer((result) => {
        // Transform raw analysis into structured format
        return {
          original: result,
          structured: {
            insights: ['Insight 1', 'Insight 2'],
            metrics: { score: 85 },
          },
        };
      })
      .build(),

    new StepBuilder('format')
      .withName('Report Formatting')
      .withAgents([formatter.id])
      .withExecutionType('sequential')
      .withResultTransformer((result) => {
        return {
          ...result,
          formatted: true,
          sections: ['Overview', 'Details', 'Recommendations'],
        };
      })
      .build(),

    new StepBuilder('summarize')
      .withName('Executive Summary')
      .withAgents([summarizer.id])
      .withExecutionType('sequential')
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('analysis-pipeline')
    .withName('Analysis Pipeline')
    .addSteps(steps)
    .withAgents([analyzer, formatter, summarizer])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const context: WorkflowContext = {
    prompt: 'Analyze Q3 sales performance data',
    stepResults: new Map(),
    metadata: { quarter: 'Q3', year: 2024 },
  };

  console.log('Executing analysis pipeline...\n');
  const result = await executor.execute(workflow, context);

  console.log('Pipeline Results:');
  result.stepResults.forEach((stepResult, stepId) => {
    console.log(`\n${stepId}:`);
    console.log(`  Success: ${stepResult.success}`);
    console.log(`  Duration: ${stepResult.duration}ms`);
  });
}

/**
 * Example 3: Multi-Stage Document Processing
 */
async function documentProcessingPipeline(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Document Processing Pipeline');
  console.log('='.repeat(60) + '\n');

  const model = new ContextAwareModel('GPT-4');

  // Document processing stages
  const stages = [
    { id: 'extract', name: 'Content Extraction', role: 'Extractor' },
    { id: 'classify', name: 'Document Classification', role: 'Classifier' },
    { id: 'enrich', name: 'Metadata Enrichment', role: 'Enricher' },
    { id: 'validate', name: 'Validation', role: 'Validator' },
    { id: 'store', name: 'Storage Preparation', role: 'Archiver' },
  ];

  const agents = stages.map(stage => 
    new AgentBuilder(stage.id)
      .withRole(
        new RoleBuilder(stage.role)
          
          .withSystemPrompt(`Handle the ${stage.name.toLowerCase()} stage.`)
          .build()
      )
      .withModel(model)
      .build()
  );

  const steps = stages.map((stage, index) =>
    new StepBuilder(stage.id)
      .withName(stage.name)
      .withDescription(`Stage ${index + 1} of document processing`)
      .withAgents([stage.id])
      .withExecutionType('sequential')
      .build()
  );

  const workflow = new WorkflowConfigBuilder('doc-processing')
    .withName('Document Processing Pipeline')
    .withDescription('Multi-stage document processing')
    .addSteps(steps)
    .withAgents(agents)
    .build();

  console.log('Document Processing Pipeline:');
  steps.forEach((step, i) => {
    const arrow = i < steps.length - 1 ? ' →' : '';
    console.log(`  ${i + 1}. ${step.name}${arrow}`);
  });

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const context: WorkflowContext = {
    prompt: 'Process incoming invoice document',
    stepResults: new Map(),
    metadata: { 
      documentType: 'invoice',
      source: 'email-attachment',
    },
  };

  console.log('\nProcessing document...\n');
  const result = await executor.execute(workflow, context);

  console.log('Processing Complete:');
  console.log(`  Status: ${result.success ? '✓ All stages passed' : '✗ Pipeline failed'}`);
  console.log(`  Total Time: ${result.totalDuration}ms`);
  
  let stageNum = 1;
  result.stepResults.forEach((stepResult, stepId) => {
    const status = stepResult.success ? '✓' : '✗';
    console.log(`  Stage ${stageNum++} (${stepId}): ${status}`);
  });
}

/**
 * Example 4: Sequential with Checkpoints
 */
async function sequentialWithCheckpoints(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Sequential with Checkpoints');
  console.log('='.repeat(60) + '\n');

  const model = new ContextAwareModel('GPT-4');

  // Checkpoint tracking
  const checkpoints: Array<{ step: string; timestamp: Date; data: unknown }> = [];

  const saveCheckpoint = (step: string, data: unknown): void => {
    checkpoints.push({ step, timestamp: new Date(), data });
    console.log(`  📍 Checkpoint saved: ${step}`);
  };

  // Create agents
  const agentA = new AgentBuilder('step-a')
    .withRole(new RoleBuilder('Agent A').build())
    .withModel(model)
    .build();

  const agentB = new AgentBuilder('step-b')
    .withRole(new RoleBuilder('Agent B').build())
    .withModel(model)
    .build();

  const agentC = new AgentBuilder('step-c')
    .withRole(new RoleBuilder('Agent C').build())
    .withModel(model)
    .build();

  const steps = [
    new StepBuilder('step-a')
      .withName('Step A')
      .withAgents([agentA.id])
      .withExecutionType('sequential')
      .withResultTransformer((result) => {
        saveCheckpoint('step-a', result);
        return result;
      })
      .build(),

    new StepBuilder('step-b')
      .withName('Step B')
      .withAgents([agentB.id])
      .withExecutionType('sequential')
      .withResultTransformer((result) => {
        saveCheckpoint('step-b', result);
        return result;
      })
      .build(),

    new StepBuilder('step-c')
      .withName('Step C')
      .withAgents([agentC.id])
      .withExecutionType('sequential')
      .withResultTransformer((result) => {
        saveCheckpoint('step-c', result);
        return result;
      })
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('checkpointed')
    .withName('Checkpointed Workflow')
    .addSteps(steps)
    .withAgents([agentA, agentB, agentC])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  console.log('Executing with checkpoints...\n');
  await executor.execute(workflow, {
    prompt: 'Process with checkpoints',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nCheckpoint Summary:');
  checkpoints.forEach((cp, i) => {
    console.log(`  ${i + 1}. ${cp.step} @ ${cp.timestamp.toISOString()}`);
  });
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicSequentialWorkflow();
    await sequentialWithTransformation();
    await documentProcessingPipeline();
    await sequentialWithCheckpoints();

    console.log('\n✨ All sequential workflow examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  basicSequentialWorkflow,
  sequentialWithTransformation,
  documentProcessingPipeline,
  sequentialWithCheckpoints,
};
