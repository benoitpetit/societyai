# Middleware System

This guide explains how to use the SocietyAI middleware system to inject
context, intercept calls, and add cross-cutting behaviours to your agents.

---

## 📋 Table of Contents

- [Basic Concepts](#basic-concepts)
- [Middleware Types](#middleware-types)
- [Model Middleware](#model-middleware)
- [Step Middleware](#step-middleware)
- [Built-in Middlewares](#built-in-middlewares)
- [Middleware Composition](#middleware-composition)
- [Advanced Examples](#advanced-examples)
- [Usage with Society](#usage-with-society)
- [Best Practices](#best-practices)

## 🧅 Basic Concepts

Middlewares in SocietyAI follow the "onion" pattern: each middleware wraps the next one, allowing for pre-processing and post-processing.

```
Request → MW1 → MW2 → MW3 → Agent → MW3 → MW2 → MW1 → Response
```

The `Middleware` interface in SocietyAI is a **named object** with a `fn` property:

```typescript
import { Middleware, MiddlewareFn, MiddlewareContext, MiddlewareResult } from 'societyai';

// Option 1: raw MiddlewareFn (auto-wrapped by MiddlewareChain)
const myFn: MiddlewareFn = async (ctx, next) => {
  // ctx.input     — the raw input
  // ctx.metadata  — Map<string, unknown> shared across the chain
  // ctx.agentId   — agent executing the call (if available)
  const result = await next(ctx);
  return result;
};

// Option 2: named Middleware object
const myMiddleware: Middleware = {
  name: 'my-middleware',
  priority: 50,         // higher = runs earlier (optional)
  fn: myFn,
};
```

## 🗂️ Middleware Types

### 1. **Model-Level Middleware**
Intercepts calls to the AI model (before/after `model.process()`). Applied via `Society.create().addMiddleware(...)`.

### 2. **Step-Level Middleware**
Intercepts the complete execution of a workflow step. Uses `StepMiddleware` / `StepMiddlewareFn`.

## 🤖 Model Middleware

### Simple Example: Logger

```typescript
import { MiddlewareFn } from 'societyai';

const loggingFn: MiddlewareFn = async (ctx, next) => {
  console.log(`[${ctx.agentId ?? 'unknown'}] Sending prompt:`, ctx.input);
  const startTime = Date.now();

  try {
    const result = await next(ctx);
    const duration = Date.now() - startTime;
    console.log(`[${ctx.agentId ?? 'unknown'}] Response in ${duration}ms`);
    return result;
  } catch (error) {
    console.error(`[${ctx.agentId ?? 'unknown'}] Error:`, error);
    throw error;
  }
};
```

### User Context Injection

```typescript
import { MiddlewareFn } from 'societyai';

const userContextFn: MiddlewareFn = async (ctx, next) => {
  const userId = ctx.metadata.get('userId') as string;
  const userProfile = await getUserProfile(userId);

  // Inject context into the prompt
  ctx.processedInput = `
User Context:
- Name: ${userProfile.name}
- Role: ${userProfile.role}
- Preferences: ${JSON.stringify(userProfile.preferences)}

${ctx.input}
  `.trim();

  return await next(ctx);
};
```

### Rate Limiting

```typescript
import { Middlewares } from 'societyai';

const rateLimitMiddleware = Middlewares.rateLimit({
  maxRequests: 10,      // 10 requests max
  windowMs: 60 * 1000, // per 60-second window
  onLimitReached: () => console.warn('Rate limit reached'),
});
```

### Intelligent Caching

```typescript
import { Middlewares } from 'societyai';

const cachingMiddleware = Middlewares.cache({
  ttl: 3_600_000, // 1 hour in ms
  keyGenerator: (input) => JSON.stringify(input).slice(0, 100),
});
```

### Retry with Exponential Backoff

```typescript
import { Middlewares } from 'societyai';

const retryMiddleware = Middlewares.retry({
  maxAttempts: 3,       // maximum number of attempts
  delay: 1_000,         // initial delay in ms
  backoffFactor: 2,     // multiply delay by this factor each retry
  retryOn: (error) =>   // optional: filter which errors trigger a retry
    error.message.includes('rate_limit') || error.message.includes('timeout'),
});
```

### Content Filtering (custom middleware)

Because content filtering is domain-specific, SocietyAI does not ship a built-in
`contentFilter` middleware. Implement it as a custom `MiddlewareFn`:

```typescript
import { MiddlewareFn } from 'societyai';

const contentFilterFn: MiddlewareFn = async (ctx, next) => {
  const prompt = String(ctx.input);

  // Pre-filtering: block sensitive content
  if (containsSensitiveData(prompt)) {
    throw new Error('Prompt contains sensitive data');
  }

  const result = await next(ctx);

  // Post-filtering: remove PII from response
  return { ...result, output: removePII(result.output) };
};

function containsSensitiveData(text: string): boolean {
  const patterns = [
    /\d{3}-\d{2}-\d{4}/,                    // SSN
    /\d{16}/,                                // Credit card
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // Email
  ];
  return patterns.some((p) => p.test(text));
}
```

## 📋 Step Middleware

Step middlewares operate at the workflow level and use the `StepMiddleware` /
`StepMiddlewareFn` types:

### Audit Trail

```typescript
import { StepMiddlewareFn } from 'societyai';

const auditFn: StepMiddlewareFn = async (ctx, next) => {
  const startTime = Date.now();

  try {
    const result = await next(ctx);
    await saveAuditLog({
      taskId: ctx.taskId,
      agentId: ctx.agentId,
      startTime,
      duration: Date.now() - startTime,
      success: true,
      output: result.output,
    });
    return result;
  } catch (error) {
    await saveAuditLog({
      taskId: ctx.taskId,
      agentId: ctx.agentId,
      startTime,
      duration: Date.now() - startTime,
      success: false,
      error: (error as Error).message,
    });
    throw error;
  }
};
```

### Metrics and Monitoring

```typescript
import { StepMiddlewareFn } from 'societyai';

const metricsFn: StepMiddlewareFn = async (ctx, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  try {
    const result = await next(ctx);
    metrics.record({
      step: ctx.taskId,
      agent: ctx.agentId,
      duration: Date.now() - startTime,
      memoryDelta: process.memoryUsage().heapUsed - startMemory,
      success: true,
    });
    return result;
  } catch (error) {
    metrics.record({
      step: ctx.taskId,
      agent: ctx.agentId,
      duration: Date.now() - startTime,
      success: false,
      error: (error as Error).constructor.name,
    });
    throw error;
  }
};
```

## 📦 Built-in Middlewares

SocietyAI provides **13 ready-to-use middlewares** via the `Middlewares` object.

### Observability

#### 1. Logging

```typescript
import { Middlewares } from 'societyai';

const logging = Middlewares.logging({
  prefix: '[MyApp]',    // optional log prefix
  logInput: true,       // log the input prompt (default: true)
  logOutput: true,      // log the model response (default: true)
});
```

#### 2. Timing

```typescript
const timing = Middlewares.timing({
  onComplete: (durationMs) => console.log(`Completed in ${durationMs}ms`),
});
```

#### 3. Metrics

```typescript
import { Middlewares, InMemoryMetricsCollector } from 'societyai';

const collector = new InMemoryMetricsCollector();
const metricsMiddleware = Middlewares.metrics(collector);
```

### Resilience

#### 4. Timeout

```typescript
const timeout = Middlewares.timeout(30_000); // 30 s
```

#### 5. Retry

```typescript
const retry = Middlewares.retry({
  maxAttempts: 3,
  delay: 1_000,
  backoffFactor: 2,
});
```

#### 6. Cache

```typescript
const cache = Middlewares.cache({
  ttl: 3_600_000, // 1 hour
  keyGenerator: (input) => JSON.stringify(input).slice(0, 100),
});
```

#### 7. Rate Limit

```typescript
const rateLimit = Middlewares.rateLimit({
  maxRequests: 100,
  windowMs: 60_000,              // 1 minute
  onLimitReached: () => console.warn('Rate limit hit'),
});
```

#### 8. Circuit Breaker

```typescript
const circuitBreaker = Middlewares.circuitBreaker({
  threshold: 5,        // open after 5 consecutive failures
  timeout: 60_000,     // attempt half-open after 60 s
  onOpen: () => console.error('Circuit opened'),
  onClose: () => console.info('Circuit closed'),
  onHalfOpen: () => console.info('Circuit half-open'),
});
```

#### 9. Dedupe

```typescript
const dedupe = Middlewares.dedupe();
// Deduplicates concurrent identical requests — only one call is made
// and the result is shared between all callers.
```

#### 10. Fallback

```typescript
const fallback = Middlewares.fallback('Sorry, the service is temporarily unavailable.');

// Or with a dynamic fallback:
const fallback = Middlewares.fallback((error) => `Error: ${error.message}`);
```

### Transform

#### 11. Validation

```typescript
const validation = Middlewares.validation({
  validateInput: (input) => {
    if (!input) return 'Input cannot be empty';
    return true;
  },
  validateOutput: (output) => {
    if (output.length < 10) return 'Output too short';
    return true;
  },
});
```

#### 12. Transform Input

```typescript
const transformInput = Middlewares.transformInput((input) => {
  // Trim whitespace, add a prefix, etc.
  return `[Sanitized] ${String(input).trim()}`;
});
```

#### 13. Transform Output

```typescript
const transformOutput = Middlewares.transformOutput((output) => {
  return output.trim().replace(/\n{3,}/g, '\n\n');
});
```

## 🔗 Middleware Composition

### Using `MiddlewareChain.create()` (recommended)

```typescript
import { MiddlewareChain, Middlewares } from 'societyai';

const chain = MiddlewareChain.create()
  .use(Middlewares.logging())
  .use(Middlewares.timeout(30_000))
  .use(Middlewares.retry({ maxAttempts: 3 }))
  .use(Middlewares.cache({ ttl: 60_000 }))
  .use(Middlewares.circuitBreaker({ threshold: 5, timeout: 60_000 }));
```

You can also add a raw `MiddlewareFn` directly — it will be auto-wrapped:

```typescript
chain.use(async (ctx, next) => {
  ctx.metadata.set('traceId', crypto.randomUUID());
  return next(ctx);
});
```

### Priority ordering

Each `Middleware` object has an optional `priority` field (higher = runs first).
Call `.sortByPriority()` to reorder the chain before use:

```typescript
chain.sortByPriority();
```

### Wrapping a model directly

Use `MiddlewareWrappedModel` to apply middleware to a single model instance
rather than the whole society:

```typescript
import { MiddlewareWrappedModel, MiddlewareChain, Middlewares } from 'societyai';

const chain = MiddlewareChain.create()
  .use(Middlewares.logging())
  .use(Middlewares.retry({ maxAttempts: 3 }));

const wrappedModel = chain.wrap(originalModel);
// wrappedModel implements AIModel — pass it to any agent
```

### Conditional Composition

```typescript
import { MiddlewareFn } from 'societyai';

const conditionalFn: MiddlewareFn = async (ctx, next) => {
  if (process.env.NODE_ENV === 'production') {
    // Apply additional validation in production
    if (!ctx.input) throw new Error('Input required in production');
  }
  return next(ctx);
};
```

### Middleware Factory

```typescript
import { MiddlewareFn } from 'societyai';

function createAuthMiddleware(apiKey: string): MiddlewareFn {
  return async (ctx, next) => {
    ctx.metadata.set('apiKey', apiKey);
    try {
      return await next(ctx);
    } catch (error) {
      if ((error as Error).message.includes('401')) {
        throw new Error('Authentication failed. Check your API key.');
      }
      throw error;
    }
  };
}

const authFn = createAuthMiddleware(process.env.API_KEY!);
```

## 🔬 Advanced Examples

### Multi-Tenant Context

```typescript
import { MiddlewareFn } from 'societyai';

const multiTenantFn: MiddlewareFn = async (ctx, next) => {
  const tenantId = ctx.metadata.get('tenantId') as string;

  if (!tenantId) throw new Error('Tenant ID required');

  const tenantConfig = await getTenantConfig(tenantId);

  const tokensUsed = await getTokenUsage(tenantId);
  if (tokensUsed >= tenantConfig.tokenLimit) {
    throw new Error(`Tenant ${tenantId} has exceeded its token limit`);
  }

  ctx.processedInput = `
[Tenant: ${tenantConfig.name}]
[Industry: ${tenantConfig.industry}]
[Compliance: ${tenantConfig.complianceLevel}]

${ctx.input}
  `.trim();

  const result = await next(ctx);

  await recordTokenUsage(tenantId, estimateTokens(result.output));
  return result;
};
```

### A/B Testing

```typescript
import { MiddlewareFn } from 'societyai';

const abTestFn: MiddlewareFn = async (ctx, next) => {
  const userId = ctx.metadata.get('userId') as string;
  const variant = getABTestVariant(userId); // 'A' or 'B'

  ctx.metadata.set('variant', variant);

  if (variant === 'B') {
    ctx.processedInput = `${ctx.input}\n\nProvide detailed reasoning for your answer.`;
  }

  const startTime = Date.now();
  const result = await next(ctx);

  await recordABTestMetrics({
    userId,
    variant,
    duration: Date.now() - startTime,
    promptLength: String(ctx.input).length,
    responseLength: result.output.length,
  });

  return result;
};
```

### Circuit Breaker (custom class pattern)

The built-in `Middlewares.circuitBreaker()` covers most cases. If you need
instance-level state (e.g. per-agent), use a class:

```typescript
import { MiddlewareFn } from 'societyai';

class CircuitBreakerMiddleware {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;

  constructor(
    private threshold = 5,
    private timeoutMs = 60_000
  ) {}

  readonly fn: MiddlewareFn = async (ctx, next) => {
    if (this.isOpen) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.timeoutMs) {
        throw new Error('Circuit breaker is open. Service temporarily unavailable.');
      }
      this.isOpen = false;
      this.failures = 0;
    }

    try {
      const result = await next(ctx);
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.threshold) {
        this.isOpen = true;
        console.error(`Circuit breaker opened after ${this.failures} failures`);
      }
      throw error;
    }
  };
}

const cb = new CircuitBreakerMiddleware(5, 60_000);
// chain.use(cb.fn);
```

### Dynamic Prompt Enrichment

```typescript
import { MiddlewareFn } from 'societyai';

const enrichFn: MiddlewareFn = async (ctx, next) => {
  const now = new Date();
  const enrichments = [
    `Current Date: ${now.toISOString()}`,
    `Day: ${now.toLocaleDateString('en', { weekday: 'long' })}`,
  ];

  if (ctx.metadata.has('projectId')) {
    const info = await getProjectInfo(ctx.metadata.get('projectId'));
    enrichments.push(`Project: ${info.name}`, `Status: ${info.status}`);
  }

  ctx.processedInput = `
=== Context ===
${enrichments.join('\n')}

=== Task ===
${ctx.input}
  `.trim();

  return next(ctx);
};
```

## ⚡ Usage with Society

Middlewares are applied at the **Society level** via `addMiddleware()`. They run
for every agent in the society.

```typescript
import { Society, MiddlewareChain, Middlewares } from 'societyai';

// Build a reusable chain
const chain = MiddlewareChain.create()
  .use(Middlewares.logging())
  .use(Middlewares.timeout(30_000))
  .use(Middlewares.retry({ maxAttempts: 3 }))
  .use(Middlewares.cache({ ttl: 3_600_000 }))
  .use(Middlewares.rateLimit({ maxRequests: 100, windowMs: 60_000 }));

// Pass the chain (or a single Middleware) to addMiddleware()
const result = await Society.create()
  .addMiddleware(chain)   // ← accepts Middleware | MiddlewareChain
  .addAgent((a) =>
    a.withId('analyst').withModel(model).withRole(/* ... */)
  )
  .addTask((t) => t.withId('analyze').withAgents(['analyst']).sequential())
  .execute('Analyze this data...');
```

You can also pass a raw `MiddlewareFn` or individual `Middleware` object:

```typescript
Society.create()
  .addMiddleware(Middlewares.logging())          // single built-in
  .addMiddleware(async (ctx, next) => {          // raw fn — auto-wrapped
    ctx.metadata.set('start', Date.now());
    return next(ctx);
  })
  .addAgent(...)
  .execute('...');
```

> **Note:** There is no per-agent `.withMiddleware()` method on
> `FluentAgentBuilder`. If you need to apply middleware to a specific model
> only, wrap it with `MiddlewareWrappedModel` before passing it to `.withModel()`.

```typescript
import { MiddlewareWrappedModel, MiddlewareChain, Middlewares } from 'societyai';

const agentChain = MiddlewareChain.create()
  .use(Middlewares.retry({ maxAttempts: 5 }));

const wrappedModel = agentChain.wrap(myModel);

Society.create()
  .addAgent((a) => a.withId('resilient-agent').withModel(wrappedModel))
  .addTask(/* ... */)
  .execute('...');
```

## ✅ Best Practices

### 1. Middleware Order

Order matters — middlewares run in insertion order (modified by `priority`):

```
Logging → Timeout → Retry → Cache → Rate Limit → Business Logic
```

### 2. Error Handling

Transform errors consistently:

```typescript
import { MiddlewareFn } from 'societyai';

const errorFn: MiddlewareFn = async (ctx, next) => {
  try {
    return await next(ctx);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      throw new Error('Service unavailable. Please try again later.');
    }
    throw error;
  }
};
```

### 3. Performance

Avoid blocking operations in hot-path middlewares:

```typescript
// ❌ Bad: heavy synchronous/blocking work on every call
const badFn: MiddlewareFn = async (ctx, next) => {
  const data = await heavyDatabaseQuery(); // runs on every call
  return next(ctx);
};

// ✅ Good: cache the result, or compute lazily
let cachedData: unknown;
const goodFn: MiddlewareFn = async (ctx, next) => {
  cachedData ??= await heavyDatabaseQuery();
  ctx.metadata.set('data', cachedData);
  return next(ctx);
};
```

### 4. Using `metadata` to pass data between middlewares

```typescript
// Upstream middleware sets a value
ctx.metadata.set('startTime', Date.now());
ctx.metadata.set('userId', userId);
ctx.metadata.set('traceId', crypto.randomUUID());

// Downstream middleware reads it
const startTime = ctx.metadata.get('startTime') as number;
```

## 📝 Summary

Middlewares enable:
- ✅ Dynamic context and prompt injection
- ✅ Centralised logging and auditing
- ✅ Rate limiting and quotas
- ✅ Intelligent caching
- ✅ Automatic retry with backoff
- ✅ Metrics and monitoring
- ✅ A/B testing
- ✅ Multi-tenancy
- ✅ Circuit breaking and deduplication

---

## 📚 API Reference

### `Middleware`

Named middleware object:

```typescript
interface Middleware {
  name: string;
  description?: string;
  priority?: number; // higher = runs earlier
  fn: MiddlewareFn;
}
```

### `MiddlewareFn`

```typescript
type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: NextFunction
) => Promise<MiddlewareResult>;
```

### `MiddlewareContext`

```typescript
interface MiddlewareContext {
  input: unknown;           // original input
  processedInput: unknown;  // mutated input (set this to transform the prompt)
  metadata: Map<string, unknown>;
  startTime: number;
  agentId?: string;
  stepId?: string;
  signal?: AbortSignal;
}
```

### `MiddlewareChain`

```typescript
MiddlewareChain.create()
  .use(middleware | middlewareFn) // add a middleware
  .useAt(index, middleware)       // insert at position
  .useBefore(name, middleware)    // insert before named middleware
  .useAfter(name, middleware)     // insert after named middleware
  .remove(name)                   // remove by name
  .sortByPriority()               // reorder by priority field
  .wrap(model)                    // returns MiddlewareWrappedModel
  .build()                        // returns ComposedMiddleware
```
