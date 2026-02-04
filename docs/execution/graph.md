# Execution Graph

## `ExecutionEngine` (alias `SocietyGraph`)

Graph-based execution engine. Used internally but can be used directly for advanced use cases.

```typescript
const engine = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('analyzer', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'analyzer')
  .addEdge('analyzer', 'end')
  .build();

const result = await engine.execute(input, agents);
```

## `GraphBuilder`

Builder for creating execution graphs.

### Methods

- **`create()`**: Creates a new graph builder.
- **`addNode(id, type, config?)`**: Adds a node.
- **`addEdge(from, to, config?)`**: Adds an edge.
- **`addConditionalEdge(from, { condition, truePath, falsePath })`**: Adds a conditional edge.
- **`build()`**: Builds the graph.

## Constants

### `NodeType`

Types of nodes in the execution graph.

```typescript
enum NodeType {
  START = 'start',
  END = 'end',
  AGENT = 'agent',
  PARALLEL = 'parallel',
  AGGREGATE = 'aggregate',
  CONDITION = 'condition',
  TRANSFORM = 'transform',
  LOOP = 'loop',
  COLLABORATIVE = 'collaborative',
}
```

## `EngineAsModel`

Adapter that allows an `ExecutionEngine` to be used as an AI Model, enabling hierarchical societies (societies within societies).

```typescript
import { EngineAsModel, GraphBuilder, NodeType } from 'societyai';

const innerGraph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('worker', NodeType.AGENT, { agentId: 'inner-worker' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'worker')
  .addEdge('worker', 'end')
  .build();

const innerModel = new EngineAsModel(innerGraph, [innerAgent], {
  name: 'InnerSociety',
  description: 'A society encapsulated as a model'
});

// Use as a regular model in outer society
const outerSociety = Society.create()
  .addAgent(a => a
    .withId('orchestrator')
    .withModel(innerModel)
    .withRole(r => r.withSystemPrompt('Coordinate the inner society'))
  )
  .addTask(s => s.withId('orchestrate').withAgents(['orchestrator']).sequential())
  .execute(input);
```

### Constructor

```typescript
constructor(
  graph: ExecutionEngine,
  agents: Agent[],
  options?: { name?: string; description?: string }
)
```

### `TaskExecutionType`

Execution types for workflow steps.

```typescript
type TaskExecutionType = 
  | 'sequential'
  | 'parallel'
  | 'collaborative'
  | 'conditional';
```
