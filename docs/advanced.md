# Advanced Features

Advanced features and best practices for SocietyAI.

## Table of Contents

- [Error Handling](#error-handling)
- [Retry Mechanism](#retry-mechanism)
- [Timeout & Cancellation](#timeout--cancellation)
- [Observability](#observability)
- [Performance Optimization](#performance-optimization)
- [Testing](#testing)
- [Production Deployment](#production-deployment)

## Error Handling

### Error Types

SocietyAI provides specific error types for different failure scenarios:

```typescript
import {
  SocietyError,
  ProcessingFailedError,
  TimeoutError,
  InvalidConfigurationError,
  OperationCancelledError,
} from '@societyai/core';

try {
  const result = await executor.execute(workflow, input);
} catch (error) {
  if (error instanceof ProcessingFailedError) {
    console.error('AI model processing failed:', error.message);
    // Retry with different model or parameters
  } else if (error instanceof TimeoutError) {
    console.error('Operation timed out');
    // Increase timeout or optimize workflow
  } else if (error instanceof InvalidConfigurationError) {
    console.error('Invalid workflow configuration:', error.message);
    // Fix configuration
  } else if (error instanceof OperationCancelledError) {
    console.log('Operation was cancelled by user');
    // Handle graceful shutdown
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Step-Level Error Handling

Each step result includes success/error information:

```typescript
const result = await executor.execute(workflow, input);

for (const [stepId, stepResults] of result.stepResults) {
  for (const stepResult of stepResults) {
    if (!stepResult.success) {
      console.error(
        `Agent ${stepResult.agentId} failed in step ${stepId}:`,
        stepResult.error?.message
      );
    }
  }
}
```

### Conditional Error Recovery

```typescript
const workflow = WorkflowConfigBuilder.create()
  .addSteps([
    // Main step
    StepBuilder.create()
      .withId('main')
      .withAgents(['main-agent'])
      .build(),
    
    // Error recovery step
    StepBuilder.create()
      .withId('recovery')
      .withAgents(['backup-agent'])
      .withExecutionType('conditional')
      .withCondition((results) => {
        const mainResults = results.get('main');
        return mainResults?.some(r => !r.success) ?? false;
      })
      .build(),
  ])
  .build();
```

### Lifecycle Hook Error Handling

```typescript
const workflow = WorkflowConfigBuilder.create()
  .onAfterStep(async (step, results, context) => {
    const failures = results.filter(r => !r.success);
    
    if (failures.length > 0) {
      console.error(`Step ${step.id} had ${failures.length} failures`);
      
      // Store error info in context
      context.metadata.errors = context.metadata.errors || [];
      context.metadata.errors.push({
        step: step.id,
        failures: failures.map(f => ({
          agent: f.agentId,
          error: f.error?.message,
        })),
      });
      
      // Optionally throw to stop workflow
      if (failures.length === results.length) {
        throw new Error(`All agents failed in step ${step.id}`);
      }
    }
  })
  .build();
```

## Retry Mechanism

### Built-in Retry

StandardModelBase includes automatic retry with exponential backoff:

```typescript
import { StandardModelBase, defaultRetryOptions } from '@societyai/core';

const model = new StandardModelBase(
  {
    name: 'MyModel',
    retryOptions: {
      maxRetries: 3,
      initialBackoff: 1000,    // 1 second
      maxBackoff: 10000,       // 10 seconds
      backoffFactor: 2,        // Double each retry
      jitter: true,           // Add randomness
    },
  },
  async (prompt) => {
    // Your API call
    return response;
  }
);
```

### Per-Agent Retry Configuration

```typescript
const agent = AgentBuilder.create()
  .withId('unreliable-agent')
  .withRole(role)
  .withModel(model)
  .withInitialContext({
    retryConfig: {
      maxRetries: 5,
      initialBackoff: 2000,
    },
  })
  .build();
```

### Custom Retry Logic

```typescript
import { withRetry } from '@societyai/core';

const result = await withRetry(
  async () => {
    return await someUnreliableOperation();
  },
  {
    maxRetries: 3,
    initialBackoff: 1000,
    maxBackoff: 5000,
    backoffFactor: 2,
    jitter: true,
  },
  signal // Optional AbortSignal
);
```

## Timeout & Cancellation

### Model-Level Timeout

```typescript
const model = new StandardModelBase(
  {
    name: 'MyModel',
    timeout: 30000, // 30 seconds
  },
  async (prompt) => {
    return await apiCall(prompt);
  }
);
```

### Workflow-Level Cancellation

```typescript
const controller = new AbortController();

// Set a timeout
const timeoutId = setTimeout(() => {
  controller.abort();
}, 60000); // 60 seconds

try {
  const result = await executor.execute(
    workflow,
    input,
    controller.signal
  );
  clearTimeout(timeoutId);
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    console.log('Operation cancelled');
  } else {
    throw error;
  }
}
```

### User-Triggered Cancellation

```typescript
const controller = new AbortController();

// Start long-running operation
const promise = executor.execute(workflow, input, controller.signal);

// User clicks cancel button
cancelButton.addEventListener('click', () => {
  controller.abort();
  console.log('Cancelling workflow...');
});

try {
  const result = await promise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('User cancelled the operation');
  }
}
```

## Observability

### Complete Observer Implementation

```typescript
import { SocietyObserver } from '@societyai/core';

class MetricsObserver implements SocietyObserver {
  private startTime: number = 0;
  private agentTimes: Map<number, number> = new Map();
  
  onSocietyStart(prompt: string, agentCount: number): void {
    this.startTime = Date.now();
    console.log(`[SOCIETY] Starting with ${agentCount} agents`);
    console.log(`[SOCIETY] Prompt: ${prompt.substring(0, 100)}...`);
  }
  
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    this.agentTimes.set(agentId, Date.now());
    console.log(`[AGENT ${agentId}] Started using ${modelName}`);
  }
  
  onAgentComplete(agentId: number, modelName: string, result: string): void {
    const duration = Date.now() - (this.agentTimes.get(agentId) || 0);
    console.log(`[AGENT ${agentId}] Completed in ${duration}ms`);
    console.log(`[AGENT ${agentId}] Result length: ${result.length} chars`);
  }
  
  onAgentError(agentId: number, modelName: string, error: Error): void {
    const duration = Date.now() - (this.agentTimes.get(agentId) || 0);
    console.error(`[AGENT ${agentId}] Failed after ${duration}ms: ${error.message}`);
  }
  
  onPhaseStart(phase: string): void {
    console.log(`[PHASE] Starting: ${phase}`);
  }
  
  onPhaseComplete(phase: string): void {
    console.log(`[PHASE] Completed: ${phase}`);
  }
  
  onSocietyComplete(finalResult: string): void {
    const totalDuration = Date.now() - this.startTime;
    console.log(`[SOCIETY] Completed in ${totalDuration}ms`);
    console.log(`[SOCIETY] Final result length: ${finalResult.length} chars`);
  }
}

const observer = new MetricsObserver();
const executor = new DefaultWorkflowExecutor(observer);
```

### Logging Configuration

```typescript
import { setGlobalLogLevel, LogLevel } from '@societyai/core';

// Development
setGlobalLogLevel(LogLevel.DEBUG);

// Production
setGlobalLogLevel(LogLevel.ERROR);

// Silent
setGlobalLogLevel(LogLevel.SILENT);
```

### Custom Logger

```typescript
import { Logger, LogLevel } from '@societyai/core';

class CustomLogger implements Logger {
  private level: LogLevel = LogLevel.INFO;
  
  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      // Send to external logging service
      logService.debug(message, ...args);
    }
  }
  
  info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      logService.info(message, ...args);
    }
  }
  
  error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      logService.error(message, ...args);
      // Alert on errors
      alerting.sendAlert(message);
    }
  }
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
```

## Performance Optimization

### 1. Use Parallel Execution

```typescript
// Slow: Sequential
const slowStep = StepBuilder.create()
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('sequential')
  .build();
// Total time: 3 * agent_time

// Fast: Parallel
const fastStep = StepBuilder.create()
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('parallel')
  .build();
// Total time: max(agent_times)
```

### 2. Cache Expensive Results

```typescript
const workflow = WorkflowConfigBuilder.create()
  .onAfterStep(async (step, results, context) => {
    if (step.id === 'expensive-analysis') {
      // Cache the result
      context.sharedData.set('cached-analysis', results[0].content);
    }
  })
  .addSteps([
    expensiveAnalysisStep,
    
    StepBuilder.create()
      .withId('use-cached')
      .withExecutionType('conditional')
      .withCondition((results) => {
        // Skip if we have cached data
        return !context.sharedData.has('cached-analysis');
      })
      .build(),
  ])
  .build();
```

### 3. Optimize Collaborative Iterations

```typescript
// Limit iterations
const step = StepBuilder.create()
  .withExecutionType('collaborative')
  .withMaxIterations(3) // Not too high
  .withCompletionCondition((results, iteration) => {
    // Exit early when done
    return checkConsensus(results) || iteration >= 2;
  })
  .build();
```

### 4. Worker Pool Sizing

The worker pool automatically sizes based on the number of agents, but you can optimize by:

- Grouping agents with similar workloads
- Balancing parallel steps
- Considering API rate limits

### 5. Result Streaming

For large outputs, use result transformers to reduce data size:

```typescript
const step = StepBuilder.create()
  .withResultTransformer((results) => {
    // Only keep essential data
    return results.map(r => ({
      agentId: r.agentId,
      summary: r.content.substring(0, 500),
      keywords: extractKeywords(r.content),
    }));
  })
  .build();
```

## Testing

### Unit Testing Workflows

```typescript
import { describe, it, expect } from 'jest';
import {
  WorkflowConfigBuilder,
  StepBuilder,
  AgentBuilder,
  RoleBuilder,
  StandardModelBase,
  DefaultWorkflowExecutor,
} from '@societyai/core';

// Mock model for testing
class MockModel extends StandardModelBase {
  constructor(name: string, mockResponse: string) {
    super({ name }, async () => mockResponse);
  }
}

describe('MyWorkflow', () => {
  it('should complete successfully', async () => {
    const model = new MockModel('test', 'Mock response');
    
    const role = RoleBuilder.create()
      .withId('test-role')
      .withSystemPrompt('Test prompt')
      .build();
    
    const agent = AgentBuilder.create()
      .withId('test-agent')
      .withRole(role)
      .withModel(model)
      .build();
    
    const workflow = WorkflowConfigBuilder.create()
      .withId('test-workflow')
      .addAgent(agent)
      .addStep(
        StepBuilder.create()
          .withId('test-step')
          .withAgents(['test-agent'])
          .build()
      )
      .build();
    
    const executor = new DefaultWorkflowExecutor();
    const result = await executor.execute(workflow, 'test input');
    
    expect(result.success).toBe(true);
    expect(result.output).toContain('Mock response');
  });
  
  it('should handle errors gracefully', async () => {
    const errorModel = new StandardModelBase(
      { name: 'error-model' },
      async () => {
        throw new Error('Test error');
      }
    );
    
    // Test error handling...
  });
});
```

### Integration Testing

```typescript
describe('Integration Tests', () => {
  it('should work with real API', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('Skipping integration test (no API key)');
      return;
    }
    
    const model = new OpenAIModel(apiKey);
    // Test with real model...
  });
});
```

## Production Deployment

### Environment Configuration

```typescript
// config.ts
export const config = {
  ai: {
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
  },
  logging: {
    level: process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
  },
  workflow: {
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '5'),
  },
};
```

### Monitoring

```typescript
class ProductionObserver implements SocietyObserver {
  onSocietyStart(prompt: string, agentCount: number): void {
    metrics.increment('workflow.started');
    metrics.gauge('workflow.agent_count', agentCount);
  }
  
  onAgentComplete(agentId: number, modelName: string, result: string): void {
    metrics.increment('agent.completed');
    metrics.histogram('agent.result_length', result.length);
  }
  
  onAgentError(agentId: number, modelName: string, error: Error): void {
    metrics.increment('agent.error');
    errorTracking.captureException(error);
  }
  
  onSocietyComplete(finalResult: string): void {
    metrics.increment('workflow.completed');
  }
}
```

### Rate Limiting

```typescript
class RateLimitedModel extends StandardModelBase {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private maxConcurrent = 5;
  
  constructor(baseModel: AIModel) {
    super({ name: baseModel.name() }, async (prompt, signal) => {
      await this.acquireSlot();
      try {
        return await baseModel.process(prompt, signal);
      } finally {
        this.releaseSlot();
      }
    });
  }
  
  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return;
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  private releaseSlot(): void {
    this.activeRequests--;
    const next = this.queue.shift();
    if (next) {
      this.activeRequests++;
      next();
    }
  }
}
```

### Graceful Shutdown

```typescript
const controller = new AbortController();

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  controller.abort();
});

try {
  await executor.execute(workflow, input, controller.signal);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Workflow cancelled during shutdown');
  }
}
```

---

**Next**: [Migration Guide](./migration.md) →

**Previous**: [API Reference](./api-reference.md) ←