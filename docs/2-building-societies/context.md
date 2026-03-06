# Context Management

The **Context Management System** in SocietyAI provides a type-safe, decoupled
way to share state and dependencies between agents, steps, and workflows. It
follows a Dependency Injection (DI) pattern similar to those found in modern
frameworks, adapted for multi-agent systems.

---

## 📋 Table of Contents

- [Key Concepts](#key-concepts)
- [Creating a Provider](#creating-a-provider)
- [Consuming Context](#consuming-context)
- [Inheritance and Nesting](#inheritance-and-nesting)
- [Mutable Context](#mutable-context)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🔑 Key Concepts

### Context Tokens

Tokens are unique identifiers for your data. They preserve type information,
ensuring that when you store a `User` object, you get a `User` object back.

```typescript
import { createContextToken } from 'societyai';

// Define tokens (usually in a shared constants file)
export const UserToken    = createContextToken<User>('user');
export const ConfigToken  = createContextToken<AppConfig>('config');
export const DatabaseToken = createContextToken<DatabaseConnection>('db');
```

Optionally, you can provide a default value that is returned when no explicit
value has been provided:

```typescript
export const ThemeToken = createContextToken<string>('theme', 'dark');
```

> **Tip:** Define all your tokens in a shared `tokens.ts` file to avoid
> circular dependencies and keep them discoverable.

---

## 🏗️ Creating a Provider

The `ContextProvider` is the container that holds your data. Build it once at
the start of your application or workflow, then pass it into the Society.

### Using the Builder

```typescript
import { ContextProvider, ContextScope } from 'societyai';

const provider = ContextProvider.create()
  // Provide a static value
  .provide(UserToken, { id: 1, name: 'Alice' })

  // Provide a lazy factory — initialised only when first requested
  .provideFactory(
    DatabaseToken,
    () => new DatabaseConnection(),
    ContextScope.GLOBAL
  )

  .build();
```

### Context Scopes

Scopes define the lifecycle of the data in the provider.

| Scope | Behaviour |
|---|---|
| `ContextScope.GLOBAL` | Shared across all executions. Singleton-like. |
| `ContextScope.WORKFLOW` | Exists for the duration of a single workflow run. |
| `ContextScope.STEP` | Created anew for each step in the graph. |
| `ContextScope.AGENT` | Specific to a single agent instance. |

---

## 📖 Consuming Context

### Basic Usage

```typescript
// Retrieve a value (throws if missing and no default was set)
const user = provider.get(UserToken);

// Check existence before retrieving
if (provider.has(ConfigToken)) {
  const config = provider.get(ConfigToken);
}

// Return undefined instead of throwing when missing
const db = provider.getOptional(DatabaseToken);
```

### In Agents

Context is automatically injected into agent execution contexts when the
Society is configured with a provider.

```typescript
// During agent execution
const agentAction = async (context: ExecutionContext) => {
  const user = context.provider.get(UserToken);
  // ... use user data
};
```

---

## 🌱 Inheritance and Nesting

Contexts can be nested. A child context inherits everything from its parent but
can override specific tokens. This is useful for creating isolated scopes for
specific execution branches.

```typescript
const globalProvider = ContextProvider.create()
  .provide(ConfigToken, globalConfig)
  .build();

// Create a child provider for a specific request
const requestProvider = globalProvider.createChild();
requestProvider.provide(UserToken, currentUser);

// The child has access to both parent and child values
const config = requestProvider.get(ConfigToken); // inherited from parent
const user   = requestProvider.get(UserToken);   // defined in child
```

---

## 🔄 Mutable Context

By default, providers are read-optimised, but `IMutableContextProvider` allows
for dynamic updates during execution.

```typescript
if (provider instanceof ContextProvider) {
  provider.set(UserToken, updatedUser);
  provider.delete(TempToken);
  provider.clear(); // removes all values
}
```

> **Warning:** Mutating a shared context from multiple parallel agents can cause
> race conditions. Prefer setting up context before workflow execution whenever
> possible, or scope mutations to `ContextScope.AGENT`.

---

## ✅ Best Practices

1. **Define Tokens Globally** — Keep `createContextToken` calls in a shared
   `tokens.ts` file to avoid circular dependencies and ensure discoverability.

2. **Use Factories for Heavy Objects** — Use `.provideFactory()` for database
   connections, API clients, or any expensive resource so they are only
   instantiated if actually needed.

3. **Prefer Immutable Contexts** — Set up your context before the workflow
   starts to avoid race conditions in parallel branches.

4. **Use the Narrowest Scope** — Prefer `STEP` or `AGENT` scope over `GLOBAL`
   when data does not need to persist across the entire workflow.

---

## 📚 Next Steps

- **[Society Configuration](./society-configuration.md)** — Learn how to wire a
  `ContextProvider` into your Society via `.withGlobalContext()`.
- **[Prompt Templates](./prompts.md)** — Use `{context}` and `{sharedData}`
  placeholders to inject context values directly into agent prompts.
- **[Agents & Roles](./agents-roles.md)** — Attach initial context to
  individual agents with `.withInitialContext()`.
- **[Observability](../4-advanced/observability.md)** — Inspect context values
  at runtime through the event system.