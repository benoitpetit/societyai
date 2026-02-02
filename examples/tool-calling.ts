import { ToolBuilder, ToolRegistry } from '../src';

// Create a tool
const calculator = ToolBuilder.create()
  .withName('calculator')
  .withDescription('Perform basic calculations')
  .withParameters({
    type: 'object',
    properties: {
      a: { type: 'number', description: 'First number' },
      b: { type: 'number', description: 'Second number' },
      operation: {
        type: 'string',
        description: 'Operation (add, subtract)',
        enum: ['add', 'subtract'],
      },
    },
    required: ['a', 'b', 'operation'],
  })
  .withExecutor(async (params: Record<string, unknown>) => {
    const { a, b, operation } = params as { a: number; b: number; operation: string };
    if (operation === 'add') return a + b;
    if (operation === 'subtract') return a - b;
    throw new Error(`Unknown operation: ${operation}`);
  })
  .build();

const registry = new ToolRegistry();
registry.register(calculator);

async function run(): Promise<void> {
  console.log('Executing tool...');
  try {
    const result = await calculator.execute({ a: 10, b: 5, operation: 'add' });
    console.log('Tool Result (10 + 5):', result);
  } catch (error) {
    console.error('Error executing tool:', error);
  }
}

run().catch(console.error);
