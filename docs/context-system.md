# Context System

Le système de contexte de SocietyAI fournit un mécanisme d'injection de dépendances type-safe pour partager l'état entre les agents sans couplage fort.

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Context Tokens](#context-tokens)
- [Context Provider](#context-provider)
- [Context Scopes](#context-scopes)
- [Utilisation avec des Agents](#utilisation-avec-des-agents)
- [Patterns Avancés](#patterns-avancés)
- [Exemples Complets](#exemples-complets)

## Vue d'ensemble

Le système de contexte permet de:

- **Injection de dépendances type-safe** avec des tokens typés
- **Partage d'état** entre agents sans référence directe
- **Scopes hiérarchiques** (global, workflow, step, agent)
- **Lazy initialization** avec des factories
- **Héritage de contexte** avec des providers enfants
- **Immutabilité par défaut** avec option mutable

### Principes de Design

- **Type-safe**: Support complet des génériques TypeScript
- **Zero coupling**: Les agents ne dépendent pas les uns des autres
- **Composable**: Les contextes peuvent être imbriqués et combinés
- **Zero runtime deps**: Implémentation pure TypeScript

## Context Tokens

Les tokens de contexte sont des clés type-safe pour accéder aux valeurs de contexte.

### Création de Tokens

```typescript
import { createContextToken } from 'societyai';

// Token simple
const UserContext = createContextToken<User>('user');

// Token avec valeur par défaut
const ConfigContext = createContextToken<Config>('config', {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
});

// Token pour des données primitives
const ApiKeyContext = createContextToken<string>('apiKey');

// Token pour des structures complexes
interface AppState {
  users: User[];
  session: Session;
  settings: Settings;
}
const AppStateContext = createContextToken<AppState>('appState');
```

### Vérification de Tokens

```typescript
import { isContextToken } from 'societyai';

const token = createContextToken<string>('test');
console.log(isContextToken(token)); // true
console.log(isContextToken('test')); // false
```

## Context Provider

Le `ContextProvider` gère les valeurs de contexte et permet l'injection.

### Création de Base

```typescript
import { ContextProvider } from 'societyai';

const provider = ContextProvider.create()
  .provide(UserContext, { id: 1, name: 'Alice' })
  .provide(ConfigContext, config)
  .build();

// Accès aux valeurs
const user = provider.get(UserContext);
const config = provider.get(ConfigContext);
```

### Factory pour Lazy Initialization

```typescript
const provider = ContextProvider.create()
  .provideFactory(DatabaseContext, () => {
    console.log('Database initialized');
    return createDatabaseConnection();
  })
  .build();

// La database n'est initialisée que lors du premier accès
const db = provider.get(DatabaseContext);
```

### Builder Fluent

```typescript
const provider = ContextProviderBuilder.create()
  .provide(UserContext, currentUser)
  .provide(ConfigContext, appConfig)
  .provideFactory(CacheContext, () => new LRUCache())
  .build();
```

## Context Scopes

Les scopes définissent la portée de visibilité des contextes.

### Types de Scopes

```typescript
enum ContextScope {
  GLOBAL = 'global', // Partagé entre toutes les exécutions
  WORKFLOW = 'workflow', // Partagé dans une exécution de workflow
  STEP = 'step', // Partagé dans une étape de workflow
  AGENT = 'agent', // Spécifique à un agent
}
```

### Utilisation des Scopes

```typescript
import { ContextScope } from 'societyai';

const provider = ContextProvider.create()
  // Scope global - partagé partout
  .provide(ConfigContext, config, ContextScope.GLOBAL)

  // Scope workflow (par défaut)
  .provide(SessionContext, session)

  // Scope step - réinitialisé à chaque étape
  .provide(TempDataContext, {}, ContextScope.STEP)

  // Scope agent - spécifique à chaque agent
  .provide(AgentStateContext, {}, ContextScope.AGENT)
  .build();
```

## Utilisation avec des Agents

### Injection dans les Prompts

```typescript
import { ContextAwarePromptBuilder } from 'societyai';

const promptBuilder = new ContextAwarePromptBuilder(provider);

const prompt = promptBuilder
  .withSystemPrompt('You are a helpful assistant')
  .withContext({
    user: UserContext,
    config: ConfigContext,
  })
  .withInput(userInput)
  .build();

// Le prompt inclura automatiquement les valeurs de contexte
```

### Agent Context Injector

```typescript
import { AgentContextInjector } from 'societyai';

const injector = new AgentContextInjector(provider);

// Injecte le contexte dans la configuration de l'agent
const enrichedAgent = injector.inject(agentConfig, {
  injectIntoPrompt: true,
  contextTokens: [UserContext, ConfigContext],
});
```

### Utilisation dans Society Builder

```typescript
const provider = ContextProvider.create()
  .provide(UserContext, currentUser)
  .provide(ApiKeyContext, process.env.API_KEY!)
  .build();

const society = Society.create()
  .withName('Contextual Society')
  .withContext(provider) // Attache le provider
  .addAgent((agent) =>
    agent
      .withId('assistant')
      .withRole((r) => r.withSystemPrompt('You are an assistant. User: {context.user.name}'))
      .withModel(model)
  )
  .execute(input);

// Le contexte est automatiquement disponible pour tous les agents
```

## Patterns Avancés

### Providers Enfants

Créez des contextes hérités pour l'isolation:

```typescript
const parentProvider = ContextProvider.create().provide(ConfigContext, globalConfig).build();

// Le contexte enfant hérite du parent
const childProvider = parentProvider.createChild();
childProvider.set(LocalStateContext, localState);

// Peut accéder au parent et au local
const config = childProvider.get(ConfigContext); // Du parent
const state = childProvider.get(LocalStateContext); // Local
```

### Merge de Providers

Combinez plusieurs providers:

```typescript
const provider1 = ContextProvider.create().provide(UserContext, user).build();

const provider2 = ContextProvider.create().provide(ConfigContext, config).build();

// Merge provider2 dans provider1
provider1.merge(provider2);

// provider1 a maintenant les deux contextes
```

### Providers Immutables

Créez une vue en lecture seule:

```typescript
const mutableProvider = ContextProvider.create().provide(UserContext, user).build();

// Vue immutable
const immutableView = mutableProvider.freeze();

// ✅ Lecture OK
const user = immutableView.get(UserContext);

// ❌ Erreur - pas de méthode set
// immutableView.set(UserContext, newUser);
```

### Context Store

Utilisez le `ContextStore` pour la gestion d'état:

```typescript
import { ContextStore, selectContext, fromObject, toObject } from 'societyai';

// Créer depuis un objet
const store = fromObject({
  user: currentUser,
  config: appConfig,
  session: sessionData,
});

// Sélectionner des valeurs
const user = selectContext(store, UserContext);

// Convertir en objet
const data = toObject(store);
```

### Common Contexts

Utilisez les contextes prédéfinis:

```typescript
import { CommonContexts } from 'societyai';

const provider = ContextProvider.create()
  .provide(CommonContexts.RequestId, generateId())
  .provide(CommonContexts.UserId, userId)
  .provide(CommonContexts.SessionId, sessionId)
  .provide(CommonContexts.Timestamp, Date.now())
  .build();
```

## Exemples Complets

### Exemple 1: Application Web avec Contexte Utilisateur

```typescript
import { Society, ContextProvider, createContextToken, ContextScope } from 'societyai';

// Définir les tokens
interface User {
  id: string;
  name: string;
  preferences: Record<string, unknown>;
}

interface Request {
  method: string;
  path: string;
  body: unknown;
}

const UserContext = createContextToken<User>('user');
const RequestContext = createContextToken<Request>('request');
const ApiKeyContext = createContextToken<string>('apiKey');

// Créer le provider pour une requête
function createRequestContext(user: User, request: Request) {
  return (
    ContextProvider.create()
      // Config globale
      .provide(ApiKeyContext, process.env.API_KEY!, ContextScope.GLOBAL)

      // Données de la requête
      .provide(UserContext, user, ContextScope.WORKFLOW)
      .provide(RequestContext, request, ContextScope.WORKFLOW)
      .build()
  );
}

// Utiliser dans la society
async function handleRequest(user: User, request: Request) {
  const provider = createRequestContext(user, request);

  const result = await Society.create()
    .withName('Request Handler')
    .withContext(provider)
    .addAgent((a) =>
      a
        .withId('analyzer')
        .withRole((r) =>
          r.withSystemPrompt(
            `You are analyzing a request for user {context.user.name}.
          Request: {context.request.method} {context.request.path}`
          )
        )
        .withModel(model)
    )
    .execute(`Analyze: ${JSON.stringify(request.body)}`);

  return result;
}
```

### Exemple 2: Système Multi-Tenant

```typescript
// Tokens pour multi-tenant
const TenantContext = createContextToken<Tenant>('tenant');
const DatabaseContext = createContextToken<Database>('database');

// Factory par tenant
class TenantContextFactory {
  private providers = new Map<string, ContextProvider>();

  get(tenantId: string): ContextProvider {
    if (!this.providers.has(tenantId)) {
      const tenant = loadTenant(tenantId);

      const provider = ContextProvider.create()
        .provide(TenantContext, tenant)
        .provideFactory(DatabaseContext, () => {
          // Connexion DB spécifique au tenant
          return createConnection(tenant.dbConfig);
        })
        .build();

      this.providers.set(tenantId, provider);
    }

    return this.providers.get(tenantId)!;
  }
}

// Utilisation
const factory = new TenantContextFactory();

async function processTenantRequest(tenantId: string, input: string) {
  const provider = factory.get(tenantId);

  return await Society.create().withContext(provider).addAgent(/* ... */).execute(input);
}
```

### Exemple 3: Test avec Contextes Mockés

```typescript
// Contextes pour tests
const MockUserContext = createContextToken<User>('mockUser', {
  id: 'test-user',
  name: 'Test User',
});

const MockApiContext = createContextToken<API>('mockApi');

// Provider de test
function createTestContext(): ContextProvider {
  const mockApi = {
    async fetch(url: string) {
      return { data: 'mock data' };
    },
  };

  return ContextProvider.create()
    .provide(MockUserContext, {
      id: 'test-1',
      name: 'Alice Test',
    })
    .provide(MockApiContext, mockApi)
    .build();
}

// Test
describe('Society with Context', () => {
  it('should use mock context', async () => {
    const provider = createTestContext();

    const result = await Society.create()
      .withContext(provider)
      .addAgent(/* ... */)
      .execute('test input');

    expect(result.success).toBe(true);
  });
});
```

### Exemple 4: Context Middleware

```typescript
import { Middleware, MiddlewareContext } from 'societyai';

// Middleware qui injecte le contexte
const contextMiddleware = (provider: ContextProvider): Middleware => ({
  name: 'context-injection',
  fn: async (ctx: MiddlewareContext, next) => {
    // Injecter les contextes dans metadata
    ctx.metadata.set('contextProvider', provider);

    // Enrichir l'input avec le contexte
    const user = provider.getOptional(UserContext);
    if (user) {
      ctx.processedInput = `[User: ${user.name}] ${ctx.input}`;
    }

    return await next(ctx);
  },
});

// Utilisation
const chain = MiddlewareChain.create()
  .use(contextMiddleware(provider))
  .use(Middlewares.logging())
  .build();
```

## Bonnes Pratiques

### 1. Nommage des Tokens

```typescript
// ✅ Bon - noms descriptifs
const UserContext = createContextToken<User>('user');
const DatabaseContext = createContextToken<Database>('database');

// ❌ Mauvais - noms génériques
const Context1 = createContextToken<any>('ctx1');
```

### 2. Typage Fort

```typescript
// ✅ Bon - interfaces bien définies
interface AppConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}
const ConfigContext = createContextToken<AppConfig>('config');

// ❌ Mauvais - typage faible
const ConfigContext = createContextToken<any>('config');
```

### 3. Valeurs par Défaut

```typescript
// ✅ Bon - valeurs par défaut sensées
const TimeoutContext = createContextToken<number>('timeout', 5000);

// ✅ Bon - config par défaut complète
const defaultConfig: AppConfig = {
  apiUrl: process.env.API_URL || 'http://localhost',
  timeout: 5000,
  retries: 3,
};
const ConfigContext = createContextToken<AppConfig>('config', defaultConfig);
```

### 4. Lazy Initialization

```typescript
// ✅ Bon - ressources coûteuses en lazy
provider.provideFactory(DatabaseContext, () => createConnection());
provider.provideFactory(CacheContext, () => new LRUCache(100));

// ❌ Mauvais - initialisation immédiate
provider.provide(DatabaseContext, createConnection());
```

### 5. Scopes Appropriés

```typescript
// ✅ Bon - scope adapté au cycle de vie
provider.provide(ConfigContext, config, ContextScope.GLOBAL);
provider.provide(SessionContext, session, ContextScope.WORKFLOW);
provider.provide(TempDataContext, {}, ContextScope.STEP);

// ❌ Mauvais - tout en global
provider.provide(SessionContext, session, ContextScope.GLOBAL);
```

## API Reference

### `createContextToken<T>(name, defaultValue?)`

Crée un token de contexte type-safe.

**Paramètres:**

- `name: string` - Nom unique du token
- `defaultValue?: T` - Valeur par défaut optionnelle

**Retourne:** `ContextToken<T>`

### `ContextProvider.create()`

Crée un nouveau builder de context provider.

**Retourne:** `ContextProviderBuilder`

### `ContextProvider.empty()`

Crée un provider vide.

**Retourne:** `ContextProvider`

### `provider.provide<T>(token, value, scope?)`

Fournit une valeur pour un token.

**Paramètres:**

- `token: ContextToken<T>` - Le token
- `value: T` - La valeur
- `scope?: ContextScope` - Le scope (défaut: WORKFLOW)

**Retourne:** `this`

### `provider.provideFactory<T>(token, factory, scope?)`

Fournit une factory pour lazy initialization.

**Paramètres:**

- `token: ContextToken<T>` - Le token
- `factory: () => T` - La fonction factory
- `scope?: ContextScope` - Le scope (défaut: WORKFLOW)

**Retourne:** `this`

### `provider.get<T>(token)`

Récupère une valeur de contexte.

**Paramètres:**

- `token: ContextToken<T>` - Le token

**Retourne:** `T`

**Throws:** `Error` si le contexte n'est pas fourni

### `provider.getOptional<T>(token)`

Récupère une valeur de contexte ou undefined.

**Paramètres:**

- `token: ContextToken<T>` - Le token

**Retourne:** `T | undefined`

### `provider.has<T>(token)`

Vérifie si un contexte est fourni.

**Paramètres:**

- `token: ContextToken<T>` - Le token

**Retourne:** `boolean`

### `provider.createChild()`

Crée un provider enfant qui hérite du parent.

**Retourne:** `ContextProvider`

### `provider.merge(other)`

Fusionne un autre provider dans celui-ci.

**Paramètres:**

- `other: ContextProvider` - Le provider à fusionner

**Retourne:** `this`

### `provider.freeze()`

Crée une vue immutable du provider.

**Retourne:** `IContextProvider`

## Voir Aussi

- [Architecture](./architecture.md) - Concepts de base
- [Workflows](./workflows.md) - Utilisation du contexte dans les workflows
- [Middleware System](./middleware.md) - Intégration avec les middlewares
- [Advanced Features](./advanced.md) - Patterns avancés
