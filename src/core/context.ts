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
 * Each token carries a unique symbol key used as the Map key in
 * ContextProvider.  Two calls to `createContextToken('foo')` therefore
 * produce two independent tokens even if they share the same human-readable
 * name — preventing silent type collisions.
 */
const TOKEN_KEY = Symbol('TokenKey');

/**
 * Context token - a type-safe key for context values
 */
export interface ContextToken<T> {
  /** Token symbol for identification */
  readonly [CONTEXT_TOKEN_SYMBOL]: true;
  /** Unique symbol used as the registry key — prevents name collisions */
  readonly [TOKEN_KEY]: symbol;
  /** Token name for debugging */
  readonly name: string;
  /** Default value (optional) */
  readonly defaultValue?: T;
  /** Phantom type for TypeScript */
  readonly _type?: T;
}

/**
 * Create a context token with a specific type.
 *
 * Every call returns a **distinct** token object — even if two tokens share
 * the same `name` string they will never collide in a {@link ContextProvider}.
 *
 * @example
 * ```typescript
 * // Safe: different token objects, no collision
 * const StrToken = createContextToken<string>('config');
 * const NumToken = createContextToken<number>('config');
 * provider.provide(StrToken, 'hello');
 * provider.provide(NumToken, 42);
 * provider.get(StrToken); // 'hello'
 * provider.get(NumToken); // 42
 * ```
 */
export function createContextToken<T>(name: string, defaultValue?: T): ContextToken<T> {
  return {
    [CONTEXT_TOKEN_SYMBOL]: true,
    [TOKEN_KEY]: Symbol(name),
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
  /** Human-readable token name, kept for serialisation (keys() / toObject()) */
  tokenName: string;
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
  private contexts = new Map<symbol, ContextEntry<unknown>>();
  /** Name → symbol index to support name-based lookup (fromObject, toObject, inject, restore) */
  private nameIndex = new Map<string, symbol>();
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
    this.contexts.set(token[TOKEN_KEY], {
      value,
      scope,
      isFactory: false,
      initialized: true,
      cachedValue: value,
      tokenName: token.name,
    });
    this.nameIndex.set(token.name, token[TOKEN_KEY]);
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
    this.contexts.set(token[TOKEN_KEY], {
      value: factory,
      scope,
      isFactory: true,
      initialized: false,
      tokenName: token.name,
    });
    this.nameIndex.set(token.name, token[TOKEN_KEY]);
    return this;
  }

  /**
   * Get a context value
   */
  get<T>(token: ContextToken<T>): T {
    let entry = this.contexts.get(token[TOKEN_KEY]) as ContextEntry<T> | undefined;

    // Fall back to name-based lookup (supports provideAll/fromObject round-trips)
    if (!entry) {
      const sym = this.nameIndex.get(token.name);
      if (sym !== undefined) {
        entry = this.contexts.get(sym) as ContextEntry<T> | undefined;
      }
    }

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
    if (this.contexts.has(token[TOKEN_KEY])) {
      return true;
    }
    return this.parent?.has(token) ?? false;
  }

  /**
   * Set a context value
   */
  set<T>(token: ContextToken<T>, value: T): void {
    const existing = this.contexts.get(token[TOKEN_KEY]);
    this.contexts.set(token[TOKEN_KEY], {
      value,
      scope: existing?.scope ?? ContextScope.WORKFLOW,
      isFactory: false,
      initialized: true,
      cachedValue: value,
      tokenName: token.name,
    });
    this.nameIndex.set(token.name, token[TOKEN_KEY]);
  }

  /**
   * Delete a context value
   */
  delete<T>(token: ContextToken<T>): boolean {
    this.nameIndex.delete(token.name);
    return this.contexts.delete(token[TOKEN_KEY]);
  }

  /**
   * Clear all context values
   */
  clear(): void {
    this.contexts.clear();
    this.nameIndex.clear();
  }

  /**
   * Get a value by token name (for serialisation helpers: toObject, inject)
   */
  getByName(name: string): unknown {
    const sym = this.nameIndex.get(name);
    if (sym !== undefined) {
      const entry = this.contexts.get(sym) as ContextEntry<unknown> | undefined;
      if (entry) {
        if (entry.isFactory && !entry.initialized) {
          entry.cachedValue = (entry.value as () => unknown)();
          entry.initialized = true;
        }
        return entry.cachedValue;
      }
    }
    return this.parent?.getByName(name);
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
    const ownKeys = [...this.contexts.values()].map((entry) => entry.tokenName);
    return [...new Set([...parentKeys, ...ownKeys])];
  }

  /**
   * Merge another context provider into this one
   */
  merge(other: ContextProvider): this {
    for (const [key, entry] of other.contexts) {
      this.contexts.set(key, { ...entry });
      this.nameIndex.set(entry.tokenName, key);
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
  private stores = new Map<symbol, ContextStore<unknown>>();
  private storeNames = new Map<symbol, string>();
  /** Name → symbol index to support name-based lookup (restore, snapshot round-trips) */
  private nameIndex = new Map<string, symbol>();

  /**
   * Get or create a store for a token
   */
  getStore<T>(token: ContextToken<T>): ContextStore<T> {
    // First try by exact token symbol
    let store = this.stores.get(token[TOKEN_KEY]);
    if (!store) {
      // Fall back to name-based lookup (supports restore() round-trips)
      const existingSym = this.nameIndex.get(token.name);
      if (existingSym !== undefined) {
        store = this.stores.get(existingSym);
      }
    }
    if (!store) {
      store = new ContextStore<unknown>(token.defaultValue);
      this.stores.set(token[TOKEN_KEY], store);
      this.storeNames.set(token[TOKEN_KEY], token.name);
      this.nameIndex.set(token.name, token[TOKEN_KEY]);
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
      const name = this.storeNames.get(key) ?? String(key);
      result[name] = store.get();
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
    result[key] = provider.getByName(key);
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

    // Inject from provider — use name-based lookup when available (ContextProvider)
    // so that provideAll/fromObject-populated values are found correctly.
    const contextPattern = /\{context:([^}]+)\}/g;
    result = result.replace(contextPattern, (match, tokenName) => {
      let value: unknown;
      if (this.provider instanceof ContextProvider) {
        value = this.provider.getByName(tokenName);
      } else {
        const token = createContextToken<unknown>(tokenName);
        value = this.provider.getOptional(token);
      }
      if (value === undefined) {
        return match; // Keep original if not found
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });

    // Inject additional context — escape regex metacharacters in the key so
    // that keys like "foo.bar" or "a+b" don't corrupt the regex pattern.
    if (additionalContext) {
      for (const [key, value] of Object.entries(additionalContext)) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\{${escapedKey}\\}`, 'g');
        result = result.replace(
          pattern,
          typeof value === 'object' ? JSON.stringify(value) : String(value)
        );
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
