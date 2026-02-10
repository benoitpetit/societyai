# Persistence & Human-in-the-Loop

SocietyAI includes a robust, zero-dependency persistence system that allows you
to save the state of your agent society, handle crashes, and pause execution for
human intervention.

## Persistence (Crash Recovery)

The persistence system uses a `StorageAdapter` to serialize the entire execution
graph (memory, results, queue, context) to disk.

### Basic Usage

The persistence system uses a `StorageAdapter` to serialize the execution state.
A default `FileStorageAdapter` is provided for zero-dependency file-based
storage.

```typescript
import { FileStorageAdapter } from 'societyai';
import { Society } from 'societyai';

const storage = new FileStorageAdapter({ baseDir: './.society-data' });

// Currently, storage is passed to the execute method
const result = await society.execute(
  input,
  signal,
  undefined,
  undefined,
  undefined,
  storage
);
```

### Resume Execution

If a workflow is paused (e.g., via a Human task) or stops unexpectedly, you can
resume it using the saved state:

```typescript
const state = await storage.load('execution-id-123');

if (state) {
  const result = await engine.resume(
    state,
    agents,
    humanInput, // Optional: result for the waiting Human task
    signal,
    observer,
    middlewareChain,
    storage // Pass storage again to continue persisting
  );
}
```

## StorageAdapter Interface

You can implement your own `StorageAdapter` to save state to a database, Redis,
or any other storage system.

```typescript
interface StorageAdapter {
  save(id: string, state: WorkflowState): Promise<void>;
  load(id: string): Promise<WorkflowState | null>;
  delete(id: string): Promise<void>;
  list(): Promise<string[]>;
}
```

### WorkflowState Structure

The `WorkflowState` object contains everything needed to reconstruct the
execution:

- `executionId`: Unique ID.
- `status`: 'active', 'paused', 'completed', or 'failed'.
- `queue`: IDs of nodes waiting to be processed.
- `results`: Serialized task results.
- `sharedData`: Serialized global context.
- `executionPath`: History of executed nodes.
- `waitingForNodeId`: The ID of the node that triggered a pause.

## Human-in-the-Loop (HITL)

You can pause the workflow to wait for human input, approval, or data entry.

### Configuring a Human Task

Use `.isHuman()` in the Task Builder:

```typescript
society.addTask((t) =>
  t
    .withId('manager-approval')
    .withName('Manager Approval')
    .isHuman()
    .withDescription('Wait for a manager to type "Approved" or "Rejected"')
);
```

### Handling the Pause

When the engine encounters a Human task:

1. It saves the state with status `paused`.
2. It returns a result with `status: 'paused'` and `waitingForNodeId`.
3. The process can exit safely.

### Resuming with Input

To provide the human input and continue:

```typescript
const userInput = 'Approved'; // From CLI, API, or UI

const result = await graph.resume(
  savedState,
  agents,
  userInput, // Inject human input here
  undefined,
  undefined,
  undefined,
  storage
);

// The workflow continues, and the human input is passed to the next agent
```
