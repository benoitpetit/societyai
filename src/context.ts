/**
 * @fileoverview Context Provider System for SocietyAI
 *
 * This module provides a type-safe context injection system for sharing
 * state between agents without tight coupling. Context providers enable
 * dependency injection and state management patterns.
 *
 * Features:
 * - Type-safe context tokens
 * - Scoped contexts (global, workflow, step, agent)
 * - Lazy initialization
 * - Context inheritance
 * - Immutable by default, mutable when needed
 *
 * Design principles:
 * - Type-safe: Full TypeScript generic support
 * - Zero coupling: Agents don't depend on each other
 * - Composable: Contexts can be nested and combined
 * - Zero runtime deps: Pure TypeScript implementation
 *
 * @example
 * ```typescript
 * // Define context tokens
 * const UserContext = createContextToken<User>('user');
 * const ConfigContext = createContextToken<Config>('config');
 *
 * // Create context provider
 * const provider = ContextProvider.create()
 *   .provide(UserContext, { id: 1, name: 'John' })
 *   .provideFactory(ConfigContext, () => loadConfig())
 *   .build();
 *
 * // Use in agents
 * const user = provider.get(UserContext);
 * ```
 */

// ============================================================================
// CONTEXT TOKEN SYSTEM
// ============================================================================

/**
 * Symbol used for context token identification
 */
const CONTEXT_TOKEN_SYMBOL = Symbol('ContextToken');

/**
 * Context token - a type-safe key for context values
 */
export interface ContextToken<T> {
  /** Token symbol for identification */
  readonly [CONTEXT_TOKEN_SYMBOL]: true;
  /** Token name for debugging */
  readonly name: string;
  /** Default value (optional) */
  readonly defaultValue?: T;
  /** Phantom type for TypeScript */
  readonly _type?: T;
}

/**
 * Create a context token with a specific type
 */
export function createContextToken<T>(name: string, defaultValue?: T): ContextToken<T> {
  return {
    [CONTEXT_TOKEN_SYMBOL]: true,
    name,
    defaultValue,
  } as ContextToken<T>;
}

/**
 * Check if a value is a context token
 */
export function isContextToken<T>(value: unknown): value is ContextToken<T> {
  return typeof value === 'object' && value !== null && CONTEXT_TOKEN_SYMBOL in value;
}

// ============================================================================
// CONTEXT SCOPE
// ============================================================================

/**
 * Context scope levels
 */
export enum ContextScope {
  /** Global scope - shared across all executions */
  GLOBAL = 'global',
  /** Workflow scope - shared within a workflow execution */
  WORKFLOW = 'workflow',
  /** Step scope - shared within a workflow step */
  STEP = 'step',
  /** Agent scope - specific to an agent */
  AGENT = 'agent',
}

/**
 * Context entry with metadata
 */
interface ContextEntry<T> {
  value: T | (() => T);
  scope: ContextScope;
  isFactory: boolean;
  initialized: boolean;
  cachedValue?: T;
}

// ============================================================================
// CONTEXT PROVIDER
// ============================================================================

/**
 * Context provider interface
 */
export interface IContextProvider {
  /** Get a context value */
  get<T>(token: ContextToken<T>): T;
  /** Check if a context is provided */
  has<T>(token: ContextToken<T>): boolean;
  /** Get a context value or undefined */
  getOptional<T>(token: ContextToken<T>): T | undefined;
  /** Create a child context that inherits from this one */
  createChild(): IContextProvider;
}

/**
 * Mutable context provider that allows setting values
 */
export interface IMutableContextProvider extends IContextProvider {
  /** Set a context value */
  set<T>(token: ContextToken<T>, value: T): void;
  /** Delete a context value */
  delete<T>(token: ContextToken<T>): boolean;
  /** Clear all context values */
  clear(): void;
}

/**
 * Context provider implementation
 */
export class ContextProvider implements IMutableContextProvider {
  private contexts = new Map<string, ContextEntry<unknown>>();
  private parent?: ContextProvider;

  /**
   * Create a new context provider
   */
  static create(): ContextProviderBuilder {
    return new ContextProviderBuilder();
  }

  /**
   * Create an empty context provider
   */
  static empty(): ContextProvider {
    return new ContextProvider();
  }

  constructor(parent?: ContextProvider) {
    this.parent = parent;
  }

  /**
   * Provide a value for a context token
   */
  provide<T>(token: ContextToken<T>, value: T, scope: ContextScope = ContextScope.WORKFLOW): this {
    this.contexts.set(token.name, {
      value,
      scope,
      isFactory: false,
      initialized: true,
      cachedValue: value,
    });
    return this;
  }

  /**
   * Provide a factory for lazy initialization
   */
  provideFactory<T>(
    token: ContextToken<T>,
    factory: () => T,
    scope: ContextScope = ContextScope.WORKFLOW
  ): this {
    this.contexts.set(token.name, {
      value: factory,
      scope,
      isFactory: true,
      initialized: false,
    });
    return this;
  }

  /**
   * Get a context value
   */
  get<T>(token: ContextToken<T>): T {
    const entry = this.contexts.get(token.name) as ContextEntry<T> | undefined;

    if (entry) {
      if (entry.isFactory && !entry.initialized) {
        entry.cachedValue = (entry.value as () => T)();
        entry.initialized = true;
      }
      return entry.cachedValue as T;
    }

    // Check parent
    if (this.parent) {
      return this.parent.get(token);
    }

    // Check for default value
    if (token.defaultValue !== undefined) {
      return token.defaultValue;
    }

    throw new Error(`Context not provided: ${token.name}`);
  }

  /**
   * Get a context value or undefined
   */
  getOptional<T>(token: ContextToken<T>): T | undefined {
    try {
      return this.get(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a context is provided
   */
  has<T>(token: ContextToken<T>): boolean {
    if (this.contexts.has(token.name)) {
      return true;
    }
    return this.parent?.has(token) ?? false;
  }

  /**
   * Set a context value
   */
  set<T>(token: ContextToken<T>, value: T): void {
    const existing = this.contexts.get(token.name);
    this.contexts.set(token.name, {
      value,
      scope: existing?.scope ?? ContextScope.WORKFLOW,
      isFactory: false,
      initialized: true,
      cachedValue: value,
    });
  }

  /**
   * Delete a context value
   */
  delete<T>(token: ContextToken<T>): boolean {
    return this.contexts.delete(token.name);
  }

  /**
   * Clear all context values
   */
  clear(): void {
    this.contexts.clear();
  }

  /**
   * Create a child context that inherits from this one
   */
  createChild(): ContextProvider {
    return new ContextProvider(this);
  }

  /**
   * Get all context keys
   */
  keys(): string[] {
    const parentKeys = this.parent?.keys() ?? [];
    return [...new Set([...parentKeys, ...this.contexts.keys()])];
  }

  /**
   * Merge another context provider into this one
   */
  merge(other: ContextProvider): this {
    for (const [key, entry] of other.contexts) {
      this.contexts.set(key, { ...entry });
    }
    return this;
  }

  /**
   * Create an immutable view of this context
   */
  freeze(): IContextProvider {
    return {
      get: <T>(token: ContextToken<T>) => this.get(token),
      getOptional: <T>(token: ContextToken<T>) => this.getOptional(token),
      has: <T>(token: ContextToken<T>) => this.has(token),
      createChild: () => this.createChild(),
    };
  }
}

// ============================================================================
// CONTEXT PROVIDER BUILDER
// ============================================================================

/**
 * Builder for creating context providers
 */
export class ContextProviderBuilder {
  private provider = new ContextProvider();

  /**
   * Provide a value for a context token
   */
  provide<T>(token: ContextToken<T>, value: T, scope: ContextScope = ContextScope.WORKFLOW): this {
    this.provider.provide(token, value, scope);
    return this;
  }

  /**
   * Provide a factory for lazy initialization
   */
  provideFactory<T>(
    token: ContextToken<T>,
    factory: () => T,
    scope: ContextScope = ContextScope.WORKFLOW
  ): this {
    this.provider.provideFactory(token, factory, scope);
    return this;
  }

  /**
   * Provide multiple values from an object
   */
  provideAll(values: Record<string, unknown>): this {
    for (const [name, value] of Object.entries(values)) {
      const token = createContextToken<unknown>(name);
      this.provider.provide(token, value);
    }
    return this;
  }

  /**
   * Inherit from a parent context
   */
  inherit(parent: ContextProvider): this {
    this.provider = new ContextProvider(parent);
    return this;
  }

  /**
   * Build the context provider
   */
  build(): ContextProvider {
    return this.provider;
  }
}

// ============================================================================
// COMMON CONTEXT TOKENS
// ============================================================================

/**
 * Pre-defined context tokens for common use cases
 */
export const CommonContexts = {
  /** Current input being processed */
  INPUT: createContextToken<string>('input', ''),
  
  /** Current step ID */
  STEP_ID: createContextToken<string>('stepId', ''),
  
  /** Current agent ID */
  AGENT_ID: createContextToken<string>('agentId', ''),
  
  /** Workflow ID */
  WORKFLOW_ID: createContextToken<string>('workflowId', ''),
  
  /** Execution timestamp */
  TIMESTAMP: createContextToken<number>('timestamp', 0),
  
  /** Previous step results */
  PREVIOUS_RESULTS: createContextToken<unknown[]>('previousResults', []),
  
  /** Shared data between steps */
  SHARED_DATA: createContextToken<Map<string, unknown>>('sharedData'),
  
  /** Debug mode */
  DEBUG: createContextToken<boolean>('debug', false),
  
  /** Logger instance */
  LOGGER: createContextToken<Console>('logger'),
} as const;

// ============================================================================
// CONTEXT STORE
// ============================================================================

/**
 * Reactive context store with change notifications
 */
export class ContextStore<T> {
  private value: T;
  private subscribers = new Set<(value: T, previousValue: T) => void>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  /**
   * Get the current value
   */
  get(): T {
    return this.value;
  }

  /**
   * Set a new value
   */
  set(newValue: T): void {
    const previousValue = this.value;
    this.value = newValue;
    this.notifySubscribers(newValue, previousValue);
  }

  /**
   * Update the value using a function
   */
  update(updater: (current: T) => T): void {
    this.set(updater(this.value));
  }

  /**
   * Subscribe to value changes
   */
  subscribe(callback: (value: T, previousValue: T) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(value: T, previousValue: T): void {
    for (const subscriber of this.subscribers) {
      subscriber(value, previousValue);
    }
  }
}

// ============================================================================
// CONTEXT MAP
// ============================================================================

/**
 * Type-safe context map for storing multiple context values
 */
export class ContextMap {
  private stores = new Map<string, ContextStore<unknown>>();

  /**
   * Get or create a store for a token
   */
  getStore<T>(token: ContextToken<T>): ContextStore<T> {
    let store = this.stores.get(token.name);
    if (!store) {
      store = new ContextStore<unknown>(token.defaultValue);
      this.stores.set(token.name, store);
    }
    return store as ContextStore<T>;
  }

  /**
   * Get a value
   */
  get<T>(token: ContextToken<T>): T {
    return this.getStore(token).get();
  }

  /**
   * Set a value
   */
  set<T>(token: ContextToken<T>, value: T): void {
    this.getStore(token).set(value);
  }

  /**
   * Subscribe to value changes
   */
  subscribe<T>(token: ContextToken<T>, callback: (value: T, previousValue: T) => void): () => void {
    return this.getStore(token).subscribe(callback);
  }

  /**
   * Create a snapshot of all values
   */
  snapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, store] of this.stores) {
      result[key] = store.get();
    }
    return result;
  }

  /**
   * Restore from a snapshot
   */
  restore(snapshot: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(snapshot)) {
      const token = createContextToken<unknown>(key);
      this.set(token, value);
    }
  }
}

// ============================================================================
// CONTEXT SELECTOR
// ============================================================================

/**
 * Select and combine multiple context values
 */
export function selectContext<T extends readonly ContextToken<unknown>[], R>(
  provider: IContextProvider,
  tokens: T,
  selector: (...values: { [K in keyof T]: T[K] extends ContextToken<infer V> ? V : never }) => R
): R {
  const values = tokens.map((token) => provider.get(token)) as {
    [K in keyof T]: T[K] extends ContextToken<infer V> ? V : never;
  };
  return selector(...values);
}

// ============================================================================
// CONTEXT UTILS
// ============================================================================

/**
 * Create a context provider from a plain object
 */
export function fromObject(obj: Record<string, unknown>): ContextProvider {
  const provider = new ContextProvider();
  for (const [key, value] of Object.entries(obj)) {
    const token = createContextToken<unknown>(key);
    provider.provide(token, value);
  }
  return provider;
}

/**
 * Convert a context provider to a plain object
 */
export function toObject(provider: ContextProvider): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of provider.keys()) {
    const token = createContextToken<unknown>(key);
    result[key] = provider.getOptional(token);
  }
  return result;
}

/**
 * Merge multiple context providers
 */
export function mergeContexts(...providers: ContextProvider[]): ContextProvider {
  const merged = new ContextProvider();
  for (const provider of providers) {
    merged.merge(provider);
  }
  return merged;
}

// ============================================================================
// AGENT CONTEXT INJECTOR
// ============================================================================

/**
 * Inject context into agent prompts
 */
export class AgentContextInjector {
  constructor(private provider: IContextProvider) {}

  /**
   * Inject context values into a prompt template
   */
  inject(template: string, additionalContext?: Record<string, unknown>): string {
    let result = template;

    // Inject from provider
    const contextPattern = /\{context:([^}]+)\}/g;
    result = result.replace(contextPattern, (match, tokenName) => {
      const token = createContextToken<unknown>(tokenName);
      const value = this.provider.getOptional(token);
      if (value === undefined) {
        return match; // Keep original if not found
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });

    // Inject additional context
    if (additionalContext) {
      for (const [key, value] of Object.entries(additionalContext)) {
        const pattern = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(pattern, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    }

    return result;
  }

  /**
   * Create a context-aware prompt builder
   */
  createPromptBuilder(): ContextAwarePromptBuilder {
    return new ContextAwarePromptBuilder(this.provider);
  }
}

/**
 * Build prompts with context awareness
 */
export class ContextAwarePromptBuilder {
  private parts: string[] = [];

  constructor(private provider: IContextProvider) {}

  /**
   * Add a static text part
   */
  text(text: string): this {
    this.parts.push(text);
    return this;
  }

  /**
   * Add a context value
   */
  context<T>(token: ContextToken<T>, formatter?: (value: T) => string): this {
    const value = this.provider.get(token);
    const formatted = formatter ? formatter(value) : String(value);
    this.parts.push(formatted);
    return this;
  }

  /**
   * Add a context value if it exists
   */
  contextIf<T>(
    token: ContextToken<T>,
    formatter: (value: T) => string,
    fallback: string = ''
  ): this {
    const value = this.provider.getOptional(token);
    if (value !== undefined) {
      this.parts.push(formatter(value));
    } else if (fallback) {
      this.parts.push(fallback);
    }
    return this;
  }

  /**
   * Add a newline
   */
  newline(): this {
    this.parts.push('\n');
    return this;
  }

  /**
   * Build the final prompt
   */
  build(): string {
    return this.parts.join('');
  }
}
