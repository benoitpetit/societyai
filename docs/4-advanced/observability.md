# Observability & Event System

SocietyAI provides a robust, strictly-typed event system that allows you to
monitor every aspect of your multi-agent system's execution. This is crucial for
debugging, progress tracking, and integration with external monitoring tools
(like Datadog, Prometheus, or custom dashboards).

## 📡 The SocietyEventEmitter

The core of the observability system is the `SocietyEventEmitter`. It works
similarly to the standard Node.js `EventEmitter` but with type safety and async
support.

```typescript
import { SocietyEventEmitter } from 'societyai';

// Create an instance
const events = new SocietyEventEmitter();

// Listen to specific events
events.on('agent:start', async (event) => {
  console.log(`Agent ${event.agentId} started task ${event.taskId}`);
});
```

## 📊 Event Types

Events are categorized by their source and lifecycle phase.

### LifeCycle Events

| Event Name         | Description                    | Payload Data                      |
| ------------------ | ------------------------------ | --------------------------------- |
| `society:start`    | Workflow begins execution      | `societyId`, `startTime`          |
| `society:complete` | Workflow finishes successfully | `societyId`, `result`, `duration` |
| `society:error`    | Workflow crashes               | `error`, `societyId`              |

### Agent Events

| Event Name       | Description                           | Payload Data                 |
| ---------------- | ------------------------------------- | ---------------------------- |
| `agent:start`    | Agent begins processing               | `agentId`, `taskId`, `input` |
| `agent:thought`  | Agent receives a stream chunk/thought | `agentId`, `content`         |
| `agent:complete` | Agent finishes a task                 | `agentId`, `output`, `usage` |
| `agent:error`    | Agent encounters an error             | `agentId`, `error`           |

### Execution Events

| Event Name       | Description                   | Payload Data               |
| ---------------- | ----------------------------- | -------------------------- |
| `task:start`     | A graph node/task starts      | `taskId`, `nodeType`       |
| `task:complete`  | A graph node/task completes   | `taskId`, `result`         |
| `loop:iteration` | A loop completes an iteration | `loopId`, `iterationCount` |

## 🛠️ Usage Examples

### 1. Real-time Logging

```typescript
events.onAny((eventName, data) => {
  logger.info(`[${eventName}]`, data);
});
```

### 2. Progress Tracking

You can track the progress of long-running workflows by monitoring task
completions.

```typescript
const totalTasks = 10;
let completed = 0;

events.on('task:complete', () => {
  completed++;
  const percent = Math.round((completed / totalTasks) * 100);
  updateProgressBar(percent);
});
```

### 3. Debugging Stream

Capture agent "thoughts" or intermediate outputs for debugging LLM reasoning.

```typescript
events.on('agent:thought', (event) => {
  // Stream to websocket or console
  process.stdout.write(event.content);
});
```

## 🔌 Integration with Middleware

You can combine Observability with Middleware to automatically emit custom
metrics.

```typescript
// Middleware that tracks duration and emits custom metric events
const metricsMiddleware: MiddlewareFn = async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    ctx.events.emit('metric:duration', {
      method: ctx.method,
      duration,
    });
  }
};
```
