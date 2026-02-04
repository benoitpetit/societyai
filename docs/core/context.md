# Context System

## Context Provider

For complex state management across dispersed agents, use the Context Provider system.

```typescript
// Define a token
const UserToken = createContextToken<User>('user');

// Create a provider
const provider = ContextProvider.create()
  .provide(UserToken, currentUser)
  .build();

// Access type-safe data anywhere
const user = provider.get(UserToken);
```

## Methods
- `create()`: Start building a provider.
- `provide(token, value)`: Set a value.
- `provideFactory(token, factory)`: Lazy value.
- `inherit(parent)`: Inherit from another provider.
