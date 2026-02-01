# Tool Calling System

The Tool Calling System enables AI agents to interact with external functions, APIs, and services. Agents can discover available tools, call them with validated parameters, and integrate the results into their responses.

## Overview

The Tool Calling System provides:

- **Tool Registry**: Centralized management of available tools
- **JSON Schema Validation**: Automatic parameter validation
- **Automatic Retry**: Built-in retry logic for failed tool calls
- **Built-in Tools**: Pre-configured common utilities
- **Parallel Execution**: Execute multiple tools simultaneously
- **Tool Extraction**: Parse tool calls from agent output

## Core Components

### Tool

A tool represents a callable function with metadata:

```typescript
interface Tool {
  name: string; // Unique tool identifier
  description: string; // What the tool does
  parameters: JSONSchema; // Parameter schema
  executor: (params: Record<string, unknown>) => Promise<unknown>;
}
```

### ToolBuilder

Create tools with fluent API:

```typescript
import { ToolBuilder } from 'societyai';

const calculator = ToolBuilder.create()
  .withName('calculator')
  .withDescription('Performs basic arithmetic operations')
  .withParameters({
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
      },
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['operation', 'a', 'b'],
  })
  .withExecutor(async (params) => {
    const { operation, a, b } = params as {
      operation: string;
      a: number;
      b: number;
    };

    switch (operation) {
      case 'add':
        return a + b;
      case 'subtract':
        return a - b;
      case 'multiply':
        return a * b;
      case 'divide':
        return b !== 0 ? a / b : 'Error: Division by zero';
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  })
  .build();
```

### ToolRegistry

Manage and execute tools:

```typescript
import { ToolRegistry } from 'societyai';

const registry = new ToolRegistry();

// Register tools
registry.register(calculator);
registry.register(weatherTool);
registry.register(databaseTool);

// Get all tools
const tools = registry.getAll();

// Get specific tool
const calc = registry.get('calculator');

// Unregister
registry.unregister('calculator');

// Execute tool
const result = await registry.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3,
});

console.log(result); // { success: true, result: 8, duration: 2 }
```

### ToolExecutor

Handle tool calling workflows:

```typescript
import { ToolExecutor } from 'societyai';

const executor = new ToolExecutor(registry);

// Extract tool calls from agent output
const agentOutput = `
I'll calculate that for you.
{"tool": "calculator", "parameters": {"operation": "add", "a": 10, "b": 5}}
`;

const { results, hasToolCalls } = await executor.executeFromAgentOutput(agentOutput);

if (hasToolCalls) {
  console.log('Tools executed:', results);
}

// Format results for feedback
const feedback = executor.formatResults(results);
console.log(feedback);
// Output:
// Tool Results:
// ✓ calculator: 15
```

## Built-in Tools

### Calculator

Performs basic arithmetic:

```typescript
import { BuiltInTools } from 'societyai';

const calculator = BuiltInTools.calculator();
registry.register(calculator);

// Usage
const result = await registry.execute('calculator', {
  operation: 'multiply',
  a: 7,
  b: 6,
});
// { success: true, result: 42 }
```

### String Manipulation

Common string operations:

```typescript
const stringTool = BuiltInTools.stringManipulation();
registry.register(stringTool);

// Operations: uppercase, lowercase, reverse, length, trim, replace
const result = await registry.execute('string_manipulation', {
  operation: 'uppercase',
  text: 'hello world',
});
// { success: true, result: 'HELLO WORLD' }
```

### Storage

Simple key-value storage:

```typescript
const storage = BuiltInTools.storage();
registry.register(storage);

// Set value
await registry.execute('storage', {
  operation: 'set',
  key: 'user_name',
  value: 'Alice',
});

// Get value
const result = await registry.execute('storage', {
  operation: 'get',
  key: 'user_name',
});
// { success: true, result: 'Alice' }
```

## Complete Example

```typescript
import {
  ToolBuilder,
  ToolRegistry,
  ToolExecutor,
  BuiltInTools,
  StandardModelBase,
} from 'societyai';

// 1. Create custom tool
const weatherTool = ToolBuilder.create()
  .withName('get_weather')
  .withDescription('Get current weather for a city')
  .withParameters({
    type: 'object',
    properties: {
      city: { type: 'string' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['city'],
  })
  .withExecutor(async (params) => {
    const { city, units = 'celsius' } = params as {
      city: string;
      units?: string;
    };

    // Simulate API call
    const temp = units === 'celsius' ? '22' : '72';
    return `Temperature in ${city}: ${temp}°${units === 'celsius' ? 'C' : 'F'}`;
  })
  .build();

// 2. Setup registry
const registry = new ToolRegistry();
registry.register(weatherTool);
registry.register(BuiltInTools.calculator());
registry.register(BuiltInTools.stringManipulation());

// 3. Create executor
const executor = new ToolExecutor(registry);

// 4. Use with agent
class ToolAwareModel extends StandardModelBase {
  constructor(private toolExecutor: ToolExecutor) {
    super({ name: 'tool-aware' }, async (prompt: unknown) => {
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

      // Agent decides to call tools
      if (promptStr.includes('weather')) {
        return JSON.stringify({
          tool: 'get_weather',
          parameters: { city: 'Paris', units: 'celsius' },
        });
      }

      return 'No tools needed for this task.';
    });
  }

  async process(prompt: unknown): Promise<string> {
    const response = await super.process(prompt);

    // Execute any tool calls
    const { results, hasToolCalls } = await this.toolExecutor.executeFromAgentOutput(response);

    if (hasToolCalls) {
      // Return tool results
      return this.toolExecutor.formatResults(results);
    }

    return response;
  }
}

const model = new ToolAwareModel(executor);
const result = await model.process('What is the weather in Paris?');
console.log(result);
// Tool Results:
// ✓ get_weather: Temperature in Paris: 22°C
```

## Agent-Tool Loop

Implement a full agent-tool calling loop:

```typescript
async function executeWithTools(
  agent: AIModel,
  input: string,
  toolExecutor: ToolExecutor,
  maxIterations: number = 5
): Promise<string> {
  let currentInput = input;
  let iteration = 0;

  while (iteration < maxIterations) {
    // Get agent response
    const response = await agent.process(currentInput);

    // Check for tool calls
    const { results, hasToolCalls } = await toolExecutor.executeFromAgentOutput(response);

    if (!hasToolCalls) {
      // No more tools, return final response
      return response;
    }

    // Format tool results as feedback
    const feedback = toolExecutor.formatResults(results);

    // Continue with tool results
    currentInput = `Previous response: ${response}\n\n${feedback}\n\nContinue your response:`;
    iteration++;
  }

  throw new Error('Max tool calling iterations reached');
}
```

## Parallel Tool Execution

Execute multiple tools simultaneously:

```typescript
const registry = new ToolRegistry();
// ... register tools ...

const tools = [
  { name: 'get_weather', parameters: { city: 'Paris' } },
  { name: 'get_weather', parameters: { city: 'London' } },
  { name: 'get_weather', parameters: { city: 'Tokyo' } },
];

const results = await Promise.all(
  tools.map(({ name, parameters }) => registry.execute(name, parameters))
);

results.forEach((result, i) => {
  console.log(`${tools[i].parameters.city}: ${result.result}`);
});
```

## Parameter Validation

Tools automatically validate parameters against the JSON Schema:

```typescript
const tool = ToolBuilder.create()
  .withName('send_email')
  .withDescription('Send an email')
  .withParameters({
    type: 'object',
    properties: {
      to: {
        type: 'string',
        format: 'email',
      },
      subject: {
        type: 'string',
        minLength: 1,
      },
      body: {
        type: 'string',
      },
    },
    required: ['to', 'subject', 'body'],
  })
  .withExecutor(async (params) => {
    // params are validated before reaching here
    return 'Email sent successfully';
  })
  .build();

registry.register(tool);

// This will fail validation
try {
  await registry.execute('send_email', {
    to: 'invalid-email', // Not a valid email
    subject: '', // Too short
  });
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## Tool Definitions for AI

Get tool definitions in a format suitable for AI models:

```typescript
const definitions = registry.getToolDefinitions();

// Pass to AI model
const systemPrompt = `
You are an assistant with access to these tools:

${JSON.stringify(definitions, null, 2)}

When you need to use a tool, respond with:
{"tool": "tool_name", "parameters": {...}}
`;
```

## Error Handling

Tools can throw errors or return error results:

```typescript
const riskyTool = ToolBuilder.create()
  .withName('risky_operation')
  .withDescription('May fail')
  .withParameters({ type: 'object' })
  .withExecutor(async (params) => {
    if (Math.random() < 0.5) {
      throw new Error('Operation failed');
    }
    return 'Success';
  })
  .build();

const result = await registry.execute('risky_operation', {});

if (!result.success) {
  console.error('Tool failed:', result.error?.message);
}
```

## Context Injection

Pass context to tools:

```typescript
const contextualTool = ToolBuilder.create()
  .withName('get_user_data')
  .withDescription('Get current user data')
  .withParameters({ type: 'object' })
  .withExecutor(async (params, context) => {
    // Access injected context
    const userId = context?.userId;
    return `Data for user ${userId}`;
  })
  .build();

// Execute with context
const result = await registry.execute(
  'get_user_data',
  {},
  { userId: '12345' } // Context
);
```

## Best Practices

1. **Clear Descriptions**: Write detailed tool descriptions for the AI
2. **Strict Schemas**: Use JSON Schema to validate all parameters
3. **Handle Errors**: Tools should gracefully handle failures
4. **Timeout Protection**: Set timeouts for long-running operations
5. **Idempotency**: Make tools idempotent when possible
6. **Logging**: Log tool executions for debugging
7. **Security**: Validate and sanitize tool inputs
8. **Rate Limiting**: Implement rate limits for API tools

## Integration with Graph

Use tools in graph-based workflows:

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent_with_tools', NodeType.AGENT, {
    agentId: 'tool-user',
  })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent_with_tools')
  .addEdge('agent_with_tools', 'end')
  .build();

// Agent has access to tools
const toolAwareAgent = AgentBuilder.create()
  .withId('tool-user')
  .withRole(role)
  .withModel(new ToolAwareModel(executor))
  .build();
```

## Next Steps

- See [Memory System](./memory-system.md) for context management
- See [Graph Execution](./graph-execution.md) for complex workflows
- See [Examples](./examples.md) for complete implementations
