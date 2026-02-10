# Context Management System

The **Context Management System** in SocietyAI provides a type-safe, decoupled
way to share state and dependencies between agents, steps, and workflows. It
follows a Dependency Injection (DI) pattern similar to those found in modern
frameworks, adapted for multi-agent systems.

## 🔑 Key Concepts

### Context Tokens

Tokens are unique identifiers for your data. They preserve type information,
ensuring that when you store a `User` object, you get a `User` object back.

```typescript
import { createContextToken } from 'societyai';

// Define tokens (usually in a shared constants file)
export const UserToken = createContextToken<User>('user');
export const ConfigToken = createContextToken<AppConfig>('config');
export const DatabaseToken = createContextToken<DatabaseConnection>('db');
```

Optionally, you can provide a default value:

```typescript
export const ThemeToken = createContextToken<string>('theme', 'dark');
```

## 🏗️ Creating a Provider

The `ContextProvider` is the container that holds your data. You typically build
it once at the start of your application or workflow.

### Using the Builder

```typescript
import { ContextProvider, ContextScope } from 'societyai';

const provider = ContextProvider.create()
  // Provide static values
  .provide(UserToken, { id: 1, name: 'Alice' })

  // Provide lazy factories (initialized only when requested)
  .provideFactory(
    DatabaseToken,
    () => new DatabaseConnection(),
    ContextScope.GLOBAL
  )

  // Build the provider
  .build();
```

### Context Scopes

Scopes define the lifecycle of the data. SocietyAI supports:

- **`ContextScope.GLOBAL`**: Shared across all executions. Singleton-like
  behavior.
- **`ContextScope.WORKFLOW`**: Exists for the duration of a single workflow run.
- **`ContextScope.STEP`**: Created anew for each step in the graph.
- **`ContextScope.AGENT`**: Specific to an agent instance.

## 📖 Consuming Context

### Basic Usage

```typescript
// Retrieve value (throws if missing and no default value)
const user = provider.get(UserToken);

// Check existence
if (provider.has(ConfigToken)) {
  const config = provider.get(ConfigToken);
}

// Get with optional undefined return
const db = provider.getOptional(DatabaseToken);
```

### In Agents

Context is automatically injected into Agent execution contexts if the Society
is configured with the provider.

```typescript
// During agent execution
const agentAction = async (context: ExecutionContext) => {
  const user = context.provider.get(UserToken);
  // ... use user data
};
```

## 🌱 Inheritance and Nesting

Contexts can be nested. A child context inherits everything from its parent but
can override specific tokens. This is useful for creating isolated scopes for
specific branches of execution.

```typescript
const globalProvider = ContextProvider.create()
  .provide(ConfigToken, globalConfig)
  .build();

// Create a child provider for specific request
const requestProvider = globalProvider.createChild();
requestProvider.provide(UserToken, currentUser);

// Child has access to both
const config = requestProvider.get(ConfigToken); // from parent
const user = requestProvider.get(UserToken); // from child
```

## 🔄 Mutable Context

By default, providers are read-heavy, but `IMutableContextProvider` allows for
dynamic updates during execution.

```typescript
if (provider instanceof ContextProvider) {
  provider.set(UserToken, updatedUser);
  provider.delete(TempToken);
  provider.clear();
}
```

## Best Practices

1.  **Define Tokens Globally**: Keep your `createContextToken` calls in a shared
    `tokens.ts` file to avoid circular dependencies.
2.  **Use Factories for Heavy Objects**: Use `.provideFactory()` for database
    connections or API clients so they are only instantiated if needed.
3.  **Prefer Immutable Contexts**: Try to set up your context before starting
    the workflow to avoid race conditions in parallel executions.
