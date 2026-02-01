# SocietyAI Examples

This directory contains comprehensive examples demonstrating all features of SocietyAI.

## Available Examples

### 1. Graph-Based Workflow (`graph-workflow.ts`)

Demonstrates the new graph-based execution engine with:

- Conditional branching
- Loop support
- Parallel execution
- Dynamic routing

**Run:**

```bash
ts-node examples/graph-workflow.ts
```

### 2. Tool Calling System (`tool-calling.ts`)

Shows how agents can use tools to:

- Perform calculations
- Manipulate strings
- Store and retrieve data
- Call custom functions

**Run:**

```bash
ts-node examples/tool-calling.ts
```

### 3. Memory System (`memory-system.ts`)

Demonstrates multi-level memory:

- Short-term conversation history
- Long-term fact storage
- Entity tracking
- Importance-based retrieval

**Run:**

```bash
ts-node examples/memory-system.ts
```

### 4. Structured Output Validation (`structured-output.ts`)

Shows automatic validation with retry:

- JSON Schema validation
- Error feedback to agents
- Automatic retry logic
- Complex nested schemas

**Run:**

```bash
ts-node examples/structured-output.ts
```

### 5. Metrics and Observability (`metrics-tracking.ts`)

Comprehensive tracking of:

- Token usage
- Execution time
- Cost estimation
- OpenTelemetry export
- Performance profiling

**Run:**

```bash
ts-node examples/metrics-tracking.ts
```

### 6. Complete Integration (`complete-integration.ts`)

End-to-end example using all features together:

- Graph-based workflow
- Tool calling
- Memory system
- Output validation
- Metrics tracking

**Run:**

```bash
ts-node examples/complete-integration.ts
```

## Running All Examples

```bash
npm run examples
```

Or run them individually:

```bash
# Graph workflow
npm run example:graph

# Tool calling
npm run example:tools

# Memory system
npm run example:memory

# Structured output
npm run example:validation

# Metrics tracking
npm run example:metrics

# Complete integration
npm run example:complete
```

## Key Concepts Demonstrated

### Graph-Based Execution

- **DAG Support**: Directed Acyclic Graphs for complex workflows
- **Conditional Edges**: Dynamic routing based on runtime conditions
- **Loop Support**: Iterative processing with termination conditions
- **Parallel Execution**: Run multiple agents simultaneously

### Tool Calling

- **Function Definitions**: JSON Schema-based tool definitions
- **Parameter Validation**: Automatic validation of tool inputs
- **Result Handling**: Structured tool result processing
- **Error Recovery**: Retry logic for failed tool calls

### Memory System

- **Short-Term Memory**: Recent conversation with auto-summarization
- **Long-Term Memory**: Persistent facts with semantic search
- **Entity Memory**: Track specific entities and their facts
- **Importance Scoring**: Priority-based memory retrieval

### Structured Output

- **Schema Validation**: JSON Schema-based validation
- **Automatic Retry**: Retry with error feedback
- **Type Safety**: Fully typed validated outputs
- **Complex Schemas**: Support for nested objects and arrays

### Observability

- **Token Tracking**: Per-agent token usage monitoring
- **Cost Estimation**: Automatic cost calculation
- **Performance Profiling**: Detailed timing metrics
- **OpenTelemetry**: Industry-standard trace export

## Advanced Patterns

### Combining Features

```typescript
// Create a graph with tools, memory, and validation
const graph = GraphBuilder.create()
  .addNode('agent-with-tools', NodeType.AGENT, {
    agentId: 'tool-user',
    memory: memorySystem,
    validator: outputValidator,
  })
  .build();

// Execute with full metrics
tracker.start('workflow');
const result = await graph.execute(input, agents);
tracker.end('workflow', { tokens: tokenMetrics });
```

### Real-World Use Cases

1. **Code Review Pipeline**: Analyze → Fix → Validate loop with tools
2. **Data Processing**: Parallel processing with aggregation
3. **Research Assistant**: Memory-enhanced information gathering
4. **API Integration**: Tool calling for external services
5. **Quality Assurance**: Structured output validation for consistency

## Best Practices

1. **Memory Management**: Balance short-term and long-term storage
2. **Tool Design**: Keep tools focused and well-documented
3. **Schema Design**: Start simple, add complexity as needed
4. **Metrics Collection**: Track what matters for your use case
5. **Graph Design**: Minimize cycles, use conditions wisely

## Troubleshooting

### Common Issues

**Graph validation fails:**

- Ensure START and END nodes exist
- Check all edges reference valid nodes
- Verify conditional logic is correct

**Tool execution fails:**

- Validate parameter schemas match tool definitions
- Check required parameters are provided
- Ensure tool executors handle errors

**Memory retrieval is slow:**

- Limit result count with `limit` parameter
- Use importance scoring for prioritization
- Consider implementing vector provider for semantic search

**Validation keeps retrying:**

- Check schema matches expected output format
- Verify agent understands schema requirements
- Add schema description to agent prompt

## Contributing

Found a bug or want to add a new example? Please submit a pull request or open an issue on GitHub.

## License

MIT License - see LICENSE file for details
