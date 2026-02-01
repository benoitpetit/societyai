# Metrics & Observability

The Metrics & Observability system provides comprehensive tracking of AI agent performance, costs, and execution metrics with support for OpenTelemetry export.

## Overview

The Metrics & Observability system provides:

- **MetricsTracker**: Track workflow execution, tokens, costs, and custom metrics
- **TokenCounter**: Estimate and count tokens for cost calculation
- **PerformanceProfiler**: Detailed performance profiling with marks and measures
- **Cost Estimation**: Automatic cost calculation for major AI models
- **OpenTelemetry Export**: Industry-standard trace format for observability platforms
- **Aggregation**: Combine metrics across multiple executions
- **History Tracking**: Maintain execution history with filtering

## Core Components

### MetricsTracker

Main metrics tracking class:

```typescript
import { MetricsBuilder, CommonCostConfigs } from 'societyai';

const tracker = MetricsBuilder.create()
  .withTokenTracking()
  .withCostTracking(CommonCostConfigs['gpt-4'])
  .withCustomMetrics(['api_calls', 'cache_hits'])
  .build();

// Start tracking a workflow
tracker.start('workflow-1');

// Update during execution
tracker.updateTokens('workflow-1', {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  model: 'gpt-4',
});

// Add custom metrics
tracker.addCustomMetric('workflow-1', 'api_calls', 5);

// End tracking
const snapshot = tracker.end('workflow-1');

console.log(snapshot);
// {
//   id: 'workflow-1',
//   execution: { success: true, duration: 1234, startTime: ..., endTime: ... },
//   tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
//   costs: { inputCost: 0.003, outputCost: 0.003, totalCost: 0.006 },
//   customMetrics: { api_calls: 5 }
// }
```

### TokenCounter

Estimate and count tokens:

```typescript
import { TokenCounter } from 'societyai';

const counter = new TokenCounter();

// Estimate tokens (approximately 4 characters per token)
const estimated = counter.estimate('Hello, how are you today?');
console.log(estimated); // ~7 tokens

// Count tokens in a string
const count = counter.count('This is a longer piece of text...');
console.log(count); // Token count

// Count tokens in messages
const messageCount = counter.countMessages([
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
]);
```

### PerformanceProfiler

Detailed performance profiling:

```typescript
import { PerformanceProfiler } from 'societyai';

const profiler = new PerformanceProfiler();

// Mark important points
profiler.mark('start-processing');
await processData();
profiler.mark('end-processing');

// Measure between marks
const duration = profiler.measure('processing-time', 'start-processing', 'end-processing');
console.log(`Processing took ${duration}ms`);

// Get all measurements
const measurements = profiler.getMeasurements();

// Clear profiler
profiler.clear();
```

## Cost Configurations

Pre-configured cost models for major AI providers:

```typescript
import { CommonCostConfigs } from 'societyai';

// Available configurations
const configs = {
  'gpt-4': CommonCostConfigs['gpt-4'],
  'gpt-4-turbo': CommonCostConfigs['gpt-4-turbo'],
  'gpt-3.5-turbo': CommonCostConfigs['gpt-3.5-turbo'],
  'claude-3-opus': CommonCostConfigs['claude-3-opus'],
  'claude-3-sonnet': CommonCostConfigs['claude-3-sonnet'],
  'claude-3-haiku': CommonCostConfigs['claude-3-haiku'],
};

// Each config has
interface CostConfig {
  model: string;
  inputCostPer1K: number; // Cost per 1000 input tokens
  outputCostPer1K: number; // Cost per 1000 output tokens
}

// GPT-4 example
// {
//   model: 'gpt-4',
//   inputCostPer1K: 0.03,
//   outputCostPer1K: 0.06
// }
```

## Complete Example

```typescript
import {
  MetricsBuilder,
  TokenCounter,
  PerformanceProfiler,
  CommonCostConfigs,
  StandardModelBase,
} from 'societyai';

// Create tracked model
class TrackedModel extends StandardModelBase {
  constructor(
    name: string,
    private tracker: MetricsTracker,
    private workflowId: string
  ) {
    super({ name }, async (prompt: unknown) => {
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

      // Estimate tokens
      const counter = new TokenCounter();
      const inputTokens = counter.estimate(promptStr);

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      const response = `Response to: ${promptStr}`;
      const outputTokens = counter.estimate(response);

      // Track tokens
      this.tracker.updateTokens(this.workflowId, {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        model: name,
      });

      return response;
    });
  }
}

// Setup tracking
const tracker = MetricsBuilder.create()
  .withTokenTracking()
  .withCostTracking(CommonCostConfigs['gpt-4'])
  .withCustomMetrics(['agent_count'])
  .build();

// Start workflow tracking
tracker.start('my-workflow');

// Execute agents
const model = new TrackedModel('gpt-4', tracker, 'my-workflow');
await model.process('Analyze this data');
await model.process('Generate report');

// Add custom metrics
tracker.addCustomMetric('my-workflow', 'agent_count', 2);

// End tracking
const snapshot = tracker.end('my-workflow');

// View results
console.log(`Duration: ${snapshot.execution.duration}ms`);
console.log(`Total tokens: ${snapshot.tokens?.totalTokens}`);
console.log(`Total cost: $${snapshot.costs?.totalCost?.toFixed(4)}`);
console.log(`Agents used: ${snapshot.customMetrics?.agent_count}`);
```

## Tracking Multiple Workflows

Track multiple workflows simultaneously:

```typescript
const tracker = MetricsBuilder.create()
  .withTokenTracking()
  .withCostTracking(CommonCostConfigs['gpt-4'])
  .build();

// Track multiple workflows
tracker.start('workflow-1');
tracker.start('workflow-2');
tracker.start('workflow-3');

// Update each independently
tracker.updateTokens('workflow-1', { inputTokens: 100, outputTokens: 50 });
tracker.updateTokens('workflow-2', { inputTokens: 200, outputTokens: 100 });

// End workflows
const result1 = tracker.end('workflow-1');
const result2 = tracker.end('workflow-2');
const result3 = tracker.fail('workflow-3', new Error('Failed'));

// View all
const all = tracker.getAll();
console.log(`Tracked ${all.length} workflows`);
```

## Aggregated Metrics

Combine metrics across multiple executions:

```typescript
// Run multiple workflows
for (let i = 0; i < 10; i++) {
  tracker.start(`workflow-${i}`);
  // ... execute workflow ...
  tracker.end(`workflow-${i}`, {
    tokens: { totalTokens: 100 + i * 10 },
  });
}

// Get aggregated metrics
const aggregated = tracker.aggregate();

console.log(aggregated);
// {
//   totalExecutions: 10,
//   successfulExecutions: 10,
//   failedExecutions: 0,
//   totalDuration: 12340,
//   averageDuration: 1234,
//   totalTokens: 1450,
//   averageTokens: 145,
//   totalCost: 0.087,
//   averageCost: 0.0087
// }
```

## History and Filtering

Track execution history:

```typescript
// Get all metrics
const allMetrics = tracker.getAll();

// Get metrics within date range
const recent = tracker.getHistory({
  startTime: Date.now() - 3600000, // Last hour
  endTime: Date.now(),
});

// Filter by success
const successful = tracker.getHistory({
  success: true,
});

// Filter by token range
const highUsage = tracker.getHistory({
  minTokens: 1000,
});

// Combine filters
const filtered = tracker.getHistory({
  startTime: Date.now() - 86400000, // Last 24 hours
  success: true,
  minTokens: 500,
  maxTokens: 2000,
});
```

## Export Formats

### JSON Export

```typescript
const jsonExport = tracker.exportJSON();

console.log(jsonExport);
// {
//   timestamp: '2024-01-15T10:30:00Z',
//   metrics: [
//     {
//       id: 'workflow-1',
//       execution: { ... },
//       tokens: { ... },
//       costs: { ... }
//     },
//     ...
//   ],
//   aggregated: { ... }
// }

// Save to file
import fs from 'fs';
fs.writeFileSync('metrics.json', JSON.stringify(jsonExport, null, 2));
```

### OpenTelemetry Export

Export traces in OpenTelemetry format:

```typescript
const otelTraces = tracker.exportOTel();

console.log(otelTraces);
// {
//   resourceSpans: [
//     {
//       resource: {
//         attributes: [
//           { key: 'service.name', value: { stringValue: 'societyai' } }
//         ]
//       },
//       scopeSpans: [
//         {
//           scope: { name: 'societyai-metrics' },
//           spans: [
//             {
//               traceId: '...',
//               spanId: '...',
//               name: 'workflow-1',
//               startTimeUnixNano: '...',
//               endTimeUnixNano: '...',
//               attributes: [...]
//             }
//           ]
//         }
//       ]
//     }
//   ]
// }

// Send to observability platform
await sendToJaeger(otelTraces);
await sendToDatadog(otelTraces);
```

## Cost Comparison

Compare costs across different models:

```typescript
const models = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
];

const tokenUsage = {
  inputTokens: 10000,
  outputTokens: 5000,
};

console.log('Cost comparison for 10K input + 5K output tokens:\n');

models.forEach((modelName) => {
  const config = CommonCostConfigs[modelName];
  const inputCost = (tokenUsage.inputTokens / 1000) * config.inputCostPer1K;
  const outputCost = (tokenUsage.outputTokens / 1000) * config.outputCostPer1K;
  const totalCost = inputCost + outputCost;

  console.log(`${modelName.padEnd(20)} $${totalCost.toFixed(4)}`);
});

// Output:
// gpt-4                $0.6000
// gpt-4-turbo          $0.2000
// gpt-3.5-turbo        $0.0100
// claude-3-opus        $0.2250
// claude-3-sonnet      $0.0450
// claude-3-haiku       $0.0038
```

## Custom Metrics

Track domain-specific metrics:

```typescript
const tracker = MetricsBuilder.create()
  .withTokenTracking()
  .withCustomMetrics(['api_calls', 'cache_hits', 'errors', 'retries', 'tool_calls'])
  .build();

tracker.start('workflow-1');

// Track custom metrics
tracker.addCustomMetric('workflow-1', 'api_calls', 5);
tracker.addCustomMetric('workflow-1', 'cache_hits', 3);
tracker.addCustomMetric('workflow-1', 'tool_calls', 2);

// Increment metrics
tracker.incrementCustomMetric('workflow-1', 'errors');
tracker.incrementCustomMetric('workflow-1', 'retries');

const snapshot = tracker.end('workflow-1');
console.log(snapshot.customMetrics);
// {
//   api_calls: 5,
//   cache_hits: 3,
//   errors: 1,
//   retries: 1,
//   tool_calls: 2
// }
```

## Real-Time Monitoring

Get snapshots during execution:

```typescript
tracker.start('long-workflow');

// During execution
const currentSnapshot = tracker.getSnapshot('long-workflow');

console.log(`Current duration: ${currentSnapshot.execution.duration}ms`);
console.log(`Tokens so far: ${currentSnapshot.tokens?.totalTokens}`);
console.log(`Cost so far: $${currentSnapshot.costs?.totalCost}`);

// Continue execution...
```

## Integration with Graph

Track graph execution:

```typescript
const tracker = MetricsBuilder.create()
  .withTokenTracking()
  .withCostTracking(CommonCostConfigs['gpt-4'])
  .build();

// Wrap graph execution
async function executeWithMetrics(
  graph: SocietyGraph,
  input: string,
  agents: AgentConfig[]
): Promise<GraphResult> {
  const workflowId = `graph-${Date.now()}`;

  tracker.start(workflowId);

  try {
    const result = await graph.execute(input, agents);

    // Track results
    tracker.end(workflowId, {
      tokens: {
        // Extract from result
        totalTokens: estimateTokens(result),
      },
      customMetrics: {
        node_count: result.executionPath.length,
      },
    });

    return result;
  } catch (error) {
    tracker.fail(workflowId, error as Error);
    throw error;
  }
}
```

## Best Practices

1. **Track All Workflows**: Start tracking at the beginning of every workflow
2. **Estimate Tokens**: Use TokenCounter for accurate cost estimation
3. **Custom Metrics**: Track domain-specific metrics relevant to your use case
4. **Export Regularly**: Export metrics to files or observability platforms
5. **Monitor Costs**: Set up alerts for unusual cost spikes
6. **Performance Profiling**: Use PerformanceProfiler for bottleneck identification
7. **History Retention**: Clear old metrics periodically to save memory
8. **Aggregate Data**: Use aggregation for trend analysis

## Performance Profiling Example

```typescript
const profiler = new PerformanceProfiler();
const tracker = MetricsBuilder.create().withTokenTracking().build();

tracker.start('workflow-1');
profiler.mark('start');

// Phase 1: Data loading
profiler.mark('loading-start');
await loadData();
profiler.mark('loading-end');
const loadTime = profiler.measure('loading', 'loading-start', 'loading-end');

// Phase 2: Processing
profiler.mark('processing-start');
await processData();
profiler.mark('processing-end');
const processTime = profiler.measure('processing', 'processing-start', 'processing-end');

// Phase 3: Generation
profiler.mark('generation-start');
await generateOutput();
profiler.mark('generation-end');
const genTime = profiler.measure('generation', 'generation-start', 'generation-end');

profiler.mark('end');
const totalTime = profiler.measure('total', 'start', 'end');

tracker.addCustomMetric('workflow-1', 'load_time', loadTime);
tracker.addCustomMetric('workflow-1', 'process_time', processTime);
tracker.addCustomMetric('workflow-1', 'gen_time', genTime);

const snapshot = tracker.end('workflow-1');

console.log('Performance breakdown:');
console.log(`Loading: ${loadTime}ms (${((loadTime / totalTime) * 100).toFixed(1)}%)`);
console.log(`Processing: ${processTime}ms (${((processTime / totalTime) * 100).toFixed(1)}%)`);
console.log(`Generation: ${genTime}ms (${((genTime / totalTime) * 100).toFixed(1)}%)`);
console.log(`Total: ${totalTime}ms`);
```

## Next Steps

- See [Graph Execution](./graph-execution.md) for workflow tracking
- See [Tool Calling](./tool-calling.md) for tool usage metrics
- See [Memory System](./memory-system.md) for context tracking
- See [Examples](./examples.md) for complete implementations
