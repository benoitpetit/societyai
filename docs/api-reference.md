# API Reference

Complete API documentation for SocietyAI.

## Table of Contents

- [Builders](#builders)
- [Core Interfaces](#core-interfaces)
- [Executors](#executors)
- [Models](#models)
- [Communication](#communication)
- [Utilities](#utilities)
- [Error Types](#error-types)

## Builders

### RoleBuilder

Create agent roles with specific behaviors.

```typescript
class RoleBuilder {
  static create(): RoleBuilder;
  
  withId(id: string): this;
  withName(name: string): this;
  withDescription(description: string): this;
  withSystemPrompt(prompt: string): this;
  withCapabilities(capabilities: string[]): this;
  withConstraints(constraints: string[]): this;
  withPromptTemplate(template: string): this;
  
  build(): AgentRole;
}
```

**Example**:
```typescript
const role = RoleBuilder.create()
  .withId('analyst')
  .withName('Data Analyst')
  .withSystemPrompt('You analyze data objectively.')
  .withCapabilities(['data-analysis', 'statistics'])
  .withConstraints(['No subjective opinions'])
  .build();
```

### AgentBuilder

Configure individual agents.

```typescript
class AgentBuilder {
  static create(): AgentBuilder;
  
  withId(id: string): this;
  withName(name: string): this;
  withRole(role: AgentRole): this;
  withModel(model: AIModel): this;
  canCommunicateWith(agentIds: string[]): this;
  withPriority(priority: number): this;
  withInitialContext(context: Record<string, unknown>): this;
  
  build(): AgentConfig;
}
```

**Example**:
```typescript
const agent = AgentBuilder.create()
  .withId('analyst-1')
  .withRole(analystRole)
  .withModel(model)
  .canCommunicateWith(['reviewer-1'])
  .withPriority(1)
  .build();
```

### StepBuilder

Define workflow steps.

```typescript
class StepBuilder {
  static create(): StepBuilder;
  
  withId(id: string): this;
  withName(name: string): this;
  withDescription(description: string): this;
  withAgents(agentIds: string[]): this;
  withExecutionType(type: WorkflowStepExecutionType): this;
  withInstructions(instructions: string): this;
  withPromptTemplate(template: string): this;
  withMaxIterations(max: number): this;
  withCompletionCondition(condition: (results: StepResult[], iteration: number) => boolean): this;
  withResultTransformer(transformer: (results: StepResult[] | StepResult) => unknown): this;
  withCondition(condition: (previousResults: Map<string, StepResult[]>) => boolean): this;
  withNextSteps(stepIds: string[]): this;
  withNextStepResolver(resolver: (results: StepResult[]) => string | null): this;
  
  build(): WorkflowStep;
}
```

**Example**:
```typescript
const step = StepBuilder.create()
  .withId('analysis')
  .withName('Data Analysis')
  .withAgents(['analyst-1', 'analyst-2'])
  .withExecutionType('parallel')
  .withInstructions('Analyze the data thoroughly.')
  .withMaxIterations(3)
  .build();
```

### WorkflowConfigBuilder

Build complete workflows.

```typescript
class WorkflowConfigBuilder {
  static create(): WorkflowConfigBuilder;
  
  withId(id: string): this;
  withName(name: string): this;
  withDescription(description: string): this;
  addAgent(agent: AgentConfig): this;
  addAgents(agents: AgentConfig[]): this;
  addStep(step: WorkflowStep): this;
  addSteps(steps: WorkflowStep[]): this;
  withEntryStep(stepId: string): this;
  withGlobalContext(context: Record<string, unknown>): this;
  onBeforeStep(handler: (step: WorkflowStep, context: WorkflowContext) => Promise<void>): this;
  onAfterStep(handler: (step: WorkflowStep, results: StepResult[], context: WorkflowContext) => Promise<void>): this;
  withFinalResultGenerator(generator: (results: Map<string, StepResult[]>, context: WorkflowContext) => Promise<string>): this;
  
  build(): WorkflowConfig;
}
```

**Example**:
```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('my-workflow')
  .withName('My Workflow')
  .addAgents([agent1, agent2])
  .addSteps([step1, step2])
  .withGlobalContext({ version: '1.0' })
  .onBeforeStep(async (step, ctx) => {
    console.log(`Starting ${step.name}`);
  })
  .withFinalResultGenerator(async (results, ctx) => {
    return `Generated output`;
  })
  .build();
```

## Core Interfaces

### AIModel

Interface for AI models.

```typescript
interface AIModel {
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  name(): string;
  supportsPromptType(promptType: string): boolean;
}
```

### AgentRole

Defines agent behavior.

```typescript
interface AgentRole {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  capabilities?: string[];
  constraints?: string[];
  promptTemplate?: string;
}
```

### AgentConfig

Complete agent configuration.

```typescript
interface AgentConfig {
  id: string;
  name?: string;
  role: AgentRole;
  model: AIModel;
  canCommunicateWith?: string[];
  priority?: number;
  initialContext?: Record<string, unknown>;
  retryConfig?: {
    maxRetries?: number;
    initialBackoff?: number;
  };
}
```

### WorkflowStep

A step in the workflow.

```typescript
type WorkflowStepExecutionType = 'sequential' | 'parallel' | 'collaborative' | 'conditional';

interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  agentIds: string[];
  executionType: WorkflowStepExecutionType;
  instructions?: string;
  promptTemplate?: string;
  maxIterations?: number;
  completionCondition?: (results: StepResult[], iteration: number) => boolean;
  resultTransformer?: (results: StepResult[] | StepResult) => unknown;
  condition?: (previousResults: Map<string, StepResult[]>) => boolean;
  nextSteps?: string[];
  nextStepResolver?: (results: StepResult[]) => string | null;
}
```

### StepResult

Result from a step execution.

```typescript
interface StepResult {
  agentId: string;
  stepId: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  success: boolean;
  error?: Error;
  iteration?: number;
}
```

### WorkflowConfig

Complete workflow definition.

```typescript
interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  entryStepId?: string;
  agents: AgentConfig[];
  globalContext?: Record<string, unknown>;
  onBeforeStep?: (step: WorkflowStep, context: WorkflowContext) => Promise<void>;
  onAfterStep?: (step: WorkflowStep, results: StepResult[], context: WorkflowContext) => Promise<void>;
  finalResultGenerator?: (results: Map<string, StepResult[]>, context: WorkflowContext) => Promise<string>;
}
```

### WorkflowContext

Execution context.

```typescript
interface WorkflowContext {
  input: string;
  sharedData: Map<string, unknown>;
  stepResults: Map<string, StepResult[]>;
  messageHistory: AgentMessage[];
  metadata: Record<string, unknown>;
}
```

### WorkflowResult

Final workflow result.

```typescript
interface WorkflowResult {
  success: boolean;
  output: string;
  stepResults: Map<string, StepResult[]>;
  messages: AgentMessage[];
  duration: number;
  errors?: Error[];
}
```

## Executors

### DefaultWorkflowExecutor

Executes workflows.

```typescript
class DefaultWorkflowExecutor implements WorkflowExecutor {
  constructor(observer?: SocietyObserver);
  
  execute(
    workflow: WorkflowConfig,
    input: string,
    signal?: AbortSignal
  ): Promise<WorkflowResult>;
  
  executeStep(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]>;
}
```

**Example**:
```typescript
const executor = new DefaultWorkflowExecutor(observer);
const result = await executor.execute(workflow, 'Input text');
```

## Models

### StandardModelBase

Base class for AI models.

```typescript
class StandardModelBase implements AIModel {
  constructor(
    options?: Partial<StandardModelOptions>,
    processFunc?: (prompt: unknown, signal?: AbortSignal) => Promise<string>
  );
  
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  name(): string;
  supportsPromptType(promptType: string): boolean;
  
  withName(name: string): this;
  withAdapter(adapter: ModelAdapter): this;
  withTimeout(timeout: number): this;
  withSupportedPromptTypes(types: string[]): this;
}
```

**Example**:
```typescript
class MyModel extends StandardModelBase {
  constructor() {
    super({ name: 'MyModel', timeout: 30000 }, async (prompt) => {
      // Your AI API call here
      return response;
    });
  }
}
```

### StandardModelOptions

Options for StandardModelBase.

```typescript
interface StandardModelOptions {
  name: string;
  timeout: number;
  retryOptions: RetryOptions;
  logger: Logger;
  adapter?: ModelAdapter;
}
```

### ModelAdapter

Adapter for different prompt formats.

```typescript
interface ModelAdapter {
  convertPrompt(genericPrompt: unknown): Promise<unknown>;
  convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

### TextModelAdapter

Simple text-based adapter.

```typescript
class TextModelAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown>;
  async convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

## Communication

### MessageBus

Communication channel for agents.

```typescript
class MessageBus implements CommunicationChannel {
  async send(message: AgentMessage): Promise<void>;
  subscribe(agentId: string, handler: (message: AgentMessage) => void): void;
  unsubscribe(agentId: string): void;
  getHistory(filter?: { from?: string; to?: string; type?: string }): AgentMessage[];
  clearHistory(): void;
}
```

### AgentMessage

Message between agents.

```typescript
interface AgentMessage {
  from: string;
  to: string | 'broadcast';
  type: 'request' | 'response' | 'notification' | 'data' | 'feedback' | 'validation';
  content: string;
  data?: Record<string, unknown>;
  timestamp: number;
  messageId: string;
  replyTo?: string;
}
```

## Utilities

### Logging

```typescript
enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  INFO = 2,
  DEBUG = 3,
}

function setGlobalLogLevel(level: LogLevel): void;
function getLogger(): Logger;
```

**Example**:
```typescript
import { setGlobalLogLevel, LogLevel } from '@societyai/core';
setGlobalLogLevel(LogLevel.DEBUG);
```

### Retry

```typescript
interface RetryOptions {
  maxRetries: number;
  initialBackoff: number;
  maxBackoff: number;
  backoffFactor: number;
  jitter: boolean;
}

function defaultRetryOptions(): RetryOptions;

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  signal?: AbortSignal
): Promise<T>;
```

### WorkerPool

Parallel task execution.

```typescript
class WorkerPool {
  constructor(maxWorkers: number, signal?: AbortSignal);
  
  submit<T>(task: () => Promise<T>): Promise<T>;
  waitAll(): Promise<void>;
}
```

## Error Types

### SocietyError

Base error class.

```typescript
class SocietyError extends Error {
  readonly code: string;
  constructor(message: string, code?: string);
}
```

### Specific Error Types

```typescript
class ModelNotSupportedError extends SocietyError {}
class ProcessingFailedError extends SocietyError {}
class InvalidAgentCountError extends SocietyError {}
class NoModelsSpecifiedError extends SocietyError {}
class SynthesisModelRequiredError extends SocietyError {}
class OperationCancelledError extends SocietyError {}
class TimeoutError extends SocietyError {}
class InvalidConfigurationError extends SocietyError {}
```

### Error Utilities

```typescript
function isAbortError(error: Error): boolean;
function wrapError(error: Error, message: string): SocietyError;
```

## Observer Pattern

### SocietyObserver

Monitor workflow execution.

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

**Example**:
```typescript
const observer: SocietyObserver = {
  onSocietyStart: (prompt, count) => console.log(`Starting with ${count} agents`),
  onAgentStart: (id, model, prompt) => console.log(`Agent ${id} started`),
  onAgentComplete: (id, model, result) => console.log(`Agent ${id} completed`),
  onAgentError: (id, model, error) => console.error(`Agent ${id} error:`, error),
  onPhaseStart: (phase) => console.log(`Phase: ${phase}`),
  onPhaseComplete: (phase) => console.log(`Phase ${phase} done`),
  onSocietyComplete: (result) => console.log('Complete!'),
};
```

## Legacy API

### Simple Functions (Deprecated)

For backwards compatibility only. Use WorkflowConfigBuilder for new projects.

```typescript
async function society(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel?: boolean,
  observer?: SocietyObserver
): Promise<string>;

async function societyCollaborative(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel?: boolean,
  observer?: SocietyObserver
): Promise<string>;

async function societyWithSynthesis(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel: boolean,
  synthModel: AIModel,
  observer?: SocietyObserver
): Promise<string>;
```

---

**Next**: [Advanced Features](./advanced.md) →

**Previous**: [Workflow Patterns](./workflows.md) ←
