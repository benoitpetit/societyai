# Middleware System

Le système de middleware de SocietyAI permet d'ajouter des préoccupations transversales (logging, caching, retry, validation) sans modifier la logique de traitement principale.

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Middleware Chain](#middleware-chain)
- [Built-in Middlewares](#built-in-middlewares)
- [Custom Middlewares](#custom-middlewares)
- [Step Middlewares](#step-middlewares)
- [Middleware Composition](#middleware-composition)
- [Exemples Complets](#exemples-complets)

## Vue d'ensemble

Le système de middleware permet de:

- **Intercepter** les requêtes et réponses
- **Transformer** les entrées/sorties
- **Ajouter** du logging, caching, validation
- **Gérer** les erreurs et retries
- **Monitorer** les performances
- **Composer** des middlewares en chaîne

### Principes de Design

- **Composable**: Les middlewares peuvent être chaînés
- **Model-agnostic**: Fonctionne avec n'importe quel modèle AI
- **Non-intrusif**: Ne modifie pas la logique de traitement
- **Zero runtime deps**: Implémentation pure TypeScript

## Middleware Chain

### Création de Base

```typescript
import { MiddlewareChain, Middlewares } from 'societyai';

const chain = MiddlewareChain.create()
  .use(Middlewares.logging())
  .use(Middlewares.timing())
  .use(Middlewares.retry({ maxAttempts: 3 }))
  .build();

// Wrapper un modèle
const wrappedModel = chain.wrap(baseModel);

// Utiliser le modèle wrappé
const result = await wrappedModel.process(prompt);
```

### Configuration

```typescript
const chain = MiddlewareChain.create()
  // Ordre d'exécution (priorités)
  .use(Middlewares.logging({ priority: 100 }))
  .use(Middlewares.caching({ priority: 90 }))
  .use(Middlewares.timing({ priority: 80 }))

  // Trier par priorité
  .sortByPriority()

  .build();
```

### Insertion Contrôlée

```typescript
const chain = MiddlewareChain.create()
  .use(Middlewares.logging())
  .use(Middlewares.timing())

  // Insérer avant un middleware spécifique
  .useBefore('timing', Middlewares.validation())

  // Insérer après
  .useAfter('logging', Middlewares.metrics())

  // Insérer à une position
  .useAt(1, Middlewares.caching())

  // Retirer un middleware
  .remove('timing')

  .build();
```

## Built-in Middlewares

### Logging Middleware

```typescript
import { Middlewares } from 'societyai';

const loggingMiddleware = Middlewares.logging({
  logInput: true,
  logOutput: true,
  logDuration: true,
  logMetadata: true,
  formatter: (ctx, result) => {
    return `[${ctx.agentId}] ${ctx.input} -> ${result.output} (${Date.now() - ctx.startTime}ms)`;
  },
});
```

### Timing Middleware

```typescript
const timingMiddleware = Middlewares.timing({
  onComplete: (ctx, duration) => {
    console.log(`Execution took ${duration}ms`);
    metrics.recordDuration(ctx.agentId, duration);
  },
});
```

### Caching Middleware

```typescript
const cachingMiddleware = Middlewares.cache({
  ttl: 60000, // 1 minute
  maxSize: 100,
  keyGenerator: (ctx) => {
    // Générer une clé de cache
    return `${ctx.agentId}:${JSON.stringify(ctx.input)}`;
  },
  shouldCache: (ctx, result) => {
    // Décider si on cache
    return result.output.length > 0 && !result.metadata?.error;
  },
  onHit: (key) => {
    console.log(`Cache hit: ${key}`);
  },
  onMiss: (key) => {
    console.log(`Cache miss: ${key}`);
  },
});
```

### Retry Middleware

```typescript
const retryMiddleware = Middlewares.retry({
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryIf: (error) => {
    // Retry seulement pour certaines erreurs
    return error.message.includes('timeout') || error.message.includes('rate limit');
  },
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}: ${error.message}`);
  },
});
```

### Rate Limiting Middleware

```typescript
const rateLimitMiddleware = Middlewares.rateLimit({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  keyGenerator: (ctx) => ctx.agentId || 'default',
  onLimitReached: (ctx) => {
    throw new Error('Rate limit exceeded');
  },
});
```

### Validation Middleware

```typescript
const validationMiddleware = Middlewares.validation({
  validateInput: (input) => {
    if (typeof input !== 'string' || input.length === 0) {
      throw new Error('Input must be a non-empty string');
    }
  },
  validateOutput: (output) => {
    if (output.length < 10) {
      throw new Error('Output too short');
    }
  },
});
```

### Circuit Breaker Middleware

```typescript
const circuitBreakerMiddleware = Middlewares.circuitBreaker({
  failureThreshold: 5,
  timeout: 10000,
  resetTimeout: 60000,
  onOpen: (ctx) => {
    console.error(`Circuit opened for ${ctx.agentId}`);
    alertOps('Circuit breaker opened');
  },
  onClose: (ctx) => {
    console.log(`Circuit closed for ${ctx.agentId}`);
  },
  onHalfOpen: (ctx) => {
    console.log(`Circuit half-open for ${ctx.agentId}`);
  },
});
```

### Timeout Middleware

```typescript
const timeoutMiddleware = Middlewares.timeout({
  duration: 30000, // 30 secondes
  onTimeout: (ctx) => {
    console.error(`Timeout for ${ctx.agentId} after 30s`);
  },
});
```

### Metrics Middleware

```typescript
const metricsMiddleware = Middlewares.metrics({
  collector: metricsCollector,
  recordInput: true,
  recordOutput: true,
  recordDuration: true,
  recordErrors: true,
  customMetrics: (ctx, result) => ({
    inputLength: String(ctx.input).length,
    outputLength: result.output.length,
    model: ctx.metadata.get('modelName'),
  }),
});
```

### Transform Middleware

```typescript
const transformMiddleware = Middlewares.transform({
  transformInput: (input, ctx) => {
    // Enrichir l'input
    return `[Context: ${ctx.agentId}] ${input}`;
  },
  transformOutput: (output, ctx) => {
    // Nettoyer l'output
    return output.trim().replace(/\s+/g, ' ');
  },
});
```

## Custom Middlewares

### Middleware Simple

```typescript
import { Middleware, MiddlewareFn } from 'societyai';

// Fonction middleware
const simpleMiddleware: MiddlewareFn = async (ctx, next) => {
  console.log('Before execution');

  const result = await next(ctx);

  console.log('After execution');

  return result;
};

// Objet middleware
const namedMiddleware: Middleware = {
  name: 'my-middleware',
  description: 'Does something useful',
  priority: 50,
  fn: async (ctx, next) => {
    // Logic here
    return await next(ctx);
  },
};
```

### Middleware avec État

```typescript
class StatefulMiddleware {
  private requestCount = 0;
  private lastRequest = 0;

  middleware(): Middleware {
    return {
      name: 'stateful',
      fn: async (ctx, next) => {
        this.requestCount++;
        this.lastRequest = Date.now();

        ctx.metadata.set('requestNumber', this.requestCount);

        const result = await next(ctx);

        console.log(`Request #${this.requestCount} completed`);

        return result;
      },
    };
  }
}

const stateful = new StatefulMiddleware();
chain.use(stateful.middleware());
```

### Middleware Conditionnel

```typescript
const conditionalMiddleware: Middleware = {
  name: 'conditional',
  fn: async (ctx, next) => {
    // Appliquer seulement pour certains agents
    if (ctx.agentId?.startsWith('production-')) {
      // Logic spécifique production
      ctx.metadata.set('environment', 'production');
    }

    return await next(ctx);
  },
};
```

### Middleware avec Configuration

```typescript
function createCustomMiddleware(config: {
  prefix?: string;
  suffix?: string;
  transform?: (s: string) => string;
}): Middleware {
  return {
    name: 'custom-transform',
    fn: async (ctx, next) => {
      // Transformer l'input
      let input = String(ctx.input);
      if (config.prefix) input = config.prefix + input;
      if (config.suffix) input = input + config.suffix;
      if (config.transform) input = config.transform(input);

      ctx.processedInput = input;

      const result = await next(ctx);

      // Transformer l'output
      if (config.transform) {
        result.output = config.transform(result.output);
      }

      return result;
    },
  };
}

// Utilisation
chain.use(
  createCustomMiddleware({
    prefix: '>>> ',
    suffix: ' <<<',
    transform: (s) => s.toUpperCase(),
  })
);
```

### Middleware Asynchrone

```typescript
const asyncMiddleware: Middleware = {
  name: 'async-logger',
  fn: async (ctx, next) => {
    // Opérations async avant
    await logToDatabase({
      type: 'request-start',
      agentId: ctx.agentId,
      input: ctx.input,
      timestamp: Date.now(),
    });

    const result = await next(ctx);

    // Opérations async après
    await logToDatabase({
      type: 'request-complete',
      agentId: ctx.agentId,
      output: result.output,
      timestamp: Date.now(),
    });

    return result;
  },
};
```

## Step Middlewares

Les step middlewares s'appliquent au niveau des steps de workflow plutôt qu'au niveau des modèles.

### Step Middleware de Base

```typescript
import { StepMiddlewares } from 'societyai';

const stepLogging = StepMiddlewares.logging({
  logStepStart: true,
  logStepComplete: true,
  logResults: true,
});

const stepTiming = StepMiddlewares.timing({
  onComplete: (stepId, duration) => {
    console.log(`Step ${stepId} took ${duration}ms`);
  },
});
```

### Step Middleware Personnalisé

```typescript
import { StepMiddleware, StepMiddlewareContext } from 'societyai';

const customStepMiddleware: StepMiddleware = {
  name: 'custom-step',
  fn: async (ctx: StepMiddlewareContext, next) => {
    console.log(`Executing step: ${ctx.step.id}`);
    console.log(`Agents: ${ctx.step.agentIds?.join(', ')}`);

    const results = await next(ctx);

    console.log(`Step completed with ${results.length} results`);

    return results;
  },
};
```

### Utilisation avec Workflows

```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('workflow-1')
  .withStepMiddleware(stepLogging)
  .withStepMiddleware(stepTiming)
  .withStepMiddleware(customStepMiddleware)
  .addStep(/* ... */)
  .build();
```

## Middleware Composition

### Chaînes Complexes

```typescript
const productionChain = MiddlewareChain.create()
  // Layer 1: Observability
  .use(Middlewares.logging({ priority: 100 }))
  .use(Middlewares.metrics({ priority: 95 }))
  .use(Middlewares.timing({ priority: 90 }))

  // Layer 2: Performance
  .use(Middlewares.cache({ priority: 80, ttl: 300000 }))
  .use(Middlewares.rateLimit({ priority: 75, maxRequests: 100 }))

  // Layer 3: Reliability
  .use(Middlewares.retry({ priority: 70, maxAttempts: 3 }))
  .use(Middlewares.circuitBreaker({ priority: 65 }))
  .use(Middlewares.timeout({ priority: 60, duration: 30000 }))

  // Layer 4: Validation
  .use(Middlewares.validation({ priority: 50 }))
  .use(Middlewares.transform({ priority: 40 }))

  .sortByPriority()
  .build();
```

### Environnements Différents

```typescript
function createChainForEnvironment(env: 'dev' | 'staging' | 'prod') {
  const chain = MiddlewareChain.create();

  // Tous les environnements
  chain.use(Middlewares.logging());
  chain.use(Middlewares.timing());

  if (env === 'dev') {
    // Development: verbeux, pas de cache
    chain.use(Middlewares.logging({ logInput: true, logOutput: true }));
  }

  if (env === 'staging' || env === 'prod') {
    // Staging/Prod: cache, rate limiting
    chain.use(Middlewares.cache({ ttl: 300000 }));
    chain.use(Middlewares.rateLimit({ maxRequests: 100 }));
  }

  if (env === 'prod') {
    // Production: retry, circuit breaker, metrics
    chain.use(Middlewares.retry({ maxAttempts: 3 }));
    chain.use(Middlewares.circuitBreaker());
    chain.use(Middlewares.metrics({ collector: prodMetrics }));
  }

  return chain.build();
}

// Utilisation
const devChain = createChainForEnvironment('dev');
const prodChain = createChainForEnvironment('prod');
```

### Composition de Chaînes

```typescript
// Créer des chaînes réutilisables
const loggingChain = MiddlewareChain.create()
  .use(Middlewares.logging())
  .use(Middlewares.timing())
  .build();

const reliabilityChain = MiddlewareChain.create()
  .use(Middlewares.retry())
  .use(Middlewares.circuitBreaker())
  .build();

// Combiner
const composedMiddleware = new ComposedMiddleware([
  ...loggingChain.getMiddlewares(),
  ...reliabilityChain.getMiddlewares(),
]);
```

## Exemples Complets

### Exemple 1: Production-Ready Chain

```typescript
import { MiddlewareChain, Middlewares, InMemoryMetricsCollector, Society } from 'societyai';

// Métriques
const metricsCollector = new InMemoryMetricsCollector();

// Cache
const cache = new Map<string, { value: string; timestamp: number }>();

// Configuration production
const productionChain = MiddlewareChain.create()
  // 1. Logging
  .use(
    Middlewares.logging({
      logInput: false, // Ne pas logger les inputs sensibles
      logOutput: false,
      logDuration: true,
      logMetadata: true,
      formatter: (ctx, result) => {
        return JSON.stringify({
          timestamp: new Date().toISOString(),
          agentId: ctx.agentId,
          duration: Date.now() - ctx.startTime,
          success: result.continue,
          metadata: Object.fromEntries(result.metadata || []),
        });
      },
    })
  )

  // 2. Métriques
  .use(
    Middlewares.metrics({
      collector: metricsCollector,
      recordInput: false,
      recordOutput: false,
      recordDuration: true,
      recordErrors: true,
    })
  )

  // 3. Rate limiting
  .use(
    Middlewares.rateLimit({
      maxRequests: 100,
      windowMs: 60000,
      keyGenerator: (ctx) => ctx.agentId || 'default',
    })
  )

  // 4. Caching
  .use(
    Middlewares.cache({
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      storage: cache,
      keyGenerator: (ctx) => {
        return `${ctx.agentId}:${hash(ctx.input)}`;
      },
    })
  )

  // 5. Circuit breaker
  .use(
    Middlewares.circuitBreaker({
      failureThreshold: 5,
      timeout: 10000,
      resetTimeout: 60000,
      onOpen: (ctx) => {
        console.error(`Circuit opened for ${ctx.agentId}`);
        alertOps({
          type: 'circuit-breaker-open',
          agentId: ctx.agentId,
          timestamp: Date.now(),
        });
      },
    })
  )

  // 6. Retry
  .use(
    Middlewares.retry({
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 2,
      retryIf: (error) => {
        // Retry sur timeout ou rate limit
        return error.message.includes('timeout') || error.message.includes('rate limit');
      },
      onRetry: (attempt, error) => {
        console.warn(`Retry ${attempt}: ${error.message}`);
      },
    })
  )

  // 7. Timeout
  .use(
    Middlewares.timeout({
      duration: 30000,
      onTimeout: (ctx) => {
        console.error(`Timeout for ${ctx.agentId}`);
        metricsCollector.increment('timeouts');
      },
    })
  )

  // 8. Validation
  .use(
    Middlewares.validation({
      validateInput: (input) => {
        if (!input || String(input).trim().length === 0) {
          throw new Error('Input cannot be empty');
        }
      },
      validateOutput: (output) => {
        if (output.length < 10) {
          throw new Error('Output too short - likely error');
        }
      },
    })
  )

  .sortByPriority()
  .build();

// Utiliser avec Society
const model = productionChain.wrap(baseModel);

const result = await Society.create()
  .withName('Production Society')
  .addAgent(
    (a) =>
      a
        .withId('agent-1')
        .withRole((r) => r.withSystemPrompt('...'))
        .withModel(model) // Modèle wrappé
  )
  .execute(input);

// Consulter les métriques
console.log('Metrics:', metricsCollector.getMetrics());
```

### Exemple 2: Debug Chain

```typescript
const debugChain = MiddlewareChain.create()
  // Logging verbeux
  .use(
    Middlewares.logging({
      logInput: true,
      logOutput: true,
      logDuration: true,
      logMetadata: true,
      formatter: (ctx, result) => {
        console.log('═══════════════════════════════');
        console.log('Agent:', ctx.agentId);
        console.log('Input:', ctx.input);
        console.log('Output:', result.output);
        console.log('Duration:', Date.now() - ctx.startTime, 'ms');
        console.log('Metadata:', Object.fromEntries(ctx.metadata));
        console.log('═══════════════════════════════');
        return '';
      },
    })
  )

  // Injecter des breakpoints
  .use({
    name: 'debugger',
    fn: async (ctx, next) => {
      // Breakpoint conditionnel
      if (ctx.agentId === 'problematic-agent') {
        debugger; // Pause l'exécution
      }

      return await next(ctx);
    },
  })

  // Timing détaillé
  .use(
    Middlewares.timing({
      onComplete: (ctx, duration) => {
        if (duration > 1000) {
          console.warn(`⚠️  Slow execution: ${duration}ms for ${ctx.agentId}`);
        }
      },
    })
  )

  .build();
```

### Exemple 3: Testing Chain

```typescript
const testingChain = MiddlewareChain.create()
  // Mock responses
  .use({
    name: 'mock',
    fn: async (ctx, next) => {
      // Retourner des réponses mockées pour les tests
      if (ctx.metadata.get('mock')) {
        const mockResponse = ctx.metadata.get('mockResponse');
        return {
          output: String(mockResponse),
          continue: true,
          metadata: { mocked: true },
        };
      }

      return await next(ctx);
    },
  })

  // Capture pour assertions
  .use({
    name: 'capture',
    fn: async (ctx, next) => {
      const captures = (ctx.metadata.get('captures') as any[]) || [];

      captures.push({
        type: 'request',
        input: ctx.input,
        timestamp: Date.now(),
      });

      const result = await next(ctx);

      captures.push({
        type: 'response',
        output: result.output,
        timestamp: Date.now(),
      });

      ctx.metadata.set('captures', captures);

      return result;
    },
  })

  // Simulation d'erreurs
  .use({
    name: 'error-injection',
    fn: async (ctx, next) => {
      if (ctx.metadata.get('shouldFail')) {
        throw new Error('Injected error for testing');
      }

      return await next(ctx);
    },
  })

  .build();

// Utilisation dans les tests
describe('Agent Tests', () => {
  it('should handle mocked responses', async () => {
    const model = testingChain.wrap(baseModel);

    // Configurer le mock
    model.setMetadata('mock', true);
    model.setMetadata('mockResponse', 'Mocked result');

    const result = await model.process('test input');

    expect(result).toBe('Mocked result');
  });

  it('should capture interactions', async () => {
    const model = testingChain.wrap(baseModel);
    const captures: any[] = [];

    model.setMetadata('captures', captures);

    await model.process('test input');

    expect(captures).toHaveLength(2);
    expect(captures[0].type).toBe('request');
    expect(captures[1].type).toBe('response');
  });
});
```

### Exemple 4: A/B Testing Middleware

```typescript
class ABTestingMiddleware {
  private variant: 'A' | 'B';
  private results = {
    A: { count: 0, totalDuration: 0, errors: 0 },
    B: { count: 0, totalDuration: 0, errors: 0 },
  };

  constructor(
    private splitRatio: number = 0.5 // 50/50 split
  ) {
    this.variant = Math.random() < splitRatio ? 'A' : 'B';
  }

  middleware(): Middleware {
    return {
      name: 'ab-testing',
      fn: async (ctx, next) => {
        // Déterminer la variante pour cette requête
        const variant = this.getVariant();
        ctx.metadata.set('variant', variant);

        const startTime = Date.now();

        try {
          const result = await next(ctx);

          const duration = Date.now() - startTime;
          this.results[variant].count++;
          this.results[variant].totalDuration += duration;

          return result;
        } catch (error) {
          this.results[variant].errors++;
          throw error;
        }
      },
    };
  }

  private getVariant(): 'A' | 'B' {
    return Math.random() < this.splitRatio ? 'A' : 'B';
  }

  getResults() {
    return {
      A: {
        ...this.results.A,
        avgDuration: this.results.A.totalDuration / this.results.A.count,
        errorRate: this.results.A.errors / this.results.A.count,
      },
      B: {
        ...this.results.B,
        avgDuration: this.results.B.totalDuration / this.results.B.count,
        errorRate: this.results.B.errors / this.results.B.count,
      },
    };
  }
}

// Utilisation
const abTest = new ABTestingMiddleware(0.5);

const chainA = MiddlewareChain.create().use(abTest.middleware()).use(/* config A */).build();

const chainB = MiddlewareChain.create().use(abTest.middleware()).use(/* config B */).build();

// Après N requêtes
console.log('A/B Test Results:', abTest.getResults());
```

## Bonnes Pratiques

### 1. Ordre des Middlewares

```typescript
// ✅ Bon - ordre logique
MiddlewareChain.create()
  .use(Middlewares.logging()) // 1. Observer
  .use(Middlewares.validation()) // 2. Valider
  .use(Middlewares.cache()) // 3. Cache (court-circuite)
  .use(Middlewares.retry()) // 4. Retry (en cas d'échec)
  .use(Middlewares.timeout()); // 5. Timeout (protection)

// ❌ Mauvais - cache avant validation
MiddlewareChain.create()
  .use(Middlewares.cache()) // Pourrait cacher des inputs invalides
  .use(Middlewares.validation());
```

### 2. Gestion d'Erreurs

```typescript
// ✅ Bon - catch et log
const middleware: Middleware = {
  name: 'safe',
  fn: async (ctx, next) => {
    try {
      return await next(ctx);
    } catch (error) {
      console.error('Middleware error:', error);
      // Re-throw ou retourner erreur
      throw error;
    }
  },
};
```

### 3. Performance

```typescript
// ✅ Bon - opérations légères
const fastMiddleware: Middleware = {
  name: 'fast',
  fn: async (ctx, next) => {
    ctx.metadata.set('timestamp', Date.now());
    return await next(ctx);
  },
};

// ❌ Mauvais - opérations lourdes bloquantes
const slowMiddleware: Middleware = {
  name: 'slow',
  fn: async (ctx, next) => {
    await heavyDatabaseOperation(); // Bloque l'exécution
    return await next(ctx);
  },
};
```

### 4. Metadata Usage

```typescript
// ✅ Bon - utiliser metadata pour communication
const middleware1: Middleware = {
  name: 'set-data',
  fn: async (ctx, next) => {
    ctx.metadata.set('userId', getCurrentUserId());
    return await next(ctx);
  },
};

const middleware2: Middleware = {
  name: 'use-data',
  fn: async (ctx, next) => {
    const userId = ctx.metadata.get('userId');
    // Utiliser userId...
    return await next(ctx);
  },
};
```

### 5. Naming

```typescript
// ✅ Bon - noms descriptifs
Middlewares.logging({ name: 'request-logger' });
Middlewares.caching({ name: 'redis-cache' });

// ❌ Mauvais - noms génériques
Middlewares.logging({ name: 'middleware-1' });
```

## API Reference

### `MiddlewareChain`

**Méthodes:**

- `static create(): MiddlewareChain`
- `use(middleware: Middleware | MiddlewareFn): this`
- `useAt(index: number, middleware: Middleware): this`
- `useBefore(name: string, middleware: Middleware): this`
- `useAfter(name: string, middleware: Middleware): this`
- `remove(name: string): this`
- `forModel(model: AIModel): this`
- `sortByPriority(): this`
- `getMiddlewares(): readonly Middleware[]`
- `build(): ComposedMiddleware`
- `wrap(model: AIModel): MiddlewareWrappedModel`

### `Middlewares`

**Built-in Middlewares:**

- `static logging(config?: LoggingConfig): Middleware`
- `static timing(config?: TimingConfig): Middleware`
- `static cache(config: CacheConfig): Middleware`
- `static retry(config: RetryConfig): Middleware`
- `static rateLimit(config: RateLimitConfig): Middleware`
- `static validation(config: ValidationConfig): Middleware`
- `static circuitBreaker(config: CircuitBreakerConfig): Middleware`
- `static timeout(config: TimeoutConfig): Middleware`
- `static metrics(config: MetricsConfig): Middleware`
- `static transform(config: TransformConfig): Middleware`

### `StepMiddlewares`

**Step-Level Middlewares:**

- `static logging(config?: StepLoggingConfig): StepMiddleware`
- `static timing(config?: StepTimingConfig): StepMiddleware`

## Voir Aussi

- [Architecture](./architecture.md) - Concepts de base
- [Advanced Features](./advanced.md) - Fonctionnalités avancées
- [Metrics & Observability](./metrics-observability.md) - Métriques et monitoring
- [Error Handling](./error-handling.md) - Gestion d'erreurs
