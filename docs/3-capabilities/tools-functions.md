# Tools & Functions

Tools give your agents the ability to take concrete actions in the world: call
external APIs, read and write files, run calculations, query databases, and more.
When an agent has tools, SocietyAI automatically runs a **ReAct loop**
(Reasoning + Acting) to let it decide which tool to call, observe the result,
and continue until it has a final answer.

---

## 📋 Table of Contents

- [Basic Concepts](#basic-concepts)
- [Creating a Simple Tool](#creating-a-simple-tool)
- [Parameter Validation](#parameter-validation)
- [Asynchronous Tools](#asynchronous-tools)
- [Error Handling](#error-handling)
- [Stateful Tools](#stateful-tools)
- [Advanced Examples](#advanced-examples)
- [Usage with an Agent](#usage-with-an-agent)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Next Steps](#next-steps)

---

## 🔑 Basic Concepts

A tool in SocietyAI is an object that defines:
- **A name**: Unique identifier.
- **A description**: Explanation of what the tool does (crucial for the agent to understand).
- **A parameter schema**: JSON Schema structure of expected parameters.
- **An execution function**: The business logic.

---

## 🛠️ Creating a Simple Tool

### Example 1: Calculator

```typescript
import { ToolBuilder } from 'societyai';

const calculatorTool = ToolBuilder.create()
  .withName('calculate')
  .withDescription('Perform mathematical calculations. Supports +, -, *, /, %, and parentheses.')
  .withParameters({
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")'
      }
    },
    required: ['expression']
  })
  .withExecutor(async (params) => {
    try {
      // WARNING: eval() is dangerous in production!
      // Use a library like math.js instead
      const result = eval(params.expression);
      return { result, expression: params.expression };
    } catch (error) {
      throw new Error(`Invalid expression: ${error.message}`);
    }
  })
  .build();
```

### Example 2: Web Search (Mock)

```typescript
const webSearchTool = ToolBuilder.create()
  .withName('web_search')
  .withDescription('Search the web for information on a given query')
  .withParameters({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        minimum: 1,
        maximum: 10,
        default: 5
      }
    },
    required: ['query']
  })
  .withExecutor(async (params) => {
    const maxResults = params.maxResults || 5;
    
    // Simulating an API call
    const results = await fetch(`https://api.search.com/query?q=${encodeURIComponent(params.query)}&limit=${maxResults}`)
      .then(res => res.json());
    
    return {
      query: params.query,
      results: results.items.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet
      }))
    };
  })
  .build();
```

---

## ✅ Parameter Validation

The system automatically validates parameters according to the provided JSON Schema. Use all JSON Schema capabilities:

```typescript
const emailTool = ToolBuilder.create()
  .withName('send_email')
  .withDescription('Send an email to a recipient')
  .withParameters({
    type: 'object',
    properties: {
      to: {
        type: 'string',
        format: 'email',  // Email validation
        description: 'Recipient email address'
      },
      subject: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
        description: 'Email subject'
      },
      body: {
        type: 'string',
        minLength: 1,
        description: 'Email body content'
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        default: 'normal',
        description: 'Email priority level'
      },
      attachments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            contentType: { type: 'string' },
            data: { type: 'string' }  // Base64
          },
          required: ['filename', 'data']
        },
        maxItems: 5,
        description: 'Optional attachments (max 5)'
      }
    },
    required: ['to', 'subject', 'body']
  })
  .withExecutor(async (params, context) => {
    // Parameters are already validated!
    const emailId = await emailService.send({
      to: params.to,
      subject: params.subject,
      body: params.body,
      priority: params.priority || 'normal',
      attachments: params.attachments || []
    });
    
    return {
      success: true,
      emailId,
      sentAt: new Date().toISOString()
    };
  })
  .build();
```

---

## ⚡ Asynchronous Tools

Tools can be asynchronous and perform I/O operations:

```typescript
const databaseQueryTool = ToolBuilder.create()
  .withName('query_database')
  .withDescription('Execute a SQL query on the database')
  .withParameters({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL SELECT query (read-only)'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 1000,
        default: 100
      }
    },
    required: ['query']
  })
  .withExecutor(async (params, context) => {
    // Security check
    if (!params.query.trim().toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }
    
    // Cancellation support
    if (context.signal?.aborted) {
      throw new Error('Query cancelled');
    }
    
    const db = await getDatabase();
    const results = await db.query(params.query, {
      limit: params.limit || 100,
      signal: context.signal  // Pass cancellation signal
    });
    
    return {
      rowCount: results.length,
      columns: Object.keys(results[0] || {}),
      data: results
    };
  })
  .build();
```

---

## 🚨 Error Handling

Errors raised in the executor are captured and passed back to the agent:

```typescript
const fileReadTool = ToolBuilder.create()
  .withName('read_file')
  .withDescription('Read contents of a file from the workspace')
  .withParameters({
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file'
      }
    },
    required: ['path']
  })
  .withExecutor(async (params) => {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Security validation
    const safePath = path.normalize(params.path);
    if (safePath.startsWith('..') || path.isAbsolute(safePath)) {
      throw new Error('Invalid path: must be relative and within workspace');
    }
    
    try {
      const content = await fs.readFile(safePath, 'utf-8');
      return {
        path: safePath,
        content,
        size: content.length,
        lines: content.split('\n').length
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${safePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${safePath}`);
      } else {
        throw new Error(`Failed to read file: ${error.message}`);
      }
    }
  })
  .build();
```

---

## 🗃️ Stateful Tools

Tools can maintain state via the shared context:

```typescript
const counterTool = ToolBuilder.create()
  .withName('counter')
  .withDescription('Increment or get the current counter value')
  .withParameters({
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['increment', 'get', 'reset'],
        description: 'Action to perform'
      },
      amount: {
        type: 'number',
        default: 1,
        description: 'Amount to increment (only for increment action)'
      }
    },
    required: ['action']
  })
  .withExecutor(async (params, context) => {
    // Access shared context
    const currentValue = (context.sharedData.get('counter') as number) || 0;
    
    switch (params.action) {
      case 'increment':
        const newValue = currentValue + (params.amount || 1);
        context.sharedData.set('counter', newValue);
        return { value: newValue, action: 'incremented' };
        
      case 'get':
        return { value: currentValue, action: 'retrieved' };
        
      case 'reset':
        context.sharedData.set('counter', 0);
        return { value: 0, action: 'reset' };
        
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  })
  .build();
```

---

## 🔬 Advanced Examples

### Tool with Streaming

```typescript
const llmGenerateTool = ToolBuilder.create()
  .withName('generate_text')
  .withDescription('Generate text using an LLM')
  .withParameters({
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      maxTokens: { type: 'number', default: 100 }
    },
    required: ['prompt']
  })
  .withExecutor(async (params, context) => {
    const chunks: string[] = [];
    
    // Streaming simulation
    for await (const chunk of llmStream(params.prompt)) {
      if (context.signal?.aborted) break;
      chunks.push(chunk);
    }
    
    return {
      text: chunks.join(''),
      tokenCount: chunks.length
    };
  })
  .build();
```

### Composite Tool (Calls Other Tools)

```typescript
const researchTool = ToolBuilder.create()
  .withName('research_topic')
  .withDescription('Research a topic by searching and summarizing results')
  .withParameters({
    type: 'object',
    properties: {
      topic: { type: 'string' }
    },
    required: ['topic']
  })
  .withExecutor(async (params, context) => {
    // 1. Web search
    const searchResults = await webSearchTool.execute(
      { query: params.topic, maxResults: 5 },
      context
    );
    
    // 2. Extract content from each page
    const contents = [];
    for (const result of searchResults.results) {
      const pageContent = await fetchPageTool.execute(
        { url: result.url },
        context
      );
      contents.push(pageContent.text);
    }
    
    // 3. Summarize
    return {
      topic: params.topic,
      sources: searchResults.results.map(r => r.url),
      summary: contents.join('\n\n---\n\n').substring(0, 2000)
    };
  })
  .build();
```

---

## 🤖 Usage with an Agent

Once your tools are created, attach them to an agent:

```typescript
import { Society, AggregationStrategies } from 'societyai';

const society = Society.create()
  .addAgent(agent => agent
    .withId('researcher')
    .withRole({
      id: 'researcher',
      name: 'Research Assistant',
      systemPrompt: 'You are a research assistant. Use tools to find information.'
    })
    .withModel(myModel)
    .withTools([
      webSearchTool,
      calculatorTool,
      databaseQueryTool
    ])
  )
  .addTask(step => step
    .withId('research')
    .withAgents(['researcher'])
    .withInstructions('Research the benefits of AI in healthcare')
  );

const result = await society.execute('Start research');
```

---

## ✅ Best Practices

### 1. **Clear Descriptions**
Descriptions must be precise. The agent decides when to use the tool based on them.

❌ Bad:
```typescript
.withDescription('Does stuff with files')
```

✅ Good:
```typescript
.withDescription('Read contents of a text file from the workspace. Returns file content, size, and line count.')
```

### 2. **Strict Validation**
Use JSON Schema to validate all parameters:

```typescript
properties: {
  email: {
    type: 'string',
    format: 'email',  // Validates format
    pattern: '^[a-z0-9.]+@[a-z0-9.]+\\.[a-z]{2,}$'
  },
  age: {
    type: 'number',
    minimum: 0,
    maximum: 150
  }
}
```

### 3. **Error Handling**
Throw descriptive errors:

```typescript
if (!params.id) {
  throw new Error('Missing required parameter: id');
}

if (params.id.length < 5) {
  throw new Error('Invalid id: must be at least 5 characters');
}
```

### 4. **Cancellation Support**
Check the cancellation signal for long operations:

```typescript
.withExecutor(async (params, context) => {
  for (let i = 0; i < 1000; i++) {
    if (context.signal?.aborted) {
      throw new Error('Operation cancelled');
    }
    await processItem(i);
  }
})
```

### 5. **Security Limits**
Enforce limits to prevent abuse:

```typescript
properties: {
  count: {
    type: 'number',
    minimum: 1,
    maximum: 100  // Max limit
  }
}
```

---

## 📦 API Reference

### `ToolRegistry`

Registry for registering and managing tools globally.

```typescript
import { ToolRegistry } from 'societyai';

const registry = new ToolRegistry();
registry.register(calculatorTool);
registry.register(searchTool);

// Execute a registered tool by name
const result = await registry.execute('calculate', { expression: '2 + 2' });
```

### `ToolBuilder`

Fluent builder for creating tools. Always prefer `ToolBuilder` over constructing
a plain `Tool` object — it validates the schema and executor at build time.

```typescript
import { ToolBuilder } from 'societyai';

const myTool = ToolBuilder.create('my-tool')
  .withDescription('A short, precise description of what the tool does.')
  .withParameters({
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The input value.' },
    },
    required: ['input'],
  })
  .withExecutor(async (params, context) => {
    return `Processed: ${params.input}`;
  })
  .build();
```

### `Tool` Interface

```typescript
interface Tool {
  /** Unique name used by the agent to reference this tool. */
  name: string;

  /**
   * Human-readable description of what the tool does and when to use it.
   * This is the most critical field — the agent reads it to decide whether
   * to call the tool.
   */
  description: string;

  /** JSON Schema describing the tool's input parameters. */
  parameters: ToolParameterSchema;

  /**
   * Executes the tool with the given parameters.
   * @param params   Validated arguments from the agent.
   * @param context  Execution context (sharedData, signal, agentId).
   * @returns        Result string passed back to the agent as an observation.
   */
  execute: (
    params: Record<string, unknown>,
    context?: ToolContext
  ) => Promise<string>;
}
```

---

## 📚 Next Steps

- **[MCP Support](../4-advanced/mcp.md)** — Connect agents to the Model Context
  Protocol ecosystem for filesystem, Git, web search, and hundreds of other
  tools without writing custom executors.
- **[Agent Interfaces](../5-architecture/agent-interfaces.md)** — Full `Tool`,
  `ToolContext`, and `ToolParameterSchema` interface definitions.
- **[Core Concepts](../1-basics/core-concepts.md)** — How the ReAct loop works
  and when tools are called automatically.
- **[Validation](./validation.md)** — Enforce structured output schemas on top
  of tool-enabled agents for reliable data pipelines.
- **[Observability](../4-advanced/observability.md)** — Track tool execution
  events (`tool:execute`, `tool:result`) via the event system.

