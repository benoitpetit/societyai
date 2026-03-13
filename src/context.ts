/**
 * @fileoverview Context System API
 *
 * Type-safe context injection and management for agents.
 *
 * @example
 * ```typescript
 * import { ContextProvider, ContextScope, createContextToken } from 'societyai/context';
 *
 * const userToken = createContextToken<{ name: string }>('user');
 *
 * const provider = ContextProvider.create()
 *   .provide(userToken, { name: 'Alice' })
 *   .build();
 *
 * const user = provider.get(userToken);
 * ```
 */

// Context Tokens
export { createContextToken, isContextToken } from './core/context';

export type { ContextToken } from './core/context';

// Context Provider
export { ContextProvider, ContextProviderBuilder, ContextScope } from './core/context';

export type { IContextProvider, IMutableContextProvider } from './core/context';

// Common Contexts
export { CommonContexts } from './core/context';

// Context Utilities
export {
  ContextStore,
  ContextMap,
  selectContext,
  fromObject,
  toObject,
  mergeContexts,
} from './core/context';

// Agent Context Injection
export { AgentContextInjector, ContextAwarePromptBuilder } from './core/context';
