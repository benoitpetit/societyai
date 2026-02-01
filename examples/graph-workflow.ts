/**
 * Example: Using SocietyGraph for Complex Workflows
 * 
 * This example demonstrates how to use the graph-based execution engine
 * to create a sophisticated code review workflow with conditional branching,
 * loops, and parallel execution.
 */

import {
  GraphBuilder,
  NodeType,
  AgentBuilder,
  RoleBuilder,
  StandardModelBase,
} from '../src';

// Mock AI Model for demonstration
class MockModel extends StandardModelBase {
  constructor(name: string) {
    super({ name }, async (prompt: unknown) => {
      // Simulate AI response
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      
      if (promptStr.includes('analyze')) {
        return 'The code looks good but needs better error handling.';
      } else if (promptStr.includes('valid')) {
        return 'valid: true\nThe improvements have been applied successfully.';
      } else if (promptStr.includes('fix')) {
        return 'Added try-catch blocks and improved error messages.';
      }
      
      return 'Task completed successfully.';
    });
  }
}

async function runGraphExample(): Promise<void> {
  console.log('=== Graph-Based Workflow Example ===\n');

  // Create AI models
  const model = new MockModel('code-analyzer');

  // Create agent roles
  const analyzerRole = RoleBuilder.create()
    .withId('analyzer')
    .withName('Code Analyzer')
    .withSystemPrompt('You analyze code and identify issues.')
    .build();

  const fixerRole = RoleBuilder.create()
    .withId('fixer')
    .withName('Code Fixer')
    .withSystemPrompt('You fix code issues.')
    .build();

  const validatorRole = RoleBuilder.create()
    .withId('validator')
    .withName('Code Validator')
    .withSystemPrompt('You validate code fixes.')
    .build();

  // Create agents
  const agents = [
    AgentBuilder.create()
      .withId('analyzer-1')
      .withRole(analyzerRole)
      .withModel(model)
      .build(),
    AgentBuilder.create()
      .withId('fixer-1')
      .withRole(fixerRole)
      .withModel(model)
      .build(),
    AgentBuilder.create()
      .withId('validator-1')
      .withRole(validatorRole)
      .withModel(model)
      .build(),
  ];

  // Build the graph
  const graph = GraphBuilder.create()
    // Start node
    .addNode('start', NodeType.START)
    
    // Analyze the code
    .addNode('analyze', NodeType.AGENT, { agentId: 'analyzer-1' })
    
    // Conditional: Does it need fixing?
    .addNode('needs-fix', NodeType.CONDITION, {
      condition: (result) => !result.includes('looks good'),
    })
    
    // Fix the code
    .addNode('fix', NodeType.AGENT, { agentId: 'fixer-1' })
    
    // Validate the fix
    .addNode('validate', NodeType.AGENT, { agentId: 'validator-1' })
    
    // Conditional: Is it valid?
    .addNode('is-valid', NodeType.CONDITION, {
      condition: (result) => result.includes('valid: true'),
    })
    
    // Transform for final output
    .addNode('format', NodeType.TRANSFORM, {
      transformer: (result) => `✓ Code Review Complete:\n${result}`,
    })
    
    // End node
    .addNode('end', NodeType.END)
    
    // Connect the nodes
    .addEdge('start', 'analyze')
    .addEdge('analyze', 'needs-fix')
    
    // Conditional edges
    .addConditionalEdge({
      from: 'needs-fix',
      condition: (result) => !result.includes('looks good'),
      truePath: 'fix',
      falsePath: 'format',
    })
    
    .addEdge('fix', 'validate')
    .addEdge('validate', 'is-valid')
    
    // Loop back if validation fails (max 3 iterations)
    .addConditionalEdge({
      from: 'is-valid',
      condition: (result) => result.includes('valid: true'),
      truePath: 'format',
      falsePath: 'fix',
    })
    
    .addEdge('format', 'end')
    
    .build();

  // Execute the graph
  console.log('Visualizing graph structure:');
  console.log(graph.visualize());
  console.log('\nExecuting workflow...\n');

  const result = await graph.execute(
    'Analyze this TypeScript function for potential issues',
    agents
  );

  console.log('Result:', result.output);
  console.log('\nExecution path:', result.executionPath.join(' → '));
  console.log('Duration:', result.duration, 'ms');
  console.log('Success:', result.success);
}

// Run the example
if (require.main === module) {
  runGraphExample().catch(console.error);
}

export { runGraphExample };
