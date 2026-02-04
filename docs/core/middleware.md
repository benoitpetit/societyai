# Guide: Context Injection with Middleware

This guide explains how to use the SocietyAI middleware system to inject context, intercept calls, and add cross-cutting behaviors to your agents.

## 📋 Table of Contents

- [Basic Concepts](#basic-concepts)
- [Middleware Types](#middleware-types)
- [Model Middleware](#model-middleware)
- [Step Middleware](#step-middleware)
- [Built-in Middlewares](#built-in-middlewares)
- [Middleware Composition](#middleware-composition)
- [Advanced Examples](#advanced-examples)

## Basic Concepts

Middlewares in SocietyAI follow the "onion" pattern: each middleware wraps the next one, allowing for pre-processing and post-processing.

```
Request → MW1 → MW2 → MW3 → Agent → MW3 → MW2 → MW1 → Response
```

## Middleware Types

### 1. **Model-Level Middleware**
Intercepts calls to the AI model (before/after `model.process()`).

### 2. **Step-Level Middleware**  
Intercepts the complete execution of a workflow step.

## Model Middleware

### Simple Example: Logger

```typescript
import { Middleware, MiddlewareContext } from 'societyai';

const loggingMiddleware: Middleware = async (prompt, next, context) => {
  console.log(`[${context.agentId}] Sending prompt:`, prompt);
  const startTime = Date.now();
  
  try {
    const result = await next(prompt);
    const duration = Date.now() - startTime;
    console.log(`[${context.agentId}] Received response in ${duration}ms`);
    return result;
  } catch (error) {
    console.error(`[${context.agentId}] Error:`, error);
    throw error;
  }
};
```

### User Context Injection

```typescript
const userContextMiddleware: Middleware = async (prompt, next, context) => {
  // Retrieve user context from session
  const userId = context.metadata.get('userId') as string;
  const userProfile = await getUserProfile(userId);
  
  // Inject context into the prompt
  const enhancedPrompt = `
User Context:
- Name: ${userProfile.name}
- Role: ${userProfile.role}
- Preferences: ${JSON.stringify(userProfile.preferences)}

${prompt}
  `;
  
  return await next(enhancedPrompt);
};
```

### Rate Limiting

```typescript
import { Middlewares } from 'societyai';

const rateLimitMiddleware = Middlewares.rateLimit({
  maxRequests: 10,      // 10 requests max
  windowMs: 60 * 1000,  // per 60 seconds window
  keyGenerator: (context) => context.agentId  // Per agent
});

// Usage
const wrappedModel = new MiddlewareWrappedModel(
  originalModel,
  [rateLimitMiddleware]
);
```

### Intelligent Caching

```typescript
const cachingMiddleware: Middleware = async (prompt, next, context) => {
  // Generate cache key
  const cacheKey = `${context.agentId}:${hashPrompt(prompt)}`;
  
  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    console.log('Cache hit!');
    context.metadata.set('cacheHit', true);
    return cached;
  }
  
  // Call model
  const result = await next(prompt);
  
  // Store in cache (TTL: 1 hour)
  await cache.set(cacheKey, result, { ttl: 3600 });
  context.metadata.set('cacheHit', false);
  
  return result;
};
```

### Retry with Exponential Backoff

```typescript
import { Middlewares } from 'societyai';

const retryMiddleware = Middlewares.retry({
  maxRetries: 3,
  initialDelay: 1000,     // 1 second
  maxDelay: 10000,        // 10 seconds max
  backoffMultiplier: 2,   // Double delay
  retryableErrors: ['RateLimitError', 'TimeoutError']
});
```

### Content Filtering

```typescript
const contentFilterMiddleware: Middleware = async (prompt, next, context) => {
  // Pre-filtering: block sensitive content
  if (containsSensitiveData(prompt)) {
    throw new Error('Prompt contains sensitive data');
  }
  
  const result = await next(prompt);
  
  // Post-filtering: clean response
  const filtered = removePII(result);
  context.metadata.set('contentFiltered', filtered !== result);
  
  return filtered;
};

function containsSensitiveData(text: string): boolean {
  const patterns = [
    /d{3}-d{2}-d{4}/,  // SSN
    /d{16}/,             // Credit card
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,}/i  // Email
  ];
  return patterns.some(pattern => pattern.test(text));
}
```

## Step Middleware

Step middlewares operate at the workflow level:

### Audit Trail

```typescript
import { StepMiddleware, StepMiddlewareContext } from 'societyai';

const auditMiddleware: StepMiddleware = async (step, next, context) => {
  const auditLog = {
    taskId: context.taskId,
    agentId: context.agentId,
    startTime: Date.now(),
    input: context.input
  };
  
  try {
    const result = await next(step);
    auditLog.success = true;
    auditLog.output = result.output;
    auditLog.duration = Date.now() - auditLog.startTime;
    
    await saveAuditLog(auditLog);
    return result;
  } catch (error) {
    auditLog.success = false;
    auditLog.error = error.message;
    auditLog.duration = Date.now() - auditLog.startTime;
    
    await saveAuditLog(auditLog);
    throw error;
  }
};
```

### Metrics and Monitoring

```typescript
const metricsMiddleware: StepMiddleware = async (step, next, context) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    const result = await next(step);
    
    // Record metrics
    metrics.record({
      step: context.taskId,
      agent: context.agentId,
      duration: Date.now() - startTime,
      memoryDelta: process.memoryUsage().heapUsed - startMemory,
      success: true
    });
    
    return result;
  } catch (error) {
    metrics.record({
      step: context.taskId,
      agent: context.agentId,
      duration: Date.now() - startTime,
      success: false,
      error: error.constructor.name
    });
    throw error;
  }
};
```

## Built-in Middlewares

SocietyAI provides ready-to-use middlewares:

### 1. Rate Limiting

```typescript
import { Middlewares } from 'societyai';

const rateLimit = Middlewares.rateLimit({
  maxRequests: 100,
  windowMs: 60000,  // 1 minute
  keyGenerator: (context) => context.agentId
});
```

### 2. Caching

```typescript
const cache = Middlewares.cache({
  ttl: 3600000,  // 1 hour
  maxSize: 1000,
  keyGenerator: (prompt, context) => `${context.agentId}:${prompt.slice(0, 100)}`
});
```

### 3. Retry

```typescript
const retry = Middlewares.retry({
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
});
```

### 4. Logging

```typescript
const logging = Middlewares.logging({
  level: 'debug',
  includePrompt: true,
  includeResponse: true
});
```

### 5. Content Filtering

```typescript
const contentFilter = Middlewares.contentFilter({
  blockPatterns: [/sensitive-keyword/i],
  sanitize: true
});
```

### 6. Token Counting

```typescript
const tokenCounter = Middlewares.tokenCounter({
  estimator: (text) => Math.ceil(text.length / 4),
  onCount: (tokens, context) => {
    console.log(`Agent ${context.agentId} used ${tokens} tokens`);
  }
});
```

## Middleware Composition

### Simple Chaining

```typescript
import { MiddlewareChain } from 'societyai';

const chain = new MiddlewareChain([
  loggingMiddleware,
  rateLimitMiddleware,
  cachingMiddleware,
  retryMiddleware
]);

const wrappedModel = new MiddlewareWrappedModel(originalModel, chain);
```

### Conditional Composition

```typescript
const conditionalMiddleware: Middleware = async (prompt, next, context) => {
  // Apply rate limit only in production
  if (process.env.NODE_ENV === 'production') {
    return await rateLimitMiddleware(prompt, next, context);
  }
  return await next(prompt);
};
```

### Middleware Factory

```typescript
function createAuthMiddleware(apiKey: string): Middleware {
  return async (prompt, next, context) => {
    // Inject authentication
    context.metadata.set('apiKey', apiKey);
    
    try {
      return await next(prompt);
    } catch (error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed. Check your API key.');
      }
      throw error;
    }
  };
}

const authMiddleware = createAuthMiddleware(process.env.API_KEY);
```

## Advanced Examples

### Multi-Tenant Context

```typescript
const multiTenantMiddleware: Middleware = async (prompt, next, context) => {
  const tenantId = context.metadata.get('tenantId') as string;
  
  if (!tenantId) {
    throw new Error('Tenant ID required');
  }
  
  // Load tenant config
  const tenantConfig = await getTenantConfig(tenantId);
  
  // Apply tenant limits
  const tokensUsed = await getTokenUsage(tenantId);
  if (tokensUsed >= tenantConfig.tokenLimit) {
    throw new Error(`Tenant ${tenantId} has exceeded token limit`);
  }
  
  // Inject tenant context
  const enhancedPrompt = `
[Tenant: ${tenantConfig.name}]
[Industry: ${tenantConfig.industry}]
[Compliance: ${tenantConfig.complianceLevel}]

${prompt}
  `;
  
  const result = await next(enhancedPrompt);
  
  // Record usage
  await recordTokenUsage(tenantId, estimateTokens(result));
  
  return result;
};
```

### A/B Testing

```typescript
const abTestMiddleware: Middleware = async (prompt, next, context) => {
  const userId = context.metadata.get('userId') as string;
  const variant = getABTestVariant(userId);  // 'A' or 'B'
  
  context.metadata.set('variant', variant);
  
  let enhancedPrompt = prompt;
  if (variant === 'B') {
    // Variant B: improved prompt
    enhancedPrompt = `${prompt}\n\nProvide detailed reasoning for your answer.`;
  }
  
  const startTime = Date.now();
  const result = await next(enhancedPrompt);
  const duration = Date.now() - startTime;
  
  // Record metrics for analysis
  await recordABTestMetrics({
    userId,
    variant,
    duration,
    promptLength: prompt.length,
    responseLength: result.length
  });
  
  return result;
};
```

### Circuit Breaker

```typescript
class CircuitBreakerMiddleware {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  
  constructor(
    private threshold = 5,       // Failures before opening
    private timeoutMs = 60000    // Time before retry
  ) {}
  
  middleware: Middleware = async (prompt, next, context) => {
    // Check if circuit is open
    if (this.isOpen) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.timeoutMs) {
        throw new Error('Circuit breaker is open. Service temporarily unavailable.');
      }
      // Attempt to close circuit
      this.isOpen = false;
      this.failures = 0;
    }
    
    try {
      const result = await next(prompt);
      // Success: reset counter
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

const circuitBreaker = new CircuitBreakerMiddleware(5, 60000);
```

### Dynamic Prompt Enrichment

```typescript
const dynamicEnrichmentMiddleware: Middleware = async (prompt, next, context) => {
  const enrichments: string[] = [];
  
  // Add temporal context
  const now = new Date();
  enrichments.push(`Current Date: ${now.toISOString()}`);
  enrichments.push(`Day of Week: ${now.toLocaleDateString('en', { weekday: 'long' })}`);
  
  // Add business context
  if (context.metadata.has('projectId')) {
    const projectId = context.metadata.get('projectId');
    const projectInfo = await getProjectInfo(projectId);
    enrichments.push(`Project: ${projectInfo.name}`);
    enrichments.push(`Status: ${projectInfo.status}`);
  }
  
  // Add real-time data
  const systemLoad = await getSystemLoad();
  enrichments.push(`System Load: ${systemLoad}%`);
  
  const enrichedPrompt = `
=== Context ===
${enrichments.join('\n')}

=== Task ===
${prompt}
  `;
  
  return await next(enrichedPrompt);
};
```

## Usage with Society

Apply middlewares to your agents:

```typescript
import { Society, MiddlewareChain, Middlewares } from 'societyai';

// Create a middleware chain
const middlewares = new MiddlewareChain([
  Middlewares.logging({ level: 'info' }),
  Middlewares.rateLimit({ maxRequests: 100, windowMs: 60000 }),
  Middlewares.cache({ ttl: 3600000 }),
  userContextMiddleware,
  auditMiddleware
]);

const society = Society.create()
  .addAgent(agent => agent
    .withId('analyst')
    .withModel(model)
    .withMiddleware(middlewares)  // Apply middlewares
  )
  .execute('Analyze this data...');
```

## Best Practices

### 1. **Middleware Order**
Order matters! Generally:
```
Logging → Auth → Rate Limit → Cache → Retry → Business Logic
```

### 2. **Error Handling**
Capture and transform errors consistently:

```typescript
const errorMiddleware: Middleware = async (prompt, next, context) => {
  try {
    return await next(prompt);
  } catch (error) {
    // Transform error
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Service unavailable. Please try again later.');
    }
    throw error;
  }
};
```

### 3. **Performance**
Avoid heavy operations in critical middlewares:

```typescript
// ❌ Bad: Blocking synchronous call
const badMiddleware: Middleware = async (prompt, next, context) => {
  const data = await heavyDatabaseQuery();  // Blocks everything
  return await next(prompt);
};

// ✅ Good: Cache or async
const goodMiddleware: Middleware = async (prompt, next, context) => {
  const cachedData = cache.get('key') || await heavyDatabaseQuery();
  context.metadata.set('data', cachedData);
  return await next(prompt);
};
```

### 4. **Metadata**
Use context to pass data:

```typescript
context.metadata.set('startTime', Date.now());
context.metadata.set('userId', userId);
context.metadata.set('traceId', generateTraceId());
```

## Summary

Middlewares enable:
- ✅ Dynamic context injection.
- ✅ Centralized logging and auditing.
- ✅ Rate limiting and quotas.
- ✅ Intelligent caching.
- ✅ Automatic retry.
- ✅ Metrics and monitoring.
- ✅ A/B testing.
- ✅ Multi-tenancy.

For more examples, see [core/middleware.md](./middleware.md).


# API Reference

## `Middleware`

Interface for model-level middlewares.

```typescript
type Middleware = (
  prompt: unknown,
  next: NextFunction,
  context: MiddlewareContext
) => Promise<string>;
```

## `MiddlewareChain`

Chain of middlewares.

```typescript
const chain = new MiddlewareChain()
  .use(loggingMiddleware)
  .use(cachingMiddleware)
  .use(rateLimitMiddleware);

const model = chain.wrap(baseModel);
```

