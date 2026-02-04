# Agent Builders

## `FluentAgentBuilder` (alias `AgentBuilder`)

Builder for creating agents.

```typescript
const agent = createAgent('analyst', analystRole, myModel)
  .withName('Senior Analyst')
  .withPriority(10)
  .withMemory(memorySystem)
  .withTools([calculatorTool, searchTool])
  .withRetryConfig({ maxRetries: 3 })
  .build();
```

### Methods

- **`withId(id: string)`**: Sets the agent ID.
- **`withName(name: string)`**: Sets the name.
- **`useRole(role: Role)`**: Associates a role.
- **`withModel(model: AIModel)`**: Associates an AI model.
- **`withPriority(priority: number)`**: Sets the priority.
- **`canCommunicateWith(agentIds: string[])`**: Sets which agents this agent can communicate with.
- **`withMemory(memory: MemorySystem)`**: Adds a memory system.
- **`withTools(tools: Tool[])`**: Adds tools.
- **`withRetryConfig(config)`**: Configures retries.
- **`withInitialContext(context: Record<string, unknown>)`**: Sets the initial context.
- **`build()`**: Builds the agent.

## `FluentRoleBuilder` (alias `RoleBuilder`)

Builder for creating agent roles.

```typescript
const role = createRole()
  .withId('analyst')
  .withName('Data Analyst')
  .withSystemPrompt('You are an expert data analyst')
  .withCapabilities(['data_analysis', 'visualization'])
  .withPromptTemplate(`System: {system}
    Context: {context}
    Input: {input}`)
  .build();
```

### Methods

- **`withId(id: string)`**: Sets the role ID.
- **`withName(name: string)`**: Sets the name.
- **`withSystemPrompt(prompt: string)`**: Sets the system instructions.
- **`withCapabilities(caps: string[])`**: Sets the capabilities.
- **`withConstraints(constraints: string[])`**: Sets the constraints.
- **`withPromptTemplate(template: string)`**: Sets the prompt template.
- **`build()`**: Builds the role.

## Utility Functions

### `createRole(id, systemPrompt?, options?)`

Helper function to create a role.

```typescript
const role = createRole(
  'analyst',
  'You are an expert data analyst',
  { 
    name: 'Data Analyst',
    capabilities: ['analysis', 'visualization'] 
  }
);
```

**Parameters:**
- `id: string` - Role identifier
- `systemPrompt?: string` - System prompt (optional)
- `options?` - Additional options:
  - `name?: string` - Display name
  - `description?: string` - Role description
  - `capabilities?: string[]` - List of capabilities
  - `constraints?: string[]` - List of constraints
  - `promptTemplate?: string` - Custom prompt template

### `createAgent(id, role, model, options?)`

Helper function to create an agent.

```typescript
const agent = createAgent('analyst', analystRole, myModel, {
  name: 'Senior Analyst',
  priority: 10
});
```
