# Architecture Overview

This document explains the core architecture, design principles, and key concepts of SocietyAI.

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Core Components](#core-components)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Communication Model](#communication-model)
- [Execution Model](#execution-model)

## Design Philosophy

SocietyAI is built on several key principles:

### 1. **Composability**

Every component is designed to be composed with others. Roles, agents, and steps can be mixed and matched to create complex workflows.

### 2. **Configurability**

Nothing is hardcoded. Users define their own roles, behaviors, and workflows. The library provides the infrastructure, you provide the intelligence.

### 3. **Model Agnosticism**

SocietyAI doesn't depend on any specific AI provider. You bring your own AI model - OpenAI, Anthropic, Google, local models, or custom APIs.

### 4. **Type Safety**

Built with TypeScript, providing full type definitions and compile-time safety.

### 5. **Observability**

Every phase, agent action, and step is observable through hooks and observers.

## Core Components

### 1. AIModel Interface

The foundation of model integration. Any AI service can be wrapped in this interface:

```typescript
interface AIModel {
  // Process a prompt and return a response
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;

  // Return the model name
  name(): string;

  // Check if the model supports a prompt type
  supportsPromptType(promptType: string): boolean;
}
```

**StandardModelBase** provides a convenient base class with built-in:

- Timeout handling
- Retry logic with exponential backoff
- Model adapters for different prompt formats
- Cancellation support via AbortSignal

### 2. AgentRole

Defines the behavior and identity of an agent:

```typescript
interface AgentRole {
  id: string; // Unique identifier
  name: string; // Display name
  systemPrompt: string; // Instructions defining behavior
  capabilities?: string[]; // What the agent can do
  constraints?: string[]; // What the agent should not do
  promptTemplate?: string; // Custom prompt formatting
}
```

**Example**:

```typescript
const analyst = {
  id: 'data-analyst',
  name: 'Data Analyst',
  systemPrompt: 'You are a data analyst focused on statistical analysis.',
  capabilities: ['data-analysis', 'statistics', 'visualization'],
  constraints: ['Do not make subjective judgments'],
};
```

### 3. AgentConfig

Combines a role with a model to create a functional agent:

```typescript
interface AgentConfig {
  id: string; // Unique agent ID
  name?: string; // Optional display name
  role: AgentRole; // The role this agent plays
  model: AIModel; // The AI model it uses
  canCommunicateWith?: string[]; // Which agents it can message
  priority?: number; // Execution priority (higher = first)
  initialContext?: Record<string, unknown>; // Starting data
}
```

### 4. WorkflowStep

Defines a single step in a workflow:

```typescript
interface WorkflowStep {
  id: string;
  name: string;
  agentIds: string[]; // Which agents participate
  executionType: WorkflowStepExecutionType;
  instructions?: string; // Step-specific instructions
  maxIterations?: number; // For collaborative steps
  completionCondition?: Function; // When to stop iteration
  resultTransformer?: Function; // Transform step results
  condition?: Function; // Conditional execution
  nextSteps?: string[]; // Possible next steps
  nextStepResolver?: Function; // Dynamic step routing
}
```

### 5. WorkflowConfig

Orchestrates the entire multi-agent system:

```typescript
interface WorkflowConfig {
  id: string;
  name: string;
  steps: WorkflowStep[]; // Ordered workflow steps
  agents: AgentConfig[]; // All participating agents
  entryStepId?: string; // Where to start
  globalContext?: Record<string, unknown>; // Shared data
  onBeforeStep?: Function; // Pre-step hook
  onAfterStep?: Function; // Post-step hook
  finalResultGenerator?: Function; // Custom output generation
}
```

### 6. WorkflowExecutor

Executes workflows and manages their lifecycle:

```typescript
interface WorkflowExecutor {
  execute(workflow: WorkflowConfig, input: string, signal?: AbortSignal): Promise<WorkflowResult>;

  executeStep(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]>;
}
```

**DefaultWorkflowExecutor** provides the standard implementation with support for all execution types.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       User Application                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │  WorkflowConfig       │
                │  ┌─────────────────┐  │
                │  │ AgentConfigs    │  │
                │  │ ┌────────────┐  │  │
                │  │ │ Role       │  │  │
                │  │ │ Model      │  │  │
                │  │ └────────────┘  │  │
                │  └─────────────────┘  │
                │  ┌─────────────────┐  │
                │  │ WorkflowSteps   │  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │
                ┌───────────┴───────────────┐
                │  DefaultWorkflowExecutor  │
                └───────────┬───────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
      ┌─────▼─────┐   ┌────▼────┐   ┌─────▼─────┐
      │  Step 1   │   │ Step 2  │   │  Step 3   │
      │(Sequential│   │(Parallel│   │(Collab.)  │
      └─────┬─────┘   └────┬────┘   └─────┬─────┘
            │              │               │
      ┌─────▼─────┐   ┌────▼──────────┬───▼─────┐
      │  Agent A  │   │  Agent B      │ Agent C │
      └─────┬─────┘   └────┬──────────┴───┬─────┘
            │              │               │
      ┌─────▼─────┐   ┌────▼────┐    ┌────▼────┐
      │ AI Model  │   │AI Model │    │AI Model │
      │ (OpenAI)  │   │(Claude) │    │(Gemini) │
      └───────────┘   └─────────┘    └─────────┘
            │              │               │
            └──────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │  MessageBus │
                    │ (Communication)
                    └─────────────┘
```

## Data Flow

### 1. Initialization Phase

```
User Code
   │
   ├─► Create Roles (RoleBuilder)
   ├─► Create Models (StandardModelBase)
   ├─► Create Agents (AgentBuilder)
   ├─► Define Steps (StepBuilder)
   └─► Build Workflow (WorkflowConfigBuilder)
```

### 2. Execution Phase

```
Input String
   │
   ▼
WorkflowExecutor.execute()
   │
   ├─► Initialize WorkflowContext
   │   ├─► sharedData (Map)
   │   ├─► stepResults (Map)
   │   ├─► messageHistory (Array)
   │   └─► metadata (Object)
   │
   ├─► For each WorkflowStep:
   │   │
   │   ├─► onBeforeStep hook (if defined)
   │   │
   │   ├─► Build prompts for agents
   │   │   └─► Apply role systemPrompt
   │   │       Apply step instructions
   │   │       Inject context data
   │   │       Replace template placeholders
   │   │
   │   ├─► Execute based on executionType:
   │   │   ├─► Sequential: Run agents one by one
   │   │   ├─► Parallel: Run all agents simultaneously
   │   │   ├─► Collaborative: Iterate with message passing
   │   │   └─► Conditional: Check condition first
   │   │
   │   ├─► Collect StepResults
   │   │   ├─► agentId
   │   │   ├─► stepId
   │   │   ├─► content (AI response)
   │   │   ├─► success/error
   │   │   └─► timestamp
   │   │
   │   ├─► Store results in context.stepResults
   │   │
   │   ├─► Apply resultTransformer (if defined)
   │   │
   │   ├─► onAfterStep hook (if defined)
   │   │
   │   └─► Determine next step
   │       ├─► nextStepResolver (dynamic)
   │       ├─► nextSteps (predefined)
   │       └─► Sequential (default)
   │
   └─► Generate final output
       ├─► finalResultGenerator (custom)
       └─► generateDefaultOutput (default)
```

### 3. Result Phase

```
WorkflowResult
   ├─► success: boolean
   ├─► output: string (final generated result)
   ├─► stepResults: Map<stepId, StepResult[]>
   ├─► messages: AgentMessage[] (all communications)
   ├─► duration: number (milliseconds)
   └─► errors?: Error[] (if any failures)
```

## Communication Model

### MessageBus

The MessageBus facilitates inter-agent communication:

```typescript
interface CommunicationChannel {
  send(message: AgentMessage): Promise<void>;
  subscribe(agentId: string, handler: Function): void;
  unsubscribe(agentId: string): void;
  getHistory(filter?: Filter): AgentMessage[];
  clearHistory(): void;
}
```

### Message Structure

```typescript
interface AgentMessage {
  from: string; // Sender agent ID
  to: string; // Recipient (or 'broadcast')
  type: MessageType; // request/response/notification/data/feedback
  content: string; // Message content
  data?: Object; // Structured data
  timestamp: number; // When sent
  messageId: string; // Unique ID
  replyTo?: string; // Parent message ID
}
```

### Communication Flow

```
Agent A                MessageBus              Agent B
   │                       │                      │
   ├──send(message)───────►│                      │
   │                       ├──notify──────────────►│
   │                       │                      │
   │                       │◄────send(reply)──────┤
   ├──notify──────────────►│                      │
   │                       │                      │
   └───getHistory()────────►                      │
```

## Execution Model

### Sequential Execution

Agents run one after another. Each agent can access previous results.

```
Agent 1 → Result 1
           ↓
   Context Updated
           ↓
Agent 2 → Result 2
           ↓
   Context Updated
           ↓
Agent 3 → Result 3
```

**Use cases**:

- Pipeline processing
- Dependent tasks
- Step-by-step refinement

### Parallel Execution

Multiple agents run simultaneously using a worker pool.

```
       ┌─ Agent 1 → Result 1 ─┐
       │                      │
Start ─┼─ Agent 2 → Result 2 ─┼─ Collect
       │                      │
       └─ Agent 3 → Result 3 ─┘
```

**Use cases**:

- Independent analyses
- Speed optimization
- Multiple perspectives

### Collaborative Execution

Agents exchange messages across multiple iterations.

```
Iteration 1:
  Agent 1 → broadcast message → All agents
  Agent 2 → broadcast message → All agents
  Agent 3 → broadcast message → All agents

Iteration 2:
  Agent 1 → (considers previous messages) → broadcast
  Agent 2 → (considers previous messages) → broadcast
  Agent 3 → (considers previous messages) → broadcast

Iteration 3:
  ...continue until maxIterations or completionCondition...
```

**Use cases**:

- Discussions
- Consensus building
- Iterative refinement
- Brainstorming

### Conditional Execution

Steps execute only when conditions are met.

```
Previous Results
       ↓
   Condition?
       ├─ true ──► Execute Step
       └─ false ─► Skip Step
```

**Use cases**:

- Error handling
- Dynamic workflows
- Branching logic
- Optimization (skip unnecessary work)

## Context Management

### WorkflowContext

The context is mutable and shared across all steps:

```typescript
interface WorkflowContext {
  input: string; // Original input
  sharedData: Map<string, unknown>; // Shared mutable data
  stepResults: Map<string, StepResult[]>; // All step results
  messageHistory: AgentMessage[]; // All messages
  metadata: Record<string, unknown>; // Extra metadata
}
```

### Data Sharing

**Between steps**:

```typescript
// Step 1 stores data
context.sharedData.set('analysis', analysisResult);

// Step 2 retrieves it
const analysis = context.sharedData.get('analysis');
```

**Accessing previous results**:

```typescript
const previousStep = context.stepResults.get('step-1');
previousStep.forEach((result) => {
  console.log(result.agentId, result.content);
});
```

## Worker Pool

For parallel execution, SocietyAI uses a worker pool:

```typescript
class WorkerPool {
  constructor(maxWorkers: number, signal?: AbortSignal);
  submit<T>(task: () => Promise<T>): Promise<T>;
  waitAll(): Promise<void>;
}
```

**Features**:

- Concurrent task execution
- Automatic queue management
- Cancellation support
- Error propagation

## Retry Mechanism

Built-in exponential backoff for AI model failures:

```typescript
interface RetryOptions {
  maxRetries: number; // How many times to retry
  initialBackoff: number; // Initial delay (ms)
  maxBackoff: number; // Maximum delay (ms)
  backoffFactor: number; // Multiplier per retry
  jitter: boolean; // Add randomness to prevent thundering herd
}
```

**Retry Flow**:

```
Attempt 1 ──fail──► Wait 1s ──► Attempt 2
                                     │
                                   fail
                                     ▼
                              Wait 2s (backoff × 2)
                                     │
                                     ▼
                                Attempt 3
                                     │
                                   fail
                                     ▼
                              Wait 4s (backoff × 4)
                                     │
                                     ▼
                            Final attempt or throw
```

## Error Handling

### Error Types

```typescript
SocietyError              // Base error class
├─ ModelNotSupportedError
├─ ProcessingFailedError
├─ InvalidAgentCountError
├─ NoModelsSpecifiedError
├─ SynthesisModelRequiredError
├─ OperationCancelledError
├─ TimeoutError
└─ InvalidConfigurationError
```

### Error Propagation

```
Agent fails
   ├─► StepResult.success = false
   ├─► StepResult.error = Error
   ├─► Observer.onAgentError()
   ├─► Continue with other agents (parallel)
   │   or stop (sequential, if critical)
   └─► Collected in WorkflowResult.errors
```

## Observability

### Observer Pattern

```typescript
interface SocietyObserver {
  onSocietyStart(prompt: string, agentCount: number): void;
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void;
  onAgentComplete(agentId: number, modelName: string, result: string): void;
  onAgentError(agentId: number, modelName: string, error: Error): void;
  onPhaseStart(phase: string): void;
  onPhaseComplete(phase: string): void;
  onSocietyComplete(finalResult: string): void;
}
```

### Logging

Built-in logger with configurable levels:

```typescript
enum LogLevel {
  SILENT = 0, // No logs
  ERROR = 1, // Only errors
  INFO = 2, // Info + errors
  DEBUG = 3, // All logs
}

import { setGlobalLogLevel, LogLevel } from 'societyai';
setGlobalLogLevel(LogLevel.DEBUG);
```

## Performance Considerations

### 1. Parallel Execution

Use parallel execution for independent tasks to reduce total execution time.

### 2. Worker Pool

The worker pool automatically manages concurrency based on the number of agents.

### 3. Timeouts

Set appropriate timeouts to prevent hanging on slow API calls:

```typescript
const model = new StandardModelBase(
  { timeout: 30000 }, // 30 seconds
  processFunc
);
```

### 4. Cancellation

Use AbortSignal to cancel long-running operations:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 60000);
await executor.execute(workflow, input, controller.signal);
```

### 5. Result Caching

Store expensive computation results in `context.sharedData` to avoid recomputation.

## Best Practices

### 1. Role Design

- Keep system prompts clear and specific
- Define concrete capabilities and constraints
- Use prompt templates for consistency

### 2. Agent Configuration

- Use meaningful IDs and names
- Set appropriate priorities for execution order
- Limit communication to necessary agents

### 3. Workflow Design

- Break complex tasks into smaller steps
- Use appropriate execution types
- Add completion conditions for collaborative steps
- Implement error handling in hooks

### 4. Performance

- Use parallel execution when possible
- Set reasonable timeouts
- Implement cancellation for long operations
- Consider result caching

### 5. Observability

- Implement observers for production systems
- Use appropriate log levels
- Monitor execution duration and errors
- Store message history for debugging

---

**Next**: [Workflow Patterns](./workflows.md) →

**Previous**: [Getting Started](./getting-started.md) ←
