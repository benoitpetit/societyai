# MCP (Model Context Protocol) Support

SocietyAI supports **Model Context Protocol (MCP)**, enabling agents to
interact with external tools and services through a standardized protocol.

## 🎯 Overview

MCP provides:

- **Standardized Tool Integration**: Connect to external services
- **Built-in Helpers**: Filesystem, Git, Search, and more
- **Extensibility**: Create custom MCP servers
- **Agent Enhancement**: Give agents real-world capabilities

---

## 🚀 Quick Start

### Installation

MCP support is built-in, but you need the MCP server implementations:

```bash
# Install MCP servers you want to use
npm install @modelcontextprotocol/server-filesystem
npm install @modelcontextprotocol/server-git
# ... other MCP servers
```

### Basic Usage

```typescript
import { Society, MCPServers } from 'societyai';
import { OpenAIModel } from './my-model-impl';

const model = new OpenAIModel(process.env.OPENAI_API_KEY);

// Get MCP tools
const fsTools = await MCPServers.filesystem('/workspace');

const society = Society.create()
  .withId('file-analyzer')

  .addAgent((a) =>
    a
      .withId('analyzer')
      .withRole((r) =>
        r.withSystemPrompt('You analyze files and provide insights.')
      )
      .withModel(model)
      .withTools(fsTools) // ← Add MCP tools
  )

  .addTask((t) => t.withId('analyze').withAgents(['analyzer']))

  .execute('Analyze the README.md file');
```

---

## 🛠️ Built-in MCP Servers

### Filesystem Server

Access and manipulate files:

```typescript
import { MCPServers } from 'societyai';

// Give agent access to a directory
const tools = await MCPServers.filesystem('/path/to/workspace');

const society = Society.create().addAgent((a) =>
  a
    .withId('file-agent')
    .withModel(model)
    .withTools(tools) // ← Can read/write files
);
```

**Available Operations**:

- Read files
- Write files
- List directories
- Create directories
- Delete files/directories

### Git Server

Interact with Git repositories:

```typescript
import { MCPServers } from 'societyai';

// Give agent Git access
const tools = await MCPServers.git();

const society = Society.create().addAgent((a) =>
  a
    .withId('git-agent')
    .withModel(model)
    .withTools(tools) // ← Can use Git commands
);
```

**Available Operations**:

- Git status
- Git log
- Git diff
- Git commit
- Git push/pull

### Brave Search

Web search capabilities:

```typescript
import { MCPServers } from 'societyai';

// Give agent web search
const tools = await MCPServers.braveSearch(process.env.BRAVE_API_KEY);

const society = Society.create().addAgent((a) =>
  a
    .withId('researcher')
    .withModel(model)
    .withTools(tools) // ← Can search the web
);
```

### GitHub

Interact with GitHub repositories:

```typescript
import { MCPServers } from 'societyai';

// Give agent GitHub access
const tools = await MCPServers.github(process.env.GITHUB_TOKEN);

const society = Society.create().addAgent((a) =>
  a
    .withId('github-agent')
    .withModel(model)
    .withTools(tools) // ← Can manage issues, PRs, etc.
);
```

---

## 📋 MCPServers API

### Available Helpers

```typescript
import { MCPServers } from 'societyai';

// Filesystem access
const fs = await MCPServers.filesystem('/workspace');

// Git operations
const git = await MCPServers.git();

// Web search
const search = await MCPServers.braveSearch(apiKey);

// GitHub integration
const github = await MCPServers.github(token);

// Slack integration
const slack = await MCPServers.slack(token);

// PostgreSQL database
const postgres = await MCPServers.postgres(connectionString);

// Google Drive
const drive = await MCPServers.googleDrive(credentials);
```

### Custom MCP Server

Create your own MCP server:

```typescript
import { MCPToolProvider } from 'societyai';

class CustomMCPServer extends MCPToolProvider {
  constructor() {
    super('custom-server', 'My custom tool set');
  }

  async getTools() {
    return [
      {
        name: 'custom_action',
        description: 'Perform a custom action',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        execute: async (args) => {
          // Your custom logic
          return `Processed: ${args.input}`;
        },
      },
    ];
  }
}

// Use it
const custom = new CustomMCPServer();
const tools = await custom.getTools();

const society = Society.create().addAgent((a) =>
  a.withId('agent').withModel(model).withTools(tools)
);
```

---

## 🔧 Advanced Usage

### Multiple Tool Sets

Combine multiple MCP servers:

```typescript
const fsTools = await MCPServers.filesystem('/workspace');
const gitTools = await MCPServers.git();

const society = Society.create().addAgent((a) =>
  a
    .withId('dev-agent')
    .withModel(model)
    .withTools([...fsTools, ...gitTools]) // ← Multiple tool sets
);
```

### Conditional Tools

Add tools based on agent role:

```typescript
const society = Society.create()
  // File reader - only filesystem
  .addAgent((a) =>
    a
      .withId('reader')
      .withModel(model)
      .withTools(await MCPServers.filesystem('/workspace'))
  )

  // Developer - filesystem + git
  .addAgent((a) =>
    a
      .withId('developer')
      .withModel(model)
      .withTools([
        ...(await MCPServers.filesystem('/workspace')),
        ...(await MCPServers.git()),
      ])
  );
```

### Tools with Worker Threads

MCP tools work with Worker Threads:

```typescript
const tools = await MCPServers.filesystem('/data');

const society = Society.create().addAgent((a) =>
  a
    .withId('processor')
    .withModel(model)
    .withExecutionMode('isolated') // ← Worker Thread
    .withTools(tools) // ← MCP tools serialized
);
```

**Note**: Tool functions are serialized for worker threads. Only tool
**metadata** is sent to workers.

---

## 🔍 How MCP Works

### Architecture

```
┌─────────────────────────────────────┐
│         Agent                      │
│                                     │
│  withTools([                        │
│    { name: 'read_file', ... }       │
│  ])                                 │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│     MCPToolProvider                 │
│                                     │
│  - Connects to MCP server           │
│  - Exposes tool schemas             │
│  - Executes tool calls              │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│     MCP Server                      │
│  (filesystem, git, etc.)            │
│                                     │
│  - Implements tool logic            │
│  - Returns results                  │
└─────────────────────────────────────┘
```

### Tool Execution Flow

1. **Agent** decides to use a tool (via model)
2. **AgentExecutor** calls tool with parameters
3. **MCPToolProvider** forwards call to MCP server
4. **MCP Server** executes the operation
5. **Result** returned to agent

---

## 📊 Tool Schema

MCP tools follow OpenAI function calling format:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: {
      [key: string]: {
        type: string;
        description?: string;
      };
    };
    required?: string[];
  };
  execute: (args: any) => Promise<string>;
}
```

Example:

```typescript
{
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read'
      }
    },
    required: ['path']
  },
  execute: async (args) => {
    const content = await fs.readFile(args.path, 'utf-8');
    return content;
  }
}
```

---

## 🧪 Testing

MCP integration is tested in:

- **Unit Tests**: `mcp.test.ts`
- **Integration Tests**: `end-to-end-features.test.ts`

Run tests:

```bash
npm test mcp.test.ts
```

---

## ⚠️ Security Considerations

### Filesystem Access

```typescript
// ⚠️ Be careful with directory access
const tools = await MCPServers.filesystem('/'); // ← Full system access!

// ✅ Better: Restrict to specific directories
const tools = await MCPServers.filesystem('/workspace/safe-dir');
```

### API Keys

```typescript
// ✅ Use environment variables
const search = await MCPServers.braveSearch(process.env.BRAVE_API_KEY);

// ❌ Don't hardcode keys
const search = await MCPServers.braveSearch('abc123'); // Bad!
```

### Tool Validation

Validate tool inputs before execution:

```typescript
class SecureMCPServer extends MCPToolProvider {
  async getTools() {
    return [
      {
        name: 'safe_action',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        execute: async (args) => {
          // Validate input
          if (!args.input || typeof args.input !== 'string') {
            throw new Error('Invalid input');
          }

          // Sanitize
          const sanitized = args.input.replace(/[^a-zA-Z0-9]/g, '');

          // Execute safely
          return await this.processInput(sanitized);
        },
      },
    ];
  }
}
```

---

## 📚 Related Documentation

- [Tools & Functions](../3-capabilities/tools-functions.md): Basic tool usage
- [Worker Threads](./worker-threads.md): Tools with isolated execution
- [OpenTelemetry](./opentelemetry.md): Trace tool execution

---

## ✅ Best Practices

1. **Restrict Access**: Limit filesystem and API access to necessary directories
2. **Validate Inputs**: Always validate tool parameters
3. **Use Environment Variables**: For API keys and secrets
4. **Test Tools**: Unit test custom MCP servers
5. **Document Tools**: Provide clear descriptions for agents
6. **Handle Errors**: Gracefully handle tool execution failures

---

## 📖 Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
- [Example Implementations](../../src/examples/complete-integration.ts)

---

## 📚 Next Steps

- Explore [Worker Threads](./worker-threads.md) with MCP tools
- Set up [OpenTelemetry](./opentelemetry.md) to trace tool usage
- Create custom MCP servers for your use case
