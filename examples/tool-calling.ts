/**
 * Example: Tool Calling System
 * 
 * This example demonstrates how agents can use tools to perform
 * actions like calculations, web searches, and data storage.
 */

import {
  ToolBuilder,
  ToolRegistry,
  ToolExecutor,
  BuiltInTools,
  AgentBuilder,
  RoleBuilder,
  StandardModelBase,
} from '../src';

// Mock AI Model that calls tools
class ToolCallingModel extends StandardModelBase {
  constructor() {
    super({ name: 'tool-caller' }, async (prompt: unknown) => {
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      
      // Simulate tool calling
      if (promptStr.includes('calculate')) {
        return JSON.stringify({
          tool: 'calculator',
          parameters: { expression: '125 * 8 + 42' }
        });
      } else if (promptStr.includes('previous output')) {
        return 'The calculation result is 1042. This is the answer to your question.';
      }
      
      return 'I can help you with calculations, string manipulation, and data storage.';
    });
  }
}

async function runToolExample(): Promise<void> {
  console.log('=== Tool Calling Example ===\n');

  // Create tool registry
  const registry = new ToolRegistry();

  // Register built-in tools
  registry.register(BuiltInTools.calculator());
  registry.register(BuiltInTools.stringManipulation());
  registry.register(BuiltInTools.storage());

  // Create a custom tool
  const webSearchTool = ToolBuilder.create()
    .withName('web_search')
    .withDescription('Search the web for information')
    .withParameters({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results', default: 5 },
      },
      required: ['query'],
    })
    .withExecutor(async (params) => {
      // Simulate web search
      const query = params.query as string;
      return {
        results: [
          { title: `Result 1 for "${query}"`, url: 'https://example.com/1' },
          { title: `Result 2 for "${query}"`, url: 'https://example.com/2' },
        ],
      };
    })
    .build();

  registry.register(webSearchTool);

  console.log('Registered tools:', registry.getAll().map(t => t.name).join(', '));
  console.log();

  // Create tool executor
  const executor = new ToolExecutor(registry);

  // Create agent with tools
  const model = new ToolCallingModel();
  const agentRole = RoleBuilder.create()
    .withId('assistant')
    .withName('Tool-Using Assistant')
    .withSystemPrompt('You are an assistant that can use tools to help users.')
    .build();

  const agent = AgentBuilder.create()
    .withId('assistant-1')
    .withRole(agentRole)
    .withModel(model)
    .build();

  // Agent executor function
  const agentExecutor = async (input: string): Promise<string> => {
    const prompt = agent.role.promptTemplate?.replace('{input}', input) || input;
    return await agent.model.process(prompt);
  };

  // Execute agent with tool calling loop
  console.log('Query: What is 125 * 8 + 42?\n');
  
  const result = await executor.executeWithTools(
    agentExecutor,
    'What is 125 * 8 + 42? Please calculate it.',
    undefined,
    5 // max iterations
  );

  console.log('Final output:', result.output);
  console.log('\nTool calls made:', result.toolResults.length);
  
  for (const toolResult of result.toolResults) {
    console.log(`- ${toolResult.tool}: ${toolResult.success ? '✓' : '✗'}`);
    if (toolResult.result) {
      console.log(`  Result:`, toolResult.result);
    }
  }

  // Test string manipulation tool
  console.log('\n--- String Manipulation ---');
  
  const stringResult = await registry.execute({
    name: 'string_manipulation',
    parameters: {
      text: 'Hello World',
      operation: 'reverse',
    },
  });

  console.log('Reverse "Hello World":', stringResult.result);

  // Test storage tool
  console.log('\n--- Data Storage ---');
  
  await registry.execute({
    name: 'storage',
    parameters: {
      operation: 'set',
      key: 'user_preference',
      value: 'dark_mode',
    },
  });

  const storedValue = await registry.execute({
    name: 'storage',
    parameters: {
      operation: 'get',
      key: 'user_preference',
    },
  });

  console.log('Stored value:', storedValue.result);
}

// Run the example
if (require.main === module) {
  runToolExample().catch(console.error);
}

export { runToolExample };
