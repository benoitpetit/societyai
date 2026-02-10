# OpenTelemetry Integration

SocietyAI includes built-in **OpenTelemetry** support for distributed
tracing, enabling production-grade observability.

## 🎯 Overview

OpenTelemetry provides:

- **Distributed Tracing**: Track execution across agents and tasks
- **Spans**: Measure duration of operations
- **Metrics**: Performance and usage data
- **Production Monitoring**: Integration with observability platforms

---

## 🚀 Quick Start

### Installation

OpenTelemetry is **optional**. Install the required packages:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
```

### Basic Usage

```typescript
import { Society, createOpenTelemetryObserver } from 'societyai';
import { OpenAIModel } from './my-model-impl';

// Create OpenTelemetry observer
const observer = createOpenTelemetryObserver({
  serviceName: 'my-app',
  exporterType: 'console', // or 'otlp'
});

const model = new OpenAIModel(process.env.OPENAI_API_KEY);

// Use observer in society
const result = await Society.create()
  .withId('traced-society')
  .withObserver(observer) // ← Enable tracing

  .addAgent((a) =>
    a
      .withId('writer')
      .withRole((r) => r.withSystemPrompt('You write content.'))
      .withModel(model)
  )

  .addTask((t) => t.withId('write').withAgents(['writer']))

  .execute('Write an article about TypeScript');

// Cleanup
await observer.shutdown();
```

---

## 🔧 Configuration

### Observer Options

```typescript
interface OpenTelemetryConfig {
  /** Service name for traces */
  serviceName: string;

  /** Exporter type */
  exporterType?: 'console' | 'otlp';

  /** OTLP endpoint (if using OTLP exporter) */
  otlpEndpoint?: string;

  /** Custom lifecycle hooks */
  onPhaseStart?: (phase: string) => void;
  onPhaseComplete?: (phase: string, duration: number) => void;
  onAgentStart?: (agentId: string, model: string) => void;
  onAgentComplete?: (
    agentId: string,
    model: string,
    output: string,
    duration: number
  ) => void;
}
```

### Console Exporter

For development and debugging:

```typescript
const observer = createOpenTelemetryObserver({
  serviceName: 'dev-app',
  exporterType: 'console',
});
```

**Output**: Traces printed to console

### OTLP Exporter

For production environments (Jaeger, Zipkin, etc.):

```typescript
const observer = createOpenTelemetryObserver({
  serviceName: 'production-app',
  exporterType: 'otlp',
  otlpEndpoint: 'http://localhost:4318', // Your collector endpoint
});
```

---

## 📊 Trace Structure

### Spans Created

OpenTelemetry observer automatically creates spans for:

| Span Name             | Description                      | Attributes                |
| --------------------- | -------------------------------- | ------------------------- |
| `society.execute`     | Full society execution           | society.id, society.name  |
| `phase.start`         | Execution phase started          | phase.name                |
| `phase.complete`      | Execution phase completed        | phase.name, duration      |
| `agent.execute`       | Agent execution                  | agent.id, model           |
| `task.execute`        | Task execution                   | task.id, agents           |

### Example Trace

```
society.execute [duration: 2500ms]
├─ phase.start [phase: initialization]
├─ agent.execute [agent: writer, model: gpt-4]
│  └─ task.execute [task: write]
├─ phase.complete [phase: execution, duration: 2400ms]
└─ society.complete
```

---

## 🛠️ Advanced Usage

### Custom Hooks

Add custom logic to trace events:

```typescript
const observer = createOpenTelemetryObserver({
  serviceName: 'my-app',
  exporterType: 'console',

  // Custom hooks
  onPhaseStart: (phase) => {
    console.log(`Phase starting: ${phase}`);
  },

  onPhaseComplete: (phase, duration) => {
    console.log(`Phase completed: ${phase} (${duration}ms)`);
  },

  onAgentStart: (agentId, model) => {
    console.log(`Agent ${agentId} started with ${model}`);
  },

  onAgentComplete: (agentId, model, output, duration) => {
    console.log(`Agent ${agentId} completed in ${duration}ms`);
  },
});
```

### Integration with Worker Threads

OpenTelemetry works seamlessly with Worker Threads:

```typescript
const observer = createOpenTelemetryObserver({
  serviceName: 'worker-app',
});

const society = Society.create()
  .withObserver(observer)

  // Standard agent - traced
  .addAgent((a) => a.withId('io-agent').withModel(model))

  // Isolated agent - also traced
  .addAgent((a) =>
    a
      .withId('cpu-agent')
      .withModel(model)
      .withExecutionMode('isolated') // ← Worker Thread + Tracing
  );
```

Both execution modes are traced correctly.

---

## 🔍 Graceful Degradation

If `@opentelemetry/api` is **not installed**, the observer:

1. Logs a warning
2. Continues to work as a basic observer
3. Doesn't create spans

**No crashes or errors** - your code continues to work.

```
Warning: OpenTelemetry not available. Install @opentelemetry/api to enable tracing:
npm install @opentelemetry/api @opentelemetry/sdk-node
```

---

## 📈 Production Setup

### Docker Compose Example

```yaml
version: '3.8'

services:
  # Your application
  app:
    build: .
    environment:
      - OTLP_ENDPOINT=http://jaeger:4318
    depends_on:
      - jaeger

  # Jaeger for trace visualization
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - '16686:16686' # UI
      - '4318:4318' # OTLP HTTP
```

### Application Code

```typescript
const observer = createOpenTelemetryObserver({
  serviceName: 'my-app',
  exporterType: 'otlp',
  otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318',
});
```

Access Jaeger UI: `http://localhost:16686`

---

## 🧪 Testing

OpenTelemetry integration is tested in:

- **Unit Tests**: `opentelemetry.test.ts`
- **Integration Tests**: `end-to-end-features.test.ts`

Run tests:

```bash
npm test opentelemetry.test.ts
```

---

## 📊 Monitoring Metrics

### Key Metrics to Track

1. **Execution Duration**: Total society execution time
2. **Agent Duration**: Per-agent execution time
3. **Task Duration**: Per-task execution time
4. **Error Rate**: Failed executions
5. **Worker Overhead**: Additional time for isolated execution

### Example Queries (Jaeger)

```
# Find slow agents
service=my-app AND span.kind=agent AND duration > 5s

# Trace errors
service=my-app AND error=true

# Worker thread traces
service=my-app AND executionMode=isolated
```

---

## 🔗 Integrations

### Supported Platforms

- **Jaeger**: Open-source tracing
- **Zipkin**: Distributed tracing
- **New Relic**: Full observability
- **Datadog**: APM and tracing
- **Grafana Tempo**: Trace backend
- **Any OTLP-compatible backend**

### Custom Exporters

Create custom exporters using OpenTelemetry SDK:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: 'https://custom-backend.com/v1/traces',
  headers: {
    Authorization: 'Bearer YOUR_TOKEN',
  },
});

// Use with SocietyAI observer...
```

---

## ⚠️ Performance Impact

### Overhead

OpenTelemetry adds minimal overhead:

- **Span creation**: ~0.1-1ms per span
- **Console export**: ~1-5ms per trace
- **OTLP export**: ~5-10ms per trace (network)

### Best Practices

1. **Use OTLP in production** (not console)
2. **Batch exports** for high-throughput systems
3. **Sample traces** if needed (1%, 10%, etc.)
4. **Monitor collector performance**

---

## 📚 Related Documentation

- [Observability](./observability.md): Event system basics
- [Worker Threads](./worker-threads.md): Tracing isolated execution
- [Execution Engine](../5-architecture/execution-engine.md): Execution flow

---

## ✅ Best Practices

1. **Always shutdown observers**: `await observer.shutdown()`
2. **Use meaningful service names**: 'my-app-production'
3. **Set up sampling** for high-traffic apps
4. **Monitor trace volume** to control costs
5. **Correlate with logs** using trace IDs

---

## 🔗 Next Steps

- Set up [Jaeger locally](https://www.jaegertracing.io/docs/getting-started/)
- Explore [Worker Threads](./worker-threads.md) with tracing
- Learn about [MCP Support](./mcp.md) for external tools
