# Agent Interfaces

## `AIModel`

Interface that your AI models must implement.

```typescript
interface AIModel {
  /**
   * Processes a prompt and returns a response.
   */
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  
  /**
   * Processes a prompt in streaming mode (optional).
   */
  stream?(prompt: unknown, signal?: AbortSignal): AsyncIterable<string>;
  
  /**
   * Returns the model name.
   */
  name(): string;
  
  /**
   * Checks if the model supports a specific prompt type.
   */
  supportsPromptType(promptType: string): boolean;
  
  /**
   * Checks if streaming is supported.
   */
  supportsStreaming?(): boolean;
}
```

## `Role`

Definition of an agent role.

```typescript
interface Role {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  capabilities?: string[];
  constraints?: string[];
  promptTemplate?: string;
}
```

## `Agent`

Complete configuration of an agent.

```typescript
interface Agent {
  id: string;
  name?: string;
  role: Role;
  model: AIModel;
  canCommunicateWith?: string[];
  priority?: number;
  initialContext?: Record<string, unknown>;
  retryConfig?: {
    maxRetries?: number;
    initialBackoff?: number;
  };
  memory?: MemorySystem;
  tools?: Tool[];
}
```
