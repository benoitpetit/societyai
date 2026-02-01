/**
 * Example: Complete Integration
 * 
 * This example demonstrates all new features working together:
 * - Graph-based execution
 * - Tool calling
 * - Memory system
 * - Structured output validation
 * - Metrics tracking
 */

import {
  GraphBuilder,
  NodeType,
  ToolRegistry,
  ToolExecutor,
  ToolBuilder,
  MemoryBuilder,
  MemorySystem,
  StructuredOutputValidator,
  createSchema,
  MetricsBuilder,
  CommonCostConfigs,
  AgentBuilder,
  RoleBuilder,
  StandardModelBase,
} from '../src';

// Advanced AI Model with all features
class AdvancedModel extends StandardModelBase {
  constructor(
    name: string,
    private memory: MemorySystem,
    private toolExecutor: ToolExecutor,
    private validator?: StructuredOutputValidator
  ) {
    super({ name }, async (prompt: unknown) => {
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      
      // Retrieve relevant context from memory
      const context = await this.memory.retrieve(promptStr, { limit: 3 });
      
      // Generate response with context
      let response = `Based on context:\n${context}\n\n`;
      
      if (promptStr.includes('calculate')) {
        response += '{"tool": "calculator", "parameters": {"expression": "100 * 5"}}';
      } else if (promptStr.includes('user data')) {
        response = `{
  "name": "Alice Johnson",
  "age": 28,
  "email": "alice@example.com",
  "role": "Software Engineer",
  "skills": ["TypeScript", "React", "Node.js"]
}`;
      } else {
        response += 'Analysis complete. Ready for next step.';
      }
      
      // Store in memory
      await this.memory.add(response, {
        type: 'conversation',
        importance: 0.7,
      });
      
      return response;
    });
  }
}

async function runCompleteExample(): Promise<void> {
  console.log('=== Complete Integration Example ===\n');
  console.log('This example combines all new features:\n');
  console.log('✓ Graph-based workflow execution');
  console.log('✓ Tool calling capabilities');
  console.log('✓ Multi-level memory system');
  console.log('✓ Structured output validation');
  console.log('✓ Comprehensive metrics tracking\n');

  // 1. Setup Metrics Tracker
  console.log('--- Setting up Metrics Tracker ---');
  const tracker = MetricsBuilder.create()
    .withTokenTracking()
    .withCostTracking(CommonCostConfigs['gpt-4'])
    .build();
  
  tracker.start('complete-workflow', { scenario: 'user-onboarding' });

  // 2. Setup Memory System
  console.log('--- Initializing Memory System ---');
  const memory = MemoryBuilder.create()
    .withShortTermMemory({ maxMessages: 20 })
    .withLongTermMemory({ maxEntries: 100 })
    .build();

  // Add some initial knowledge
  await memory.add('System supports user onboarding workflow', {
    type: 'fact',
    importance: 1.0,
  });
  
  await memory.add('Users must provide name, email, and role', {
    type: 'fact',
    importance: 0.9,
  });

  // Add entity
  memory.getEntities().upsert('UserOnboardingService', 'service', [
    'Validates user data',
    'Stores user profiles',
    'Sends welcome emails',
  ]);

  // 3. Setup Tool Registry
  console.log('--- Registering Tools ---');
  const toolRegistry = new ToolRegistry();
  
  // Calculator tool
  const calculatorTool = ToolBuilder.create()
    .withName('calculator')
    .withDescription('Perform calculations')
    .withParameters({
      type: 'object',
      properties: {
        expression: { type: 'string' },
      },
      required: ['expression'],
    })
    .withExecutor(async (params) => {
      const result = eval(params.expression as string);
      return { result };
    })
    .build();

  // Email sender tool
  const emailTool = ToolBuilder.create()
    .withName('send_email')
    .withDescription('Send email to user')
    .withParameters({
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    })
    .withExecutor(async (params) => {
      console.log(`  📧 Email sent to ${params.to}`);
      return { success: true, messageId: 'msg_' + Date.now() };
    })
    .build();

  toolRegistry.register(calculatorTool);
  toolRegistry.register(emailTool);

  const toolExecutor = new ToolExecutor(toolRegistry);

  // 4. Setup Structured Output Validator
  console.log('--- Configuring Validation Schema ---');
  const userSchema = createSchema({
    name: { type: 'string', required: true },
    age: { type: 'number', required: true },
    email: { type: 'string', required: true },
    role: { type: 'string', required: true },
    skills: { type: 'array', required: false },
  });

  const validator = new StructuredOutputValidator(userSchema);

  // 5. Create Agents with Advanced Models
  console.log('--- Creating Intelligent Agents ---');
  
  const dataCollectorRole = RoleBuilder.create()
    .withId('data-collector')
    .withName('Data Collector')
    .withSystemPrompt('You collect and validate user data.')
    .build();

  const validatorRole = RoleBuilder.create()
    .withId('validator')
    .withName('Data Validator')
    .withSystemPrompt('You validate user data against schema.')
    .build();

  const notifierRole = RoleBuilder.create()
    .withId('notifier')
    .withName('Notification Service')
    .withSystemPrompt('You send notifications to users.')
    .build();

  const agents = [
    AgentBuilder.create()
      .withId('collector-1')
      .withRole(dataCollectorRole)
      .withModel(new AdvancedModel('collector-model', memory, toolExecutor, validator))
      .build(),
    
    AgentBuilder.create()
      .withId('validator-1')
      .withRole(validatorRole)
      .withModel(new AdvancedModel('validator-model', memory, toolExecutor, validator))
      .build(),
    
    AgentBuilder.create()
      .withId('notifier-1')
      .withRole(notifierRole)
      .withModel(new AdvancedModel('notifier-model', memory, toolExecutor))
      .build(),
  ];

  // 6. Build Execution Graph
  console.log('--- Building Execution Graph ---');
  const graph = GraphBuilder.create()
    .addNode('start', NodeType.START)
    
    // Collect user data
    .addNode('collect', NodeType.AGENT, { agentId: 'collector-1' })
    
    // Validate the data
    .addNode('validate', NodeType.AGENT, { agentId: 'validator-1' })
    
    // Check if validation passed
    .addNode('is-valid', NodeType.CONDITION, {
      condition: (result) => result.includes('"email"') && result.includes('@'),
    })
    
    // Calculate onboarding bonus (example tool usage)
    .addNode('calculate-bonus', NodeType.TRANSFORM, {
      transformer: (result) => {
        return result + '\nOnboarding bonus: $500';
      },
    })
    
    // Send welcome email
    .addNode('notify', NodeType.AGENT, { agentId: 'notifier-1' })
    
    // Final formatting
    .addNode('format', NodeType.TRANSFORM, {
      transformer: (result) => `✅ User Onboarded Successfully\n\n${result}`,
    })
    
    .addNode('end', NodeType.END)
    
    // Connect nodes
    .addEdge('start', 'collect')
    .addEdge('collect', 'validate')
    .addEdge('validate', 'is-valid')
    
    .addConditionalEdge({
      from: 'is-valid',
      condition: (result) => result.includes('"email"') && result.includes('@'),
      truePath: 'calculate-bonus',
      falsePath: 'collect', // Retry data collection
    })
    
    .addEdge('calculate-bonus', 'notify')
    .addEdge('notify', 'format')
    .addEdge('format', 'end')
    
    .build();

  // 7. Execute the Complete Workflow
  console.log('\n--- Executing Complete Workflow ---\n');
  
  const result = await graph.execute(
    'Onboard new user: Please collect user data, validate it, and send welcome notification.',
    agents
  );

  console.log('\n--- Workflow Results ---');
  console.log('Output:', result.output);
  console.log('\nExecution path:', result.executionPath.join(' → '));
  console.log('Duration:', result.duration, 'ms');
  console.log('Success:', result.success);

  // 8. Collect and Display Metrics
  console.log('\n--- Performance Metrics ---');
  
  const metrics = tracker.end('complete-workflow', {
    tokens: {
      inputTokens: 1200,
      outputTokens: 800,
      totalTokens: 2000,
      model: 'gpt-4',
    },
    custom: {
      nodesExecuted: result.nodeResults.size,
      toolCalls: 2,
    },
  });

  console.log('Total duration:', metrics.execution.duration, 'ms');
  console.log('Tokens used:', metrics.tokens?.totalTokens);
  console.log('Estimated cost:', `$${metrics.cost?.totalCost.toFixed(4)}`);
  console.log('Nodes executed:', metrics.custom?.nodesExecuted);

  // 9. Display Memory State
  console.log('\n--- Memory State ---');
  const memoryStats = memory.getStats();
  console.log('Short-term messages:', memoryStats.shortTerm.messages);
  console.log('Long-term facts:', memoryStats.longTerm.total);
  console.log('Entities tracked:', memoryStats.entities.total);

  // 10. Display Recent Conversations
  console.log('\n--- Recent Memory ---');
  const recentMemories = memory.getShortTerm().getRecent(3);
  recentMemories.forEach((mem, idx) => {
    console.log(`${idx + 1}. ${mem.content.substring(0, 100)}...`);
  });

  // 11. Export Telemetry
  console.log('\n--- Exporting Telemetry ---');
  const otelTraces = tracker.exportOTel();
  console.log('Generated', otelTraces.length, 'OpenTelemetry traces');
  console.log('Ready for export to observability platform');

  console.log('\n✅ Complete workflow executed successfully!');
  console.log('All systems integrated and working together.');
}

// Run the example
if (require.main === module) {
  runCompleteExample().catch(console.error);
}

export { runCompleteExample };
