# Agents & Roles

Agents and Roles are the two core building blocks of every SocietyAI workflow.
A **Role** defines *who* an agent is (its job description, system prompt, and
capabilities), while an **Agent** brings together a role, an AI model, and
optional capabilities (tools, memory, retry logic).

---

## 📋 Table of Contents

- [FluentAgentBuilder](#fluentagentbuilder)
- [FluentRoleBuilder](#fluentrolebuilder)
- [Utility Functions](#utility-functions)
- [Next Steps](#next-steps)

---

## 🤖 FluentAgentBuilder

`FluentAgentBuilder` (alias `AgentBuilder`) is the recommended way to create
agents. It is always used through the `.addAgent()` callback on `Society`, or
via the `createAgent()` helper for pre-built agents.

### Quick Examples

```typescript
import { Society, createAgent, createRole } from 'societyai';

// ── Option 1: inline builder inside Society ──────────────────────────────────
Society.create()
  .addAgent((a) =>
    a
      .withId('analyst')
      .withRole((r) =>
        r
          .withName('Data Analyst')
          .withSystemPrompt('You are an expert data analyst.')
          .withCapabilities(['analysis'])
      )
      .withModel(myModel)
      .withTools([calculatorTool, searchTool])
      .withRetry({ maxRetries: 3 })
  )
  .execute('...');

// ── Option 2: pre-built agent via createAgent() ──────────────────────────────
const analystRole = createRole('analyst')
  .withName('Data Analyst')
  .withSystemPrompt('You are an expert data analyst.')
  .build();

const agent = createAgent('analyst', analystRole, myModel, {
  name: 'Senior Analyst',
  priority: 10,
});

Society.create()
  .useAgent(agent)
  .addTask(/* ... */)
  .execute('Analyse this dataset');
```

### Methods

| Method | Description |
|---|---|
| `create()` *(static)* | Creates a new empty agent builder. |
| `withId(id: string)` | Sets the agent ID (required, must be unique). |
| `withName(name: string)` | Sets a human-readable display name. |
| `withRole(roleOrBuilder)` | Associates a role. Accepts a `Role` object, a `FluentRoleBuilder`, or an inline callback `(r: FluentRoleBuilder) => FluentRoleBuilder`. |
| `useRole(role: Role)` | Associates a pre-built role (alias for `withRole`). |
| `withModel(model: AIModel)` | Associates the AI model that backs this agent. |
| `withPriority(priority: number)` | Sets the execution priority (higher = runs first in tie-breaks). |
| `canCommunicateWith(agentIds: string[])` | Declares which other agents this agent may send messages to. |
| `withMemory(memory: MemorySystem)` | Attaches a memory system (short-term, long-term, entity). |
| `withTools(tools: Tool[])` | Sets the full list of tools available to the agent. |
| `addTool(tool: Tool)` | Adds a single tool to the existing list. |
| `withRetry(config)` | Configures retry behaviour: `{ maxRetries?: number; initialBackoff?: number }`. |
| `withExecutionMode(mode: 'default' \| 'isolated')` | Sets the execution mode. `'isolated'` runs the agent in a Worker Thread. |
| `withTags(tags: string[])` | Sets tags for filtering and grouping agents. |
| `addTag(tag: string)` | Adds a single tag. |
| `withMetadata(metadata: Record<string, unknown>)` | Attaches arbitrary metadata (visible in events and traces). |
| `withInitialContext(context: Record<string, unknown>)` | Sets the agent's initial context key/value store. |
| `addContext(key: string, value: unknown)` | Adds a single entry to the initial context. |
| `build()` | Builds and returns the `Agent` object. |

---

## 🎭 FluentRoleBuilder

`FluentRoleBuilder` (alias `RoleBuilder`) defines the *identity* of an agent:
its name, system prompt, capabilities, and prompt template.

### Quick Example

```typescript
import { createRole } from 'societyai';

const analystRole = createRole()
  .withId('analyst')
  .withName('Data Analyst')
  .withDescription('Expert in quantitative and qualitative data analysis.')
  .withSystemPrompt('You are an expert data analyst. Be precise and concise.')
  .withCapabilities(['data_analysis', 'visualization', 'statistics'])
  .withConstraints(['Do not fabricate data', 'Cite sources when possible'])
  .withPromptTemplate(
    `System: {system}

Available Tools:
{tools}

Context:
{context}

Previous Results:
{history}

Task: {input}`
  )
  .build();
```

### Methods

| Method | Description |
|---|---|
| `create()` *(static)* | Creates a new empty role builder. |
| `withId(id: string)` | Sets the role ID. |
| `withName(name: string)` | Sets the display name. |
| `withDescription(description: string)` | Sets a free-text description of the role. |
| `withSystemPrompt(prompt: string)` | Sets the system instructions sent to the model at every turn. |
| `withCapabilities(caps: string[])` | Declares the role's capabilities (informational, used in routing). |
| `addCapability(cap: string)` | Adds a single capability. |
| `withConstraints(constraints: string[])` | Declares behavioural constraints for this role. |
| `addConstraint(constraint: string)` | Adds a single constraint. |
| `withPromptTemplate(template: string)` | Sets a custom prompt template. See [Prompt Templates](./prompts.md) for available placeholders. |
| `build()` | Builds and returns the `Role` object. |

---

## 🛠️ Utility Functions

### `createRole(id?, systemPrompt?, options?)`

Helper function for quickly creating a role without chaining a full builder.

```typescript
import { createRole } from 'societyai';

const role = createRole('analyst', 'You are an expert data analyst.', {
  name: 'Data Analyst',
  description: 'Specialises in quantitative analysis.',
  capabilities: ['analysis', 'visualization'],
  constraints: ['Do not fabricate data'],
});
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` *(optional)* | Role identifier. |
| `systemPrompt` | `string` *(optional)* | System instructions for the model. |
| `options` | `object` *(optional)* | Additional options (see below). |
| `options.name` | `string` | Display name. |
| `options.description` | `string` | Role description. |
| `options.capabilities` | `string[]` | List of capabilities. |
| `options.constraints` | `string[]` | List of behavioural constraints. |
| `options.promptTemplate` | `string` | Custom prompt template. |

---

### `createAgent(id, role, model, options?)`

Helper function for creating a fully configured `Agent` object outside of the
fluent builder chain.

```typescript
import { createAgent, createRole } from 'societyai';

const role = createRole('analyst', 'You are an expert data analyst.').build();

const agent = createAgent('analyst', role, myModel, {
  name: 'Senior Analyst',
  priority: 10,
  tools: [calculatorTool],
  retryConfig: { maxRetries: 2, initialBackoff: 500 },
});
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Agent identifier (must be unique within a Society). |
| `role` | `Role` | The role definition for this agent. |
| `model` | `AIModel` | The AI model that backs this agent. |
| `options` | `object` *(optional)* | Additional agent options. |
| `options.name` | `string` | Display name. |
| `options.priority` | `number` | Execution priority. |
| `options.tools` | `Tool[]` | Tools available to the agent. |
| `options.memory` | `MemorySystem` | Memory system for the agent. |
| `options.retryConfig` | `object` | Retry configuration `{ maxRetries?, initialBackoff? }`. |
| `options.tags` | `string[]` | Tags for filtering and grouping. |
| `options.metadata` | `Record<string, unknown>` | Arbitrary metadata. |

---

## 📚 Next Steps

- **[Prompt Templates](./prompts.md)** — Customise the prompt sent to your model with placeholders.
- **[Tools & Functions](../3-capabilities/tools-functions.md)** — Give agents real-world capabilities.
- **[Memory Systems](../3-capabilities/memory.md)** — Add short-term and long-term memory to agents.
- **[Society Builder](./society-builder.md)** — Full reference for `Society`, `FluentTaskBuilder`, and `AggregationStrategies`.
- **[Agent Interfaces](../5-architecture/agent-interfaces.md)** — TypeScript interface definitions for `AIModel`, `Role`, and `Agent`.
- **[Worker Threads](../4-advanced/worker-threads.md)** — Run CPU-intensive agents in isolated threads with `executionMode: 'isolated'`.