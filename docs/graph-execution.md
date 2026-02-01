# Graph-Based Execution Engine

SocietyAI includes a powerful graph-based execution engine (`SocietyGraph`) that enables complex workflows with conditional branching, loops, and parallel execution.

## Overview

The `SocietyGraph` system provides:

- **DAG/Cyclic Support**: Both directed acyclic graphs (DAG) and cyclic graphs with loops
- **8 Node Types**: START, END, AGENT, PARALLEL, AGGREGATE, CONDITION, TRANSFORM, LOOP
- **Conditional Branching**: Dynamic routing based on runtime conditions
- **Loop Support**: Iteration with termination conditions
- **Parallel Execution**: Optimized concurrent agent execution
- **Graph Visualization**: Built-in visualization for debugging

## Node Types

### START

Entry point of the graph execution. Every graph must have at least one START node.

### END

Exit point of the graph. Execution completes when an END node is reached.

### AGENT

Executes a single agent with a specific role and model.

**Properties:**

- `agentId`: ID of the agent to execute

### PARALLEL

Executes multiple agents simultaneously.

**Properties:**

- `agentIds`: Array of agent IDs to execute in parallel

### AGGREGATE

Combines results from multiple previous nodes.

**Properties:**

- `aggregator`: Function that combines multiple results into one

```typescript
aggregator: (results: GraphStepResult[]) => string;
```

### CONDITION

Conditional branching based on the current result.

**Properties:**

- `condition`: Function that returns true/false for routing

```typescript
condition: (result: string, context: GraphContext) => boolean;
```

**Edges:**

- Must have edges labeled 'true' and 'false'

### TRANSFORM

Transforms the current result without calling an agent.

**Properties:**

- `transformer`: Function that transforms the result

```typescript
transformer: (result: string, context: GraphContext) => string;
```

### LOOP

Loop control with iteration tracking and termination condition.

**Properties:**

- `loopCondition`: Function that determines if loop should continue
- `maxIterations`: Maximum number of loop iterations (safety limit)

```typescript
loopCondition: (iteration: number, result: string, context: GraphContext) => boolean;
```

## Basic Example

```typescript
import { GraphBuilder, NodeType, AgentBuilder, RoleBuilder } from 'societyai';

// Define agent roles
const analyzerRole = RoleBuilder.create()
  .withId('analyzer')
  .withName('Analyzer')
  .withSystemPrompt('You analyze code and identify issues.')
  .build();

const fixerRole = RoleBuilder.create()
  .withId('fixer')
  .withName('Fixer')
  .withSystemPrompt('You fix identified issues.')
  .build();

// Create agents
const agents = [
  AgentBuilder.create().withId('analyzer').withRole(analyzerRole).withModel(myModel).build(),
  AgentBuilder.create().withId('fixer').withRole(fixerRole).withModel(myModel).build(),
];

// Build the graph
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('analyze', NodeType.AGENT, { agentId: 'analyzer' })
  .addNode('fix', NodeType.AGENT, { agentId: 'fixer' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'analyze')
  .addEdge('analyze', 'fix')
  .addEdge('fix', 'end')
  .build();

// Execute
const result = await graph.execute('Analyze and fix this code: ...', agents);
console.log(result.output);
```

## Conditional Branching

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('validate', NodeType.AGENT, { agentId: 'validator' })
  .addNode('check', NodeType.CONDITION, {
    condition: (result) => result.includes('valid'),
  })
  .addNode('success', NodeType.END)
  .addNode('retry', NodeType.AGENT, { agentId: 'fixer' })
  .addEdge('start', 'validate')
  .addEdge('validate', 'check')
  .addEdge('check', 'success', { label: 'true' })
  .addEdge('check', 'retry', { label: 'false' })
  .addEdge('retry', 'validate') // Loop back
  .build();
```

## Parallel Execution

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('parallel', NodeType.PARALLEL, {
    agentIds: ['analyst1', 'analyst2', 'analyst3'],
  })
  .addNode('aggregate', NodeType.AGGREGATE, {
    aggregator: (results) => {
      return results.map((r) => r.output).join('\n\n---\n\n');
    },
  })
  .addNode('end', NodeType.END)
  .addEdge('start', 'parallel')
  .addEdge('parallel', 'aggregate')
  .addEdge('aggregate', 'end')
  .build();
```

## Loops with Termination

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('process', NodeType.AGENT, { agentId: 'processor' })
  .addNode('loop', NodeType.LOOP, {
    loopCondition: (iteration, result, context) => {
      // Continue if not complete and under 5 iterations
      return !result.includes('COMPLETE') && iteration < 5;
    },
    maxIterations: 10, // Safety limit
  })
  .addNode('end', NodeType.END)
  .addEdge('start', 'process')
  .addEdge('process', 'loop')
  .addEdge('loop', 'process') // Loop back
  .addEdge('loop', 'end') // Exit when condition false
  .build();
```

## Transform Nodes

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent', NodeType.AGENT, { agentId: 'writer' })
  .addNode('uppercase', NodeType.TRANSFORM, {
    transformer: (result) => result.toUpperCase(),
  })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent')
  .addEdge('agent', 'uppercase')
  .addEdge('uppercase', 'end')
  .build();
```

## Conditional Edges Helper

The `addConditionalEdge` method provides a shortcut for creating conditional branching:

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('validate', NodeType.AGENT, { agentId: 'validator' })
  .addNode('success', NodeType.END)
  .addNode('fix', NodeType.AGENT, { agentId: 'fixer' })
  .addEdge('start', 'validate')
  .addConditionalEdge('validate', {
    condition: (result) => result.includes('valid'),
    truePath: 'success',
    falsePath: 'fix',
  })
  .addEdge('fix', 'validate') // Loop back for retry
  .build();
```

## Graph Context

The `GraphContext` object provides state during execution:

```typescript
interface GraphContext {
  input: string; // Original input
  currentResult: string; // Current result
  nodeResults: Map<string, GraphStepResult>; // All results
  sharedData: Map<string, unknown>; // Shared data between nodes
  iterationCounts: Map<string, number>; // Loop iteration counts
  executionPath: string[]; // Nodes executed
  startTime: number; // Execution start time
  signal?: AbortSignal; // Cancellation signal
}
```

You can access context in conditions, transformers, and aggregators:

```typescript
{
  condition: (result, context) => {
    const iterations = context.iterationCounts.get('myLoop') || 0;
    return iterations < 3 && result.includes('continue');
  };
}
```

## Graph Result

Execution returns a `GraphResult`:

```typescript
interface GraphResult {
  output: string; // Final output
  success: boolean; // Execution success
  nodeResults: Map<string, GraphStepResult>; // All node results
  executionPath: string[]; // Path taken
  duration: number; // Total duration (ms)
  errors?: Error[]; // Errors if any
  metadata?: Record<string, unknown>; // Additional data
}
```

## Visualization

Debug your graph structure with the built-in visualizer:

```typescript
const graph = GraphBuilder.create()
  // ... build graph ...
  .build();

console.log(graph.visualize());
```

Output example:

```
Graph Structure:

Nodes:
  [start] START
  [analyze] AGENT (analyzer)
  [check] CONDITION
  [fix] AGENT (fixer)
  [end] END

Edges:
  start -> analyze
  analyze -> check
  check -> end (true)
  check -> fix (false)
  fix -> analyze
```

## Best Practices

1. **Always have START and END nodes**: Every graph needs entry and exit points
2. **Validate graph structure**: The builder automatically validates cycles and connectivity
3. **Use meaningful node IDs**: Makes debugging easier
4. **Set max iterations on loops**: Prevents infinite loops
5. **Use TRANSFORM for simple operations**: No need to call an agent for string manipulation
6. **Leverage shared data**: Use `context.sharedData` to pass state between nodes
7. **Monitor execution path**: Check `result.executionPath` to understand the flow taken

## Error Handling

Errors in nodes are automatically caught and included in the result:

```typescript
const result = await graph.execute(input, agents);

if (!result.success) {
  console.error('Graph execution failed');
  console.error(result.errors);
}
```

## Cancellation

Support for cancellation via AbortSignal:

```typescript
const controller = new AbortController();

// Start execution
const promise = graph.execute(input, agents, controller.signal);

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const result = await promise;
} catch (error) {
  console.log('Execution cancelled');
}
```

## Advanced: Custom Aggregators

Create sophisticated result aggregation:

```typescript
function consensusAggregator(threshold: number = 0.6) {
  return (results: GraphStepResult[]) => {
    // Count occurrences of each result
    const counts = new Map<string, number>();

    for (const result of results) {
      const count = counts.get(result.output) || 0;
      counts.set(result.output, count + 1);
    }

    // Find consensus
    for (const [output, count] of counts.entries()) {
      if (count / results.length >= threshold) {
        return output;
      }
    }

    // No consensus, return majority
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };
}

const graph = GraphBuilder.create()
  .addNode('aggregate', NodeType.AGGREGATE, {
    aggregator: consensusAggregator(0.7),
  })
  // ...
  .build();
```

## Next Steps

- See [Tool Calling](./tool-calling.md) for integrating external functions
- See [Memory System](./memory-system.md) for context management
- See [Examples](./examples.md) for complete workflow examples
