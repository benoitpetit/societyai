# Persistence & Human-in-the-Loop

SocietyAI includes a robust, zero-dependency persistence system that allows you
to save the state of your agent society at any point, survive process crashes,
and pause execution for human intervention.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Storage Adapters](#storage-adapters)
- [Crash Recovery](#crash-recovery)
- [Resuming Execution](#resuming-execution)
- [Human-in-the-Loop (HITL)](#human-in-the-loop-hitl)
- [WorkflowState Structure](#workflowstate-structure)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🗺️ Overview

The persistence system is built around two concepts:

- **`StorageAdapter`** — An interface for serialising and deserialising the
  execution state to any backend (file system, Redis, PostgreSQL, etc.).
- **`WorkflowState`** — The serialisable snapshot of the entire execution graph
  at a given point in time (queue, results, context, execution path).

When a `StorageAdapter` is provided to the execution engine, it automatically
snapshots state:

1. **Before** each node executes — guarantees re-execution on crash (safe
   idempotent behaviour).
2. **After** each node completes — prevents re-execution of already-completed
   nodes on resume.
3. **On pause** (Human task) — saves state with `status: 'paused'` so the
   process can exit cleanly.

---

## 🔌 Storage Adapters

### Built-in: `FileStorageAdapter`

Zero-dependency file-based storage included out of the box.

```typescript
import { FileStorageAdapter } from 'societyai';

const storage = new FileStorageAdapter({ baseDir: './.society-data' });
```

State files are written as JSON to `<baseDir>/<executionId>.json`.

### Custom Adapter

Implement the `StorageAdapter` interface to store state in any backend:

```typescript
interface StorageAdapter {
  save(id: string, state: WorkflowState): Promise<void>;
  load(id: string): Promise<WorkflowState | null>;
  delete(id: string): Promise<void>;
  list(): Promise<string[]>;
}
```

**Example — in-memory adapter for testing:**

```typescript
import { StorageAdapter, WorkflowState } from 'societyai';

class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, WorkflowState>();

  async save(id: string, state: WorkflowState): Promise<void> {
    this.store.set(id, structuredClone(state));
  }

  async load(id: string): Promise<WorkflowState | null> {
    return this.store.get(id) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }
}
```

### External Adapters (peer dependencies)

For production environments, SocietyAI provides two additional adapters that
require external peer dependencies. See
[Advanced Features](../6-advanced-features/advanced-features.md) for full
setup instructions.

| Adapter | Peer Dependency | Use Case |
|---|---|---|
| `RedisStorageAdapter` | `ioredis` | Distributed, multi-instance, TTL-based cleanup |
| `PostgresStorageAdapter` | `pg` | ACID compliance, audit trail, complex queries |

---

## 💾 Crash Recovery

Pass a `StorageAdapter` to the low-level `ExecutionEngine.execute()` call to
enable automatic state snapshotting:

```typescript
import { GraphBuilder, NodeType, FileStorageAdapter } from 'societyai';

const storage = new FileStorageAdapter({ baseDir: './.society-data' });

const engine = GraphBuilder.create()
  .addNode('start',  NodeType.START)
  .addNode('worker', NodeType.AGENT, { agentId: 'worker' })
  .addNode('end',    NodeType.END)
  .addEdge('start',  'worker')
  .addEdge('worker', 'end')
  .build();

const result = await engine.execute(
  input,
  agents,
  signal,
  observer,
  middlewareChain,
  storage    // ← enable persistence
);
```

If the process crashes mid-execution, the saved state lets you resume exactly
where it left off — no agent is re-executed unnecessarily.

> **Note:** `Society.create().execute()` accepts only `(input, signal?)`. To
> use a storage adapter, use the low-level `GraphBuilder` / `ExecutionEngine`
> API directly as shown above.

---

## ▶️ Resuming Execution

Load a previously saved state and pass it to `engine.resume()`:

```typescript
import { FileStorageAdapter } from 'societyai';

const storage = new FileStorageAdapter({ baseDir: './.society-data' });

// List all saved states
const savedIds = await storage.list();
console.log('Saved workflows:', savedIds);

// Load a specific state
const state = await storage.load('execution-id-123');

if (state && state.status !== 'completed') {
  const result = await engine.resume(
    state,
    agents,
    undefined,  // humanInput — see Human-in-the-Loop below
    signal,
    observer,
    middlewareChain,
    storage     // continue persisting on resume
  );

  console.log('Resumed result:', result.output);
}
```

### Workflow Statuses

| Status | Description |
|---|---|
| `'active'` | Workflow is currently running. |
| `'paused'` | Workflow is waiting for human input. |
| `'completed'` | Workflow finished successfully. |
| `'failed'` | Workflow encountered an unrecoverable error. |

---

## 🙋 Human-in-the-Loop (HITL)

You can pause a workflow at any point to wait for human input, approval, or
data entry, then resume it programmatically.

### Configuring a Human Task

Use `.isHuman()` in the Task Builder:

```typescript
import { Society } from 'societyai';

Society.create()
  .addTask((t) =>
    t
      .withId('manager-approval')
      .withName('Manager Approval')
      .isHuman()
      .withDescription(
        'Wait for a manager to review the draft and type "Approved" or "Rejected".'
      )
  );
```

### Handling the Pause

When the execution engine encounters a Human task:

1. It saves the current state with `status: 'paused'`.
2. It returns a result object with `status: 'paused'` and `waitingForNodeId`.
3. The Node.js process can exit safely — all state is persisted.

```typescript
const result = await engine.execute(input, agents, signal, observer, chain, storage);

if (result.status === 'paused') {
  console.log('Workflow paused, waiting for human input.');
  console.log('Waiting at node:', result.waitingForNodeId);
  // Send a notification to the reviewer here (email, Slack, etc.)
  process.exit(0);
}
```

### Resuming with Human Input

When the human provides their input, load the saved state and resume:

```typescript
const state = await storage.load('execution-id-123');

if (state?.status === 'paused') {
  const userInput = 'Approved'; // From a CLI prompt, REST API, or UI form

  const result = await engine.resume(
    state,
    agents,
    userInput,  // ← Human input injected here; passed to the next agent
    signal,
    observer,
    middlewareChain,
    storage
  );

  console.log('Workflow resumed. Final output:', result.output);
}
```

The human input is passed as the input to the node immediately following the
Human task, making it available via the `{input}` and `{history}` prompt
placeholders for subsequent agents.

---

## 🗄️ WorkflowState Structure

The `WorkflowState` object contains everything needed to reconstruct the
execution from any point.

```typescript
interface WorkflowState {
  /** Unique identifier for this execution */
  executionId: string;

  /** Current lifecycle status */
  status: 'active' | 'paused' | 'completed' | 'failed';

  /** IDs of nodes queued for execution */
  queue: string[];

  /** Serialised results keyed by node ID */
  results: Record<string, unknown>;

  /** Serialised global shared data (context) */
  sharedData: Record<string, unknown>;

  /** Ordered list of node IDs that have been executed */
  executionPath: string[];

  /** ID of the node that triggered a pause (Human task) */
  waitingForNodeId?: string;

  /** ISO timestamp of the last state update */
  updatedAt?: string;
}
```

---

## ✅ Best Practices

1. **Always use `executionId` for namespacing** — Use a meaningful, unique ID
   (e.g., derived from the task description or a UUID) so saved states are easy
   to identify and list.

2. **Clean up completed states** — Call `storage.delete(id)` after a workflow
   completes to prevent unbounded growth of saved files or records.

3. **Use Redis or PostgreSQL in production** — `FileStorageAdapter` is suitable
   for local development and single-process deployments. For distributed
   systems, use `RedisStorageAdapter` or `PostgresStorageAdapter`.

4. **Treat Human tasks as boundaries** — Design your workflow so that the
   context before and after a Human task is self-contained. The human input
   should be sufficient for the next agent to continue without re-running prior
   steps.

5. **Test resume scenarios** — Always test that your workflow resumes correctly
   from a paused state, including edge cases like human input being rejected or
   left blank.

---

## 📚 Next Steps

- **[Advanced Features](../6-advanced-features/advanced-features.md)** — Setup
  guides for `RedisStorageAdapter` and `PostgresStorageAdapter`.
- **[Execution Engine](../5-architecture/execution-engine.md)** — Deep dive into
  granular state snapshotting and the Dead Letter Queue.
- **[Loops & Cycles](../4-advanced/loops-cycles.md)** — Combine persistence with
  long-running self-correction loops.
- **[Observability](../4-advanced/observability.md)** — Track pause and resume
  events via the event system.
- **[Society Configuration](../2-building-societies/society-configuration.md)**
  — High-level API entry point (note: storage adapters require the low-level
  `ExecutionEngine` API).