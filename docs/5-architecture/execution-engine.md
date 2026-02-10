# Execution Engine Architecture

## Overview

The `ExecutionEngine` (formerly `SocietyGraph`) is the heart of SocietyAI. It
transforms the high-level configuration into a runnable Directed Graph.

Unlike traditional recursive engines which can hit stack limits, SocietyAI uses
an **Iterative State Machine** approach. This allows for:

1.  **Infinite Loops** (controlled by `LoopController`).
2.  **Pause/Resume** capabilities (State Persistence).
3.  **Deep Graphs** without stack overflow.

## Iterative Execution Model

The engine maintains a `GraphContext` that holds the current state of execution.

1.  **Queue-Based**: Nodes to be executed are held in a queue.
2.  **Step-by-Step**: The engine pulls a node, executes it, and pushes the next
    node(s) based on the edges.
3.  **State Persistence**: The context is mutated cleanly, allowing the entire
    state to be serialized at any point.

### The Loop Controller

Cycles are managed by the `LoopController`. When a `LOOP` node is encountered:

1.  It checks the `exitCondition`.
2.  It increments the `iterationCount`.
3.  If `maxIterations` is reached, it forces an exit or throws an error.
4.  It manages how memory is aggregated (e.g., should the agent remember _every_
    failed attempt or just the last one?).

## Node Types Reference

The graph is composed of 10 node types, each handling a specific control flow or
execution logic.

### 🏁 Structural Nodes

- **`START`**: The entry point of the graph. Receives the initial input.
- **`END`**: The exit point. The result of the storage pointing to this node
  becomes the final output.

### 🤖 Execution Nodes

- **`AGENT`**: Executes a single agent.
  - _Config_: `agentId` (required).
  - _Behavior_: Calls the agent's `process` method with the node input.
- **`HUMAN`**: Pauses execution and waits for external input.
  - _Behavior_: Serializes state and returns a suspension signal. Execution
    resumes via `engine.resume()`.

### 🔀 Control Flow Nodes

- **`PARALLEL`**: Executes multiple agents concurrently.
  - _Config_: `agentIds: string[]` (required).
  - _Behavior_: Runs all specified agents in parallel on the same input.
- **`AGGREGATE`**: Combines results from parallel branches.
  - _Config_: `aggregator: (results: TaskResult[]) => string` (required).
  - _Behavior_: Waits for all incoming edges to complete before proceeding.
- **`CONDITION`**: Basic if/else logic.
  - _Config_: `condition: (result: string, context: GraphContext) => boolean`.
  - _Behavior_: Evaluates input and routes to either `truePath` or `falsePath`.
- **`LOOP`**: Handles iterative execution.
  - _Config_: `maxIterations`,
    `loopCondition?: (iteration, result, context) => boolean`.
  - _Behavior_: Checks condition; if false, exits the loop.

### 🤝 Complex Pattern Nodes

- **`COLLABORATIVE`**: Manages a chat between multiple agents without a fixed
  graph structure.
  - _Config_: `agentIds: string[]`, `messageRouter?`, `completionCondition?`.
  - _Behavior_: Agents talk to each other until a termination condition is met
    (e.g., "Consensus Reached").
- **`TRANSFORM`**: A pure function node.
  - _Config_: `transformer: (result: string, context: GraphContext) => string`.
  - _Behavior_: Modifies the data passing through (e.g., simple formatting)
    without using an LLM.

## API Usage

### Using GraphBuilder

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const engine = GraphBuilder.create()
  // 1. Define Nodes
  .addNode('start', NodeType.START)
  .addNode('analyst', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('reviewer', NodeType.AGENT, { agentId: 'reviewer' })
  .addNode('decision', NodeType.CONDITION, {
    condition: (res) => res.includes('LGTM'),
  })
  .addNode('end', NodeType.END)

  // 2. Define Edges
  .addEdge('start', 'analyst')
  .addEdge('analyst', 'decision')
  .addConditionalEdge({
    from: 'decision',
    condition: (res) => res.includes('LGTM'),
    truePath: 'end',
    falsePath: 'reviewer', // Loop back for review
  })
  .addEdge('reviewer', 'analyst')

  .build();

const result = await engine.execute(initialInput, availableAgents);
```

## `EngineAsModel`

Adapter that allows an `ExecutionEngine` to be used as an `AIModel`. This
enables **Hierarchical Societies** (societies within societies).

```typescript
const innerGraph = ...; // specific complex workflow
const innerModel = new EngineAsModel({
  engine: innerGraph,
  agents: teamAgents,
  name: 'inner-team',
  onError: 'return-error-message',
});

// The Orchestrator treats the whole 'InnerSociety' as just another intelligent model
const orchestrator = Society.create()
  .addAgent(a => a
    .withId('orchestrator')
    .withRole(r => r.withSystemPrompt('...'))
    .withModel(innerModel) // Use the inner society as a model!
  )
  .addTask(t => t.withId('task').withAgents(['orchestrator']).sequential())
  .execute('...');
```

## Persistence & Reliability

The engine is designed for long-running workflows that must survive process
crashes.

### Granular State Snapshotting

When a `StorageAdapter` is provided, the engine snapshots its state:

1.  **Before Execution**: Saves the initial queue.
2.  **After Each Node**: Saves the updated state (Result + Next Queue)
    immediately.
3.  **On Pause (Human)**: Saves the state with the `Human` node at the head of
    the queue.

This "Paranoid" persistence ensures that if the process crashes:

- **During Processing**: Resuming loads the "Before" state, so the interrupted
  node is re-executed (safe idempotent behavior).
- **After Processing**: Resuming loads the "After" state, skipping re-execution
  of the completed node.

### Retry Policy

Nodes can be configured with specific `RetryOptions` to handle transient
failures (e.g., API 429 Rate Limits). The engine uses an **Exponential Backoff
with Jitter** strategy.

### Dead Letter Queue (DLQ)

If a node fails permanently (after all retries), it is moved to a
`deadLetterQueue` in the GraphContext, preventing it from blocking the entire
society if processed in a fault-tolerant manner.
