/**
 * Example: Result Transformers
 * 
 * Process and transform agent outputs.
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
 * Simple model for demonstrations
 */
class SimpleModel extends StandardModelBase {
  constructor(name = 'SimpleModel') {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return `Response to: ${String(prompt).substring(0, 50)}...`;
      }
    );
  }
}

/**
 * Model that returns structured data
 */
class StructuredModel extends StandardModelBase {
  constructor(private dataGenerator: () => unknown) {
    super(
      { name: 'StructuredModel', timeout: 10000 },
      async (_prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return JSON.stringify(dataGenerator());
      }
    );
  }
}

/**
 * Example 1: Basic Result Transformation
 */
async function basicTransformation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Result Transformation');
  console.log('='.repeat(60) + '\n');

  const model = new SimpleModel();
  const agent = new AgentBuilder('agent-1')
    .withRole(new RoleBuilder('Processor').build())
    .withModel(model)
    .build();

  const step = new StepBuilder('process')
    .withName('Process with Transformation')
    .addAgents([agent.id])
    .withExecutionType('sequential')
    .withResultTransformer((result) => {
      // Transform the raw result
      return {
        original: result,
        length: String(result).length,
        uppercase: String(result).toUpperCase(),
        timestamp: new Date().toISOString(),
      };
    })
    .build();

  const workflow = new WorkflowConfigBuilder('transform-basic')
    .withName('Basic Transformation')
    .addSteps([step])
    .addAgents([agent])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Test input',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Transformed Result:');
  const stepResult = result.stepResults.get('process');
  console.log(JSON.stringify(stepResult?.agentResults[0], null, 2));
}

/**
 * Example 2: JSON Parsing Transformer
 */
async function jsonParsingTransformer(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: JSON Parsing Transformer');
  console.log('='.repeat(60) + '\n');

  const model = new StructuredModel(() => ({
    analysis: {
      score: 85,
      confidence: 0.92,
      categories: ['technology', 'innovation'],
    },
    recommendations: [
      'Increase investment in R&D',
      'Focus on customer feedback',
    ],
  }));

  const agent = new AgentBuilder('analyzer')
    .withRole(new RoleBuilder('Analyzer').build())
    .withModel(model)
    .build();

  const step = new StepBuilder('analyze')
    .withName('Analyze with JSON Parsing')
    .addAgents([agent.id])
    .withExecutionType('sequential')
    .withResultTransformer((result) => {
      try {
        return JSON.parse(String(result));
      } catch {
        return { error: 'Failed to parse JSON', raw: result };
      }
    })
    .build();

  const workflow = new WorkflowConfigBuilder('json-parse')
    .withName('JSON Parsing Workflow')
    .addSteps([step])
    .addAgents([agent])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Analyze market data',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Parsed Result:');
  const stepResult = result.stepResults.get('analyze');
  console.log(JSON.stringify(stepResult?.agentResults[0], null, 2));
}

/**
 * Example 3: Aggregation Transformer
 */
async function aggregationTransformer(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Aggregation Transformer');
  console.log('='.repeat(60) + '\n');

  // Create multiple agents with different scores
  const agents = Array.from({ length: 5 }, (_, i) =>
    new AgentBuilder(`scorer-${i + 1}`)
      .withRole(new RoleBuilder(`Scorer ${i + 1}`).build())
      .withModel(new StructuredModel(() => ({
        score: 70 + Math.floor(Math.random() * 30),
        confidence: 0.8 + Math.random() * 0.2,
      })))
      .build()
  );

  const step = new StepBuilder('score')
    .withName('Parallel Scoring')
    .withAgents(agents.map(a => a.id))
    .withExecutionType('parallel')
    .withResultTransformer((results) => {
      // Aggregate results from all agents
      if (Array.isArray(results)) {
        const scores = results.map(r => {
          const parsed = JSON.parse(String(r));
          return parsed.score;
        });

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        const max = Math.max(...scores);

        return {
          individualScores: scores,
          average: avg.toFixed(2),
          min,
          max,
          range: max - min,
          count: scores.length,
        };
      }
      return results;
    })
    .build();

  const workflow = new WorkflowConfigBuilder('aggregate')
    .withName('Score Aggregation')
    .addSteps([step])
    .withAgents(agents)
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Score this proposal',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Aggregated Scores:');
  const stepResult = result.stepResults.get('score');
  if (stepResult?.agentResults) {
    console.log(JSON.stringify(stepResult.agentResults, null, 2));
  }
}

/**
 * Example 4: Chained Transformations
 */
async function chainedTransformations(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Chained Transformations');
  console.log('='.repeat(60) + '\n');

  const model = new SimpleModel();
  
  const agents = [
    new AgentBuilder('step-1')
      .withRole(new RoleBuilder('Step 1').build())
      .withModel(model)
      .build(),
    new AgentBuilder('step-2')
      .withRole(new RoleBuilder('Step 2').build())
      .withModel(model)
      .build(),
    new AgentBuilder('step-3')
      .withRole(new RoleBuilder('Step 3').build())
      .withModel(model)
      .build(),
  ];

  const steps = [
    new StepBuilder('extract')
      .withName('Extract')
      .addAgents(['step-1'])
      .withExecutionType('sequential')
      .withResultTransformer((result) => ({
        stage: 'extracted',
        data: String(result),
        extractedAt: Date.now(),
      }))
      .build(),

    new StepBuilder('transform')
      .withName('Transform')
      .addAgents(['step-2'])
      .withExecutionType('sequential')
      .withResultTransformer((result) => ({
        stage: 'transformed',
        previous: result,
        transformedAt: Date.now(),
      }))
      .build(),

    new StepBuilder('load')
      .withName('Load')
      .addAgents(['step-3'])
      .withExecutionType('sequential')
      .withResultTransformer((result) => ({
        stage: 'loaded',
        previous: result,
        loadedAt: Date.now(),
        complete: true,
      }))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('etl')
    .withName('ETL Pipeline')
    .addSteps(steps)
    .withAgents(agents)
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Process data',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Pipeline Stages:');
  result.stepResults.forEach((stepResult, stepId) => {
    console.log(`\n${stepId}:`);
    console.log(JSON.stringify(stepResult.agentResults[0], null, 2));
  });
}

/**
 * Example 5: Validation Transformer
 */
async function validationTransformer(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Validation Transformer');
  console.log('='.repeat(60) + '\n');

  const model = new StructuredModel(() => ({
    name: 'Product X',
    price: 29.99,
    quantity: 100,
    category: 'electronics',
  }));

  const agent = new AgentBuilder('data-producer')
    .withRole(new RoleBuilder('Data Producer').build())
    .withModel(model)
    .build();

  interface ValidationResult {
    valid: boolean;
    data: unknown;
    errors: string[];
    warnings: string[];
  }

  const step = new StepBuilder('validate')
    .withName('Produce and Validate')
    .addAgents([agent.id])
    .withExecutionType('sequential')
    .withResultTransformer((result): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(String(result));
      } catch {
        return { valid: false, data: null, errors: ['Invalid JSON'], warnings: [] };
      }

      // Validate required fields
      if (!data.name) errors.push('Missing required field: name');
      if (!data.price) errors.push('Missing required field: price');

      // Validate types
      if (typeof data.price !== 'number') errors.push('Price must be a number');
      if (typeof data.quantity !== 'number') errors.push('Quantity must be a number');

      // Validate values
      if (data.price && (data.price as number) < 0) errors.push('Price cannot be negative');
      if (data.quantity && (data.quantity as number) < 0) errors.push('Quantity cannot be negative');

      // Warnings
      if (data.price && (data.price as number) > 1000) warnings.push('High price detected');
      if (!data.category) warnings.push('No category specified');

      return {
        valid: errors.length === 0,
        data,
        errors,
        warnings,
      };
    })
    .build();

  const workflow = new WorkflowConfigBuilder('validate')
    .withName('Validation Workflow')
    .addSteps([step])
    .addAgents([agent])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Generate product data',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Validation Result:');
  const stepResult = result.stepResults.get('validate');
  console.log(JSON.stringify(stepResult?.agentResults[0], null, 2));
}

/**
 * Example 6: Enrichment Transformer
 */
async function enrichmentTransformer(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 6: Enrichment Transformer');
  console.log('='.repeat(60) + '\n');

  const model = new StructuredModel(() => ({
    userId: 'user-123',
    action: 'purchase',
    itemId: 'item-456',
    amount: 99.99,
  }));

  const agent = new AgentBuilder('event-generator')
    .withRole(new RoleBuilder('Event Generator').build())
    .withModel(model)
    .build();

  const step = new StepBuilder('enrich')
    .withName('Generate and Enrich Event')
    .addAgents([agent.id])
    .withExecutionType('sequential')
    .withResultTransformer((result) => {
      const event = JSON.parse(String(result));

      // Enrich with additional context
      return {
        ...event,
        // Add metadata
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        version: '1.0',

        // Add computed fields
        formattedAmount: `$${event.amount.toFixed(2)}`,
        isHighValue: event.amount > 50,

        // Add source info
        source: {
          system: 'societyai',
          component: 'enrichment-transformer',
          processedAt: Date.now(),
        },

        // Add classification
        classification: {
          type: event.action === 'purchase' ? 'transaction' : 'activity',
          priority: event.amount > 100 ? 'high' : 'normal',
        },
      };
    })
    .build();

  const workflow = new WorkflowConfigBuilder('enrich')
    .withName('Enrichment Workflow')
    .addSteps([step])
    .addAgents([agent])
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Generate user event',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Enriched Event:');
  const stepResult = result.stepResults.get('enrich');
  console.log(JSON.stringify(stepResult?.agentResults[0], null, 2));
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicTransformation();
    await jsonParsingTransformer();
    await aggregationTransformer();
    await chainedTransformations();
    await validationTransformer();
    await enrichmentTransformer();

    console.log('\n✨ All transformer examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SimpleModel, StructuredModel };
