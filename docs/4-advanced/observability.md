# Observability & Event System

SocietyAI provides a robust, strictly-typed event system that allows you to
monitor every aspect of your multi-agent system's execution. This is crucial for
debugging, progress tracking, and integration with external monitoring tools
(like Datadog, Prometheus, or custom dashboards).

---

## 📡 The SocietyEventEmitter

The core of the observability system is the `SocietyEventEmitter`. It works
similarly to the standard Node.js `EventEmitter` but with full TypeScript type
safety and async handler support.

```typescript
import { SocietyEventEmitter } from 'societyai';

const events = new SocietyEventEmitter();

// Listen to a specific typed event
events.on('agent:start', async (event) => {
  console.log(`Agent ${event.agentId} started (model: ${event.modelName})`);
});

// Listen to all events
events.onAny((eventName, data) => {
  console.log(`[${eventName}]`, data);
});
```

---

## 📊 Event Types & Payloads

All events share a common `BaseEvent` shape:

```typescript
interface BaseEvent {
  type: string;     // event name key
  timestamp: number; // Unix ms
}
```

### Workflow (Society) Events

| Event Name         | When fired                       | Key Payload Fields                                    |
|--------------------|----------------------------------|-------------------------------------------------------|
| `society:start`    | Workflow begins execution        | `workflowId`, `workflowName`, `input`, `agentCount`   |
| `society:complete` | Workflow finishes successfully   | `workflowId`, `workflowName`, `result`, `duration`    |
| `society:error`    | Workflow crashes with an error   | `workflowId`, `workflowName`, `error`                 |

```typescript
// society:start
interface WorkflowStartEvent extends BaseEvent {
  type: 'society:start';
  workflowId: string;
  workflowName: string;
  input: string;
  agentCount: number;
}

// society:complete
interface WorkflowCompleteEvent extends BaseEvent {
  type: 'society:complete';
  workflowId: string;
  workflowName: string;
  result: SocietyResult;
  duration: number;
}

// society:error
interface WorkflowErrorEvent extends BaseEvent {
  type: 'society:error';
  workflowId: string;
  workflowName: string;
  error: Error;
}
```

### Task (Step) Events

| Event Name      | When fired                         | Key Payload Fields                                     |
|-----------------|------------------------------------|--------------------------------------------------------|
| `task:start`    | A task node begins execution       | `stepName`, `agentIds`, `executionType`                |
| `task:complete` | A task node finishes               | `stepName`, `results` (TaskResult[]), `duration`       |
| `task:error`    | A task node throws an unhandled error | `stepName`, `error`                                 |
| `task:skipped`  | A task is skipped (condition false) | `stepName`, `reason`                                  |

```typescript
// task:start
interface StepStartEvent extends BaseEvent {
  type: 'task:start';
  stepName: string;
  agentIds: string[];
  executionType: string; // 'sequential' | 'parallel' | 'collaborative' | ...
}

// task:complete
interface StepCompleteEvent extends BaseEvent {
  type: 'task:complete';
  stepName: string;
  results: TaskResult[];
  duration: number;
}

// task:error
interface StepErrorEvent extends BaseEvent {
  type: 'task:error';
  stepName: string;
  error: Error;
}

// task:skipped
interface StepSkippedEvent extends BaseEvent {
  type: 'task:skipped';
  stepName: string;
  reason: string;
}
```

### Agent Events

| Event Name       | When fired                              | Key Payload Fields                                          |
|------------------|-----------------------------------------|-------------------------------------------------------------|
| `agent:start`    | Agent begins processing a prompt        | `agentId`, `agentName?`, `modelName`, `prompt`              |
| `agent:complete` | Agent finishes and returns a result     | `agentId`, `agentName?`, `modelName`, `result`, `duration`  |
| `agent:error`    | Agent call throws an error              | `agentId`, `agentName?`, `modelName`, `error`               |
| `agent:retry`    | Agent call failed and will be retried   | `agentId`, `agentName?`, `attempt`, `maxAttempts`, `error`  |

```typescript
// agent:start
interface AgentStartEvent extends BaseEvent {
  type: 'agent:start';
  agentId: string;
  agentName?: string;
  modelName: string;
  prompt: unknown;
}

// agent:complete
interface AgentCompleteEvent extends BaseEvent {
  type: 'agent:complete';
  agentId: string;
  agentName?: string;
  modelName: string;
  result: string;
  duration: number;
}

// agent:error
interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error';
  agentId: string;
  agentName?: string;
  modelName: string;
  error: Error;
}

// agent:retry
interface AgentRetryEvent extends BaseEvent {
  type: 'agent:retry';
  agentId: string;
  agentName?: string;
  attempt: number;
  maxAttempts: number;
  error: Error;
}
```

### Progress Events

| Event Name | When fired               | Key Payload Fields                                              |
|------------|--------------------------|-----------------------------------------------------------------|
| `progress` | Progress update emitted  | `percent` (0–100), `phase`, `estimatedTimeRemaining?`, `details?` |

```typescript
interface ProgressEvent extends BaseEvent {
  type: 'progress';
  percent: number;
  phase: string;
  estimatedTimeRemaining?: number; // ms
  details?: Record<string, unknown>;
}
```

### Message Events (Collaborative Steps)

| Event Name        | When fired                           | Key Payload Fields                    |
|-------------------|--------------------------------------|---------------------------------------|
| `message:sent`    | An agent sends a message to another  | `from`, `to`, `messageType`, `content` |
| `message:received`| An agent receives a message          | `from`, `to`, `messageType`, `content` |

```typescript
interface MessageSentEvent extends BaseEvent {
  type: 'message:sent';
  from: string;
  to: string | 'broadcast';
  messageType: string;
  content: string;
}

interface MessageReceivedEvent extends BaseEvent {
  type: 'message:received';
  from: string;
  to: string;
  messageType: string;
  content: string;
}
```

### Debug & Custom Events

| Event Name | Description                              |
|------------|------------------------------------------|
| `debug`    | Internal debug info (`level`, `message`, `data?`) |
| `custom`   | User-defined events (`name`, `data`)     |

---

## 🛠️ Usage Examples

### 1. Real-Time Logging

```typescript
import { SocietyEventEmitter } from 'societyai';

const events = new SocietyEventEmitter();

events.onAny((eventName, data) => {
  console.log(`[${new Date().toISOString()}] [${eventName}]`, data);
});
```

### 2. Tracking Workflow Lifecycle

```typescript
events.on('society:start', (e) => {
  console.log(`Workflow "${e.workflowName}" started with ${e.agentCount} agents`);
});

events.on('society:complete', (e) => {
  console.log(`Workflow completed in ${e.duration}ms`);
  console.log('Output:', e.result.output);
});

events.on('society:error', (e) => {
  console.error(`Workflow failed:`, e.error.message);
});
```

### 3. Progress Bar

```typescript
const totalTasks = 5;
let completed = 0;

events.on('task:complete', () => {
  completed++;
  const pct = Math.round((completed / totalTasks) * 100);
  process.stdout.write(`\rProgress: ${pct}%`);
});
```

### 4. Debugging Agent Prompts

Capture exact prompts sent to the model:

```typescript
events.on('agent:start', (e) => {
  console.log(`\n[${e.agentId}] Prompt → model: ${e.modelName}`);
  console.log(String(e.prompt).slice(0, 500));
});

events.on('agent:complete', (e) => {
  console.log(`[${e.agentId}] Response (${e.duration}ms):`);
  console.log(e.result.slice(0, 300));
});
```

### 5. Monitoring Retries

```typescript
events.on('agent:retry', (e) => {
  console.warn(
    `[${e.agentId}] Retry ${e.attempt}/${e.maxAttempts} — ${e.error.message}`
  );
});
```

### 6. Collaborative Message Tracing

```typescript
events.on('message:sent', (e) => {
  const target = e.to === 'broadcast' ? 'all' : e.to;
  console.log(`[${e.from} → ${target}]: ${e.content.slice(0, 80)}`);
});
```

---

## 📦 Helper Classes

### `EventLogger`

Automatically logs all events to the built-in `Logger`:

```typescript
import { createEventLogger, SocietyEventEmitter } from 'societyai';

const emitter = new SocietyEventEmitter();
const logger = createEventLogger(emitter, {
  prefix: '[MyApp]',
});
// All events are now logged automatically
```

### `ProgressTracker`

Wraps an emitter and exposes a `getProgress()` method:

```typescript
import { createProgressTracker, SocietyEventEmitter } from 'societyai';

const emitter = new SocietyEventEmitter();
const tracker = createProgressTracker(emitter);

// Later:
console.log(tracker.getProgress()); // { percent: 60, phase: 'review', ... }
```

### `EventAggregator`

Collects all events and produces a summary:

```typescript
import { EventAggregator, SocietyEventEmitter } from 'societyai';

const emitter = new SocietyEventEmitter();
const aggregator = new EventAggregator(emitter);

// After execution:
const summary = aggregator.getSummary();
console.log(summary.totalAgentCalls);
console.log(summary.totalDuration);
console.log(summary.errors);
```

### `FilteredEventEmitter`

Applies a filter function — only matching events trigger handlers:

```typescript
import { FilteredEventEmitter, SocietyEventEmitter } from 'societyai';

const base = new SocietyEventEmitter();
const filtered = new FilteredEventEmitter(base, (name) =>
  name.startsWith('agent:')
);

filtered.on('agent:complete', (e) => {
  // Only fires for agent:complete, never for task:* or society:*
  console.log(e.result);
});
```

---

## 🔌 Integration with Society

Pass an `EventEmitterObserver` (or any `SocietyObserver` implementation) to
`.withObserver()` on your Society:

```typescript
import {
  Society,
  SocietyEventEmitter,
  createEventLogger,
  createProgressTracker,
} from 'societyai';

const emitter = new SocietyEventEmitter();

// Wire helpers
createEventLogger(emitter);
const tracker = createProgressTracker(emitter);

// Custom listener
emitter.on('agent:error', (e) => {
  alertOpsTeam(`Agent ${e.agentId} failed: ${e.error.message}`);
});

const result = await Society.create()
  .withId('monitored-workflow')
  .addAgent(/* ... */)
  .addTask(/* ... */)
  .execute('Start');

console.log('Final progress:', tracker.getProgress());
```

> **Note:** `SocietyEventEmitter` is decoupled from `Society`. It is designed
> for use cases where you need fine-grained, push-based event monitoring. For
> simple hook-based observation, use `Society.withObserver()` directly with a
> `SocietyObserver` implementation — see
> [Society Configuration](../2-building-societies/society-configuration.md).

---

## 🔌 Integration with Middleware

Emit custom events from inside a middleware:

```typescript
import { MiddlewareFn, SocietyEventEmitter } from 'societyai';

function createTracingMiddleware(emitter: SocietyEventEmitter): MiddlewareFn {
  return async (ctx, next) => {
    const start = Date.now();
    try {
      const result = await next(ctx);
      await emitter.emit('custom', {
        name: 'model:call',
        data: {
          agentId: ctx.agentId,
          duration: Date.now() - start,
          success: true,
        },
      });
      return result;
    } catch (error) {
      await emitter.emit('custom', {
        name: 'model:call',
        data: {
          agentId: ctx.agentId,
          duration: Date.now() - start,
          success: false,
          error: (error as Error).message,
        },
      });
      throw error;
    }
  };
}
```

---

## 📋 Full Event Map Reference

```typescript
interface SocietyEventMap {
  // Workflow
  'society:start':    WorkflowStartEvent;
  'society:complete': WorkflowCompleteEvent;
  'society:error':    WorkflowErrorEvent;

  // Tasks
  'task:start':    StepStartEvent;
  'task:complete': StepCompleteEvent;
  'task:error':    StepErrorEvent;
  'task:skipped':  StepSkippedEvent;

  // Agents
  'agent:start':    AgentStartEvent;
  'agent:complete': AgentCompleteEvent;
  'agent:error':    AgentErrorEvent;
  'agent:retry':    AgentRetryEvent;

  // Progress
  'progress': ProgressEvent;

  // Messages (collaborative steps)
  'message:sent':     MessageSentEvent;
  'message:received': MessageReceivedEvent;

  // Debug / custom
  'debug':  DebugEvent;
  'custom': CustomEvent;
}
```

---

## 📚 Related Documentation

- [OpenTelemetry Integration](./opentelemetry.md) — Distributed tracing with spans
- [Middleware](./middleware.md) — Emit events from within the middleware chain
- [Society Configuration](../2-building-societies/society-configuration.md) — `withObserver()` API
- [Worker Threads](./worker-threads.md) — Observability in isolated execution mode