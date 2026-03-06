# Agent Interfaces

This page documents the core TypeScript interfaces that underpin every agent in
SocietyAI. Understanding these interfaces is essential if you want to integrate
a custom LLM, inspect agent configuration programmatically, or build tooling on
top of the framework.

---

## 📋 Table of Contents

- [AIModel](#aimodel)
- [Role](#role)
- [Agent](#agent)
- [MemorySystem](#memorysystem)
- [Tool](#tool)
- [Next Steps](#next-steps)

---

## 🤖 AIModel

The `AIModel` interface is the single integration point between SocietyAI and
any LLM provider. You implement this interface once per provider (OpenAI,
Anthropic, Mistral, local, etc.) and the rest of the framework is completely
model-agnostic.

```typescript
interface AIModel {
  /**
   * Sends a prompt to the model and returns the response as a string.
   * @param prompt  The formatted prompt (string or structured object).
   * @param signal  Optional AbortSignal for cancellation.
   */
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;

  /**
   * Streams the model response token by token (optional).
   * Implement this if your provider supports streaming.
   */
  stream?(prompt: unknown, signal?: AbortSignal): AsyncIterable<string>;

  /**
   * Returns the canonical model identifier (e.g. "gpt-4o", "claude-3-5-sonnet").
   * Used in traces, logs, and observability events.
   */
  name(): string;

  /**
   * Indicates whether this model can handle a given prompt type.
   * SocietyAI may pass structured prompts (e.g. chat message arrays) in
   * addition to plain strings. Return true if you handle the type, false
   * to receive a stringified fallback.
   */
  supportsPromptType(promptType: string): boolean;

  /**
   * Indicates whether `stream()` is implemented and safe to call.
   * Defaults to false when omitted.
   */
  supportsStreaming?(): boolean;
}
```

### Minimal Implementation Example

```typescript
import { AIModel } from 'societyai';
import OpenAI from 'openai';

export class OpenAIModel implements AIModel {
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.modelName = model;
  }

  name(): string {
    return this.modelName;
  }

  supportsPromptType(_type: string): boolean {
    return true; // OpenAI accepts both plain strings and chat arrays
  }

  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: this.modelName,
        messages: [{ role: 'user', content: String(prompt) }],
      },
      { signal }
    );
    return response.choices[0].message.content ?? '';
  }
}
```

> **Tip:** Always forward the `signal` parameter to your HTTP client so that
> SocietyAI can cancel in-flight requests on timeout or abort.

---

## 🎭 Role

A `Role` defines the *identity* of an agent — its job description, system
prompt, capabilities, and prompt formatting rules. Roles are typically created
via `FluentRoleBuilder` (`.withRole()`) or the `createRole()` helper, but you
can also construct the plain object directly.

```typescript
interface Role {
  /** Unique identifier for this role (e.g. 'analyst', 'writer'). */
  id: string;

  /** Human-readable display name (e.g. 'Senior Data Analyst'). */
  name: string;

  /** Free-text description of the role's purpose (optional). */
  description?: string;

  /**
   * System instructions sent to the model at every turn.
   * This is the most important field — it defines the agent's behaviour.
   */
  systemPrompt: string;

  /**
   * List of declared capabilities (informational, used in routing and
   * metadata). Example: ['data_analysis', 'visualization'].
   */
  capabilities?: string[];

  /**
   * Behavioural constraints that the agent should respect.
   * Example: ['Do not fabricate data', 'Cite sources when possible'].
   */
  constraints?: string[];

  /**
   * Custom prompt template with placeholders (optional).
   * When omitted, the framework default template is used.
   * See the Prompt Templates guide for available placeholders.
   */
  promptTemplate?: string;
}
```

### Default Prompt Template

When `promptTemplate` is not set on the Role, SocietyAI uses:

```
System: {system}

{instructions}

Context: {context}
Memory: {memory}
Tools: {tools}

Previous Results:
{history}

Messages:
{messages}

User Input:
{input}
```

See [Prompt Templates](../2-building-societies/prompts.md) for the full list of
available placeholders and customisation options.

---

## 🧩 Agent

The `Agent` interface represents a fully configured execution unit. It is
constructed by `FluentAgentBuilder` (via `.addAgent()`) or the `createAgent()`
helper. You generally never instantiate this object directly.

```typescript
interface Agent {
  /** Unique identifier within the Society (e.g. 'content-writer'). */
  id: string;

  /** Human-readable display name (optional). */
  name?: string;

  /** The role definition for this agent. */
  role: Role;

  /** The AI model that backs this agent. */
  model: AIModel;

  /**
   * IDs of other agents this agent is allowed to send messages to.
   * Used in COLLABORATIVE nodes for message routing.
   */
  canCommunicateWith?: string[];

  /**
   * Execution priority. Higher values run first in tie-break situations.
   * Defaults to 0.
   */
  priority?: number;

  /**
   * Initial key/value context injected into the agent's execution context
   * at the start of every task. Merged with the Society's global context.
   */
  initialContext?: Record<string, unknown>;

  /**
   * Retry configuration for transient failures (e.g. API rate limits).
   * Uses exponential backoff with jitter.
   */
  retryConfig?: {
    maxRetries?: number;
    initialBackoff?: number; // milliseconds
  };

  /** Optional memory system (short-term, long-term, entity). */
  memory?: MemorySystem;

  /** List of tools the agent can call via the ReAct loop. */
  tools?: Tool[];

  /**
   * Execution mode for this agent.
   * - 'default'  : Runs in the main Node.js event loop (standard).
   * - 'isolated' : Runs in an isolated Worker Thread (CPU-intensive tasks).
   * Defaults to 'default' when omitted.
   */
  executionMode?: 'default' | 'isolated';

  /** Arbitrary metadata attached to the agent (visible in events/traces). */
  metadata?: Record<string, unknown>;

  /** Tags for filtering and grouping agents. */
  tags?: string[];
}
```

---

## 🧠 MemorySystem

The `MemorySystem` interface abstracts over the three memory layers. You
typically obtain an instance from `MemoryBuilder` rather than implementing
this interface yourself.

```typescript
interface MemorySystem {
  /**
   * Saves a new memory entry.
   */
  save(entry: MemoryEntry): Promise<void>;

  /**
   * Retrieves memory entries relevant to the given query.
   */
  search(query: string, options?: MemoryQuery): Promise<MemoryRetrievalResult[]>;

  /**
   * Returns a formatted string of recent memory for prompt injection.
   * Called automatically by the framework when building agent prompts.
   */
  getContext(input: string): Promise<string>;

  /**
   * Clears all stored memory entries.
   */
  clear(): Promise<void>;
}

interface MemoryEntry {
  content: string;
  type?: string;
  tags?: string[];
  timestamp?: number;
}

interface MemoryQuery {
  limit?: number;
  threshold?: number; // minimum similarity score (0–1)
  tags?: string[];
}

interface MemoryRetrievalResult {
  content: string;
  score: number;
  entry: MemoryEntry;
}
```

See [Memory Systems](../3-capabilities/memory.md) for configuration details.

---

## 🛠️ Tool

The `Tool` interface defines a function that an agent can call during the ReAct
loop. Tools are created with `ToolBuilder` or the `MCPToolProvider`.

```typescript
interface Tool {
  /** Unique name used by the agent to reference this tool. */
  name: string;

  /**
   * Description of what the tool does and when to use it.
   * This is the most important field — the agent uses it to decide
   * whether to call the tool.
   */
  description: string;

  /**
   * JSON Schema describing the tool's input parameters.
   * The framework validates arguments against this schema before execution.
   */
  parameters: ToolParameterSchema;

  /**
   * The function that executes when the agent calls the tool.
   * @param params   Validated arguments from the agent.
   * @param context  Execution context (sharedData, signal, etc.).
   * @returns        Result string passed back to the agent.
   */
  execute(
    params: Record<string, unknown>,
    context?: ToolContext
  ): Promise<string>;
}

interface ToolContext {
  /** Shared data map accessible across all agents in the Society. */
  sharedData: Map<string, unknown>;

  /** AbortSignal for cancellation support. */
  signal?: AbortSignal;

  /** ID of the agent currently executing the tool. */
  agentId?: string;
}

type ToolParameterSchema = {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    default?: unknown;
    [key: string]: unknown;
  }>;
  required?: string[];
};
```

See [Tools & Functions](../3-capabilities/tools-functions.md) for the complete
`ToolBuilder` guide and advanced examples.

---

## 📚 Next Steps

- **[Agents & Roles](../2-building-societies/agents-roles.md)** — `FluentAgentBuilder`
  and `FluentRoleBuilder` reference with practical examples.
- **[Prompt Templates](../2-building-societies/prompts.md)** — All available
  placeholders and how to customise the prompt sent to your model.
- **[Tools & Functions](../3-capabilities/tools-functions.md)** — Full
  `ToolBuilder` guide including parameter validation and error handling.
- **[Memory Systems](../3-capabilities/memory.md)** — `MemoryBuilder`
  configuration and the three memory layers.
- **[Worker Threads](../4-advanced/worker-threads.md)** — How `executionMode: 'isolated'`
  routes agent execution to an `IsolatedWorkerPool`.
- **[Execution Engine](./execution-engine.md)** — How `Agent` objects are
  consumed by the graph execution engine at runtime.