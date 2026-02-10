# Agent Builders

## `FluentAgentBuilder` (alias `AgentBuilder`)

Builder for creating agents.

```typescript
// Using createAgent helper
const agent = createAgent('analyst', analystRole, myModel)
  .withName('Senior Analyst')
  .withPriority(10)
  .withMemory(memorySystem)
  .withTools([calculatorTool, searchTool])
  .withRetry({ maxRetries: 3 })
  .withTags(['expert', 'fast'])
  .withMetadata({ department: 'research' })
  .build();

// Or using withRole callback for inline role creation
Society.create()
  .addAgent((a) =>
    a
      .withId('analyst')
      .withRole((r) =>
        r
          .withSystemPrompt('You are a data analyst')
          .withCapabilities(['analysis'])
      )
      .withModel(myModel)
  )
  .execute('...');
```

### Methods

- **`create()`** _(static)_: Creates a new empty agent builder.
- **`withId(id: string)`**: Sets the agent ID.
- **`withName(name: string)`**: Sets the name.
- **`withRole(roleOrBuilder)`**: Associates a role. Accepts a `Role` object, a
  `FluentRoleBuilder`, or a callback function
  `(builder: FluentRoleBuilder) => FluentRoleBuilder` for inline role creation.
- **`useRole(role: Role)`**: Associates a pre-built role (alias for `withRole`).
- **`withModel(model: AIModel)`**: Associates an AI model.
- **`withPriority(priority: number)`**: Sets the priority.
- **`canCommunicateWith(agentIds: string[])`**: Sets which agents this agent can
  communicate with.
- **`withMemory(memory: MemorySystem)`**: Adds a memory system.
- **`withTools(tools: Tool[])`**: Sets the list of tools.
- **`addTool(tool: Tool)`**: Adds a single tool.
- **`withRetry(config: { maxRetries?: number; initialBackoff?: number })`**:
  Configures retries.
- **`withTags(tags: string[])`**: Sets tags for filtering and grouping.
- **`addTag(tag: string)`**: Adds a single tag.
- **`withMetadata(metadata: Record<string, unknown>)`**: Adds custom metadata.
- **`withInitialContext(context: Record<string, unknown>)`**: Sets the initial
  context.
- **`addContext(key: string, value: unknown)`**: Adds a single context entry.
- **`build()`**: Builds the agent.

## `FluentRoleBuilder` (alias `RoleBuilder`)

Builder for creating agent roles.

```typescript
const role = createRole()
  .withId('analyst')
  .withName('Data Analyst')
  .withSystemPrompt('You are an expert data analyst')
  .withCapabilities(['data_analysis', 'visualization'])
  .withPromptTemplate(
    `System: {system}
    Context: {context}
    Input: {input}`
  )
  .build();
```

### Methods

- **`create()`** _(static)_: Creates a new empty role builder.
- **`withId(id: string)`**: Sets the role ID.
- **`withName(name: string)`**: Sets the name.
- **`withDescription(description: string)`**: Sets the role description.
- **`withSystemPrompt(prompt: string)`**: Sets the system instructions.
- **`withCapabilities(caps: string[])`**: Sets the capabilities.
- **`addCapability(cap: string)`**: Adds a single capability.
- **`withConstraints(constraints: string[])`**: Sets the constraints.
- **`addConstraint(constraint: string)`**: Adds a single constraint.
- **`withPromptTemplate(template: string)`**: Sets the prompt template.
- **`build()`**: Builds the role.

## Utility Functions

### `createRole(id, systemPrompt?, options?)`

Helper function to create a role.

```typescript
const role = createRole('analyst', 'You are an expert data analyst', {
  name: 'Data Analyst',
  capabilities: ['analysis', 'visualization'],
});
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
  priority: 10,
});
```
