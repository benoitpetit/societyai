# Event System

## `SocietyEventEmitter`

Event emitter for observing execution.

```typescript
const emitter = SocietyEventEmitter.create();

emitter.on('society:start', (event) => {
  console.log('Society started:', event.societyId);
});

emitter.on('agent:complete', (event) => {
  console.log(`Agent ${event.agentId} completed in ${event.duration}ms`);
});
```

## Event Types

### Society Events
- **`society:start`**: Society started.
- **`society:complete`**: Society completed.
- **`society:error`**: Error in society.

### Task Events
- **`task:start`**: Task started.
- **`task:complete`**: Task completed.
- **`task:error`**: Error in task.
- **`task:skipped`**: Task skipped.

### Agent Events
- **`agent:start`**: Agent started.
- **`agent:complete`**: Agent completed.
- **`agent:error`**: Agent error.
- **`agent:retry`**: Agent retrying.

### Message Events
- **`message:sent`**: Message sent.
- **`message:received`**: Message received.

### Progress Events
- **`progress:update`**: Progress update.

## `ProgressTracker`

Tracks execution progress.

```typescript
const tracker = createProgressTracker();

tracker.on('progress', (event) => {
  const percentage = (event.completed / event.total) * 100;
  console.log(`Progress: ${percentage.toFixed(1)}%`);
});
```
