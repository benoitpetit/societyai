/**
 * @fileoverview Coverage tests for ContextProvider, ContextProviderBuilder,
 * createContextToken, isContextToken, ContextScope, and related utilities.
 */

import {
  createContextToken,
  isContextToken,
  ContextProvider,
  ContextScope,
  CommonContexts,
  ContextStore,
  ContextMap,
} from '../../core/context';

describe('createContextToken', () => {
  it('creates a token with the given name', () => {
    const token = createContextToken<string>('myToken');
    expect(token.name).toBe('myToken');
  });

  it('stores a default value when provided', () => {
    const token = createContextToken<number>('count', 42);
    expect(token.defaultValue).toBe(42);
  });

  it('two tokens with the same name are distinct', () => {
    const t1 = createContextToken<string>('dup');
    const t2 = createContextToken<string>('dup');
    const provider = ContextProvider.empty();
    provider.provide(t1, 'value1');
    provider.provide(t2, 'value2');
    expect(provider.get(t1)).toBe('value1');
    expect(provider.get(t2)).toBe('value2');
  });
});

describe('isContextToken', () => {
  it('returns true for a real token', () => {
    const token = createContextToken<string>('x');
    expect(isContextToken(token)).toBe(true);
  });

  it('returns false for a plain object', () => {
    expect(isContextToken({ name: 'fake' })).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isContextToken(42)).toBe(false);
    expect(isContextToken(null)).toBe(false);
    expect(isContextToken(undefined)).toBe(false);
  });
});

describe('ContextProvider', () => {
  it('provides and retrieves a value', () => {
    const token = createContextToken<string>('greet');
    const provider = ContextProvider.empty();
    provider.provide(token, 'hello');
    expect(provider.get(token)).toBe('hello');
  });

  it('throws when token not provided', () => {
    const token = createContextToken<string>('missing');
    const provider = ContextProvider.empty();
    expect(() => provider.get(token)).toThrow('Context not provided: missing');
  });

  it('returns default value when token not provided', () => {
    const token = createContextToken<string>('defaulted', 'default!');
    const provider = ContextProvider.empty();
    expect(provider.get(token)).toBe('default!');
  });

  it('getOptional returns undefined for missing token', () => {
    const token = createContextToken<string>('opt');
    const provider = ContextProvider.empty();
    expect(provider.getOptional(token)).toBeUndefined();
  });

  it('getOptional returns value for present token', () => {
    const token = createContextToken<number>('n');
    const provider = ContextProvider.empty();
    provider.provide(token, 99);
    expect(provider.getOptional(token)).toBe(99);
  });

  it('has returns true when provided, false otherwise', () => {
    const t1 = createContextToken<string>('present');
    const t2 = createContextToken<string>('absent');
    const provider = ContextProvider.empty();
    provider.provide(t1, 'yes');
    expect(provider.has(t1)).toBe(true);
    expect(provider.has(t2)).toBe(false);
  });

  it('set updates a value', () => {
    const token = createContextToken<string>('mutable');
    const provider = ContextProvider.empty();
    provider.provide(token, 'initial');
    provider.set(token, 'updated');
    expect(provider.get(token)).toBe('updated');
  });

  it('delete removes a value', () => {
    const token = createContextToken<string>('del');
    const provider = ContextProvider.empty();
    provider.provide(token, 'val');
    const deleted = provider.delete(token);
    expect(deleted).toBe(true);
    expect(provider.has(token)).toBe(false);
  });

  it('delete returns false when token not present', () => {
    const token = createContextToken<string>('nope');
    const provider = ContextProvider.empty();
    expect(provider.delete(token)).toBe(false);
  });

  it('clear removes all values', () => {
    const t1 = createContextToken<string>('a');
    const t2 = createContextToken<string>('b');
    const provider = ContextProvider.empty();
    provider.provide(t1, 'x');
    provider.provide(t2, 'y');
    provider.clear();
    expect(provider.has(t1)).toBe(false);
    expect(provider.has(t2)).toBe(false);
  });

  it('provideFactory lazily initializes value', () => {
    let called = 0;
    const token = createContextToken<string>('lazy');
    const provider = ContextProvider.empty();
    provider.provideFactory(token, () => {
      called++;
      return 'from-factory';
    });
    // Not yet called
    expect(called).toBe(0);
    // Called on first get
    expect(provider.get(token)).toBe('from-factory');
    expect(called).toBe(1);
    // Cached on subsequent gets
    expect(provider.get(token)).toBe('from-factory');
    expect(called).toBe(1);
  });

  it('createChild inherits parent values', () => {
    const token = createContextToken<string>('parent-val');
    const parent = ContextProvider.empty();
    parent.provide(token, 'from-parent');
    const child = parent.createChild() as ContextProvider;
    expect(child.get(token)).toBe('from-parent');
  });

  it('createChild overrides parent values', () => {
    const token = createContextToken<string>('shared');
    const parent = ContextProvider.empty();
    parent.provide(token, 'parent-value');
    const child = parent.createChild() as ContextProvider;
    child.provide(token, 'child-value');
    expect(child.get(token)).toBe('child-value');
    // Parent is unchanged
    expect(parent.get(token)).toBe('parent-value');
  });

  it('child has() checks parent', () => {
    const token = createContextToken<string>('check');
    const parent = ContextProvider.empty();
    parent.provide(token, 'yes');
    const child = parent.createChild() as ContextProvider;
    expect(child.has(token)).toBe(true);
  });

  it('supports GLOBAL and AGENT scopes via provide', () => {
    const token = createContextToken<string>('scoped');
    const provider = ContextProvider.empty();
    provider.provide(token, 'value', ContextScope.GLOBAL);
    expect(provider.get(token)).toBe('value');
  });

  it('provideFactory with AGENT scope still works', () => {
    const token = createContextToken<number>('agent-lazy');
    const provider = ContextProvider.empty();
    provider.provideFactory(token, () => 7, ContextScope.AGENT);
    expect(provider.get(token)).toBe(7);
  });
});

describe('ContextProvider.create() builder', () => {
  it('builds a provider with provided values', () => {
    const token = createContextToken<string>('builder-token');
    const provider = ContextProvider.create().provide(token, 'built-value').build();
    expect(provider.get(token)).toBe('built-value');
  });

  it('builds a provider with factory values', () => {
    const token = createContextToken<number>('builder-factory');
    const provider = ContextProvider.create()
      .provideFactory(token, () => 123)
      .build();
    expect(provider.get(token)).toBe(123);
  });

  it('inherit() sets parent on the internal provider', () => {
    const token = createContextToken<string>('inherited');
    const parent = ContextProvider.empty();
    parent.provide(token, 'from-parent');
    const child = ContextProvider.create().inherit(parent).build();
    expect(child.get(token)).toBe('from-parent');
  });
});

describe('ContextProvider.keys()', () => {
  it('returns token names from the provider', () => {
    const t1 = createContextToken<string>('key-a');
    const t2 = createContextToken<string>('key-b');
    const provider = ContextProvider.empty();
    provider.provide(t1, 'x');
    provider.provide(t2, 'y');
    const keys = provider.keys();
    expect(keys).toContain('key-a');
    expect(keys).toContain('key-b');
  });

  it('includes parent keys in child', () => {
    const token = createContextToken<string>('parent-key');
    const parent = ContextProvider.empty();
    parent.provide(token, 'val');
    const child = parent.createChild();
    expect((child as ContextProvider).keys()).toContain('parent-key');
  });
});

describe('ContextProvider.merge()', () => {
  it('merges another provider into this one', () => {
    const t1 = createContextToken<string>('m1');
    const t2 = createContextToken<string>('m2');
    const p1 = ContextProvider.empty();
    const p2 = ContextProvider.empty();
    p1.provide(t1, 'from-p1');
    p2.provide(t2, 'from-p2');
    p1.merge(p2);
    expect(p1.get(t1)).toBe('from-p1');
    expect(p1.get(t2)).toBe('from-p2');
  });
});

describe('ContextProvider.freeze()', () => {
  it('returns an immutable view that still reads values', () => {
    const token = createContextToken<string>('frozen');
    const provider = ContextProvider.empty();
    provider.provide(token, 'ice');
    const frozen = provider.freeze();
    expect(frozen.get(token)).toBe('ice');
    expect(frozen.has(token)).toBe(true);
    expect(frozen.getOptional(token)).toBe('ice');
  });

  it('frozen.createChild() returns a working child', () => {
    const token = createContextToken<string>('fc');
    const provider = ContextProvider.empty();
    provider.provide(token, 'val');
    const frozen = provider.freeze();
    const child = frozen.createChild() as ContextProvider;
    expect(child.get(token)).toBe('val');
  });
});

describe('CommonContexts', () => {
  it('has default values for common tokens', () => {
    const provider = ContextProvider.empty();
    expect(provider.get(CommonContexts.INPUT)).toBe('');
    expect(provider.get(CommonContexts.DEBUG)).toBe(false);
    expect(provider.get(CommonContexts.TIMESTAMP)).toBe(0);
    expect(provider.get(CommonContexts.STEP_ID)).toBe('');
    expect(provider.get(CommonContexts.AGENT_ID)).toBe('');
    expect(provider.get(CommonContexts.WORKFLOW_ID)).toBe('');
    expect(provider.get(CommonContexts.PREVIOUS_RESULTS)).toEqual([]);
  });
});

describe('ContextStore', () => {
  it('stores and retrieves a value', () => {
    const store = new ContextStore<number>(10);
    expect(store.get()).toBe(10);
  });

  it('set updates the value', () => {
    const store = new ContextStore<string>('a');
    store.set('b');
    expect(store.get()).toBe('b');
  });

  it('update applies a function', () => {
    const store = new ContextStore<number>(5);
    store.update((n) => n * 2);
    expect(store.get()).toBe(10);
  });

  it('subscribe notifies on change', () => {
    const store = new ContextStore<number>(0);
    const history: number[] = [];
    const unsubscribe = store.subscribe((val) => history.push(val));
    store.set(1);
    store.set(2);
    unsubscribe();
    store.set(3); // should not notify
    expect(history).toEqual([1, 2]);
  });

  it('subscribe receives previous value', () => {
    const store = new ContextStore<string>('initial');
    let prev = '';
    store.subscribe((_v, p) => {
      prev = p;
    });
    store.set('next');
    expect(prev).toBe('initial');
  });
});

describe('ContextMap', () => {
  it('gets and sets values via tokens', () => {
    const map = new ContextMap();
    const token = createContextToken<string>('cm-key');
    map.set(token, 'hello');
    expect(map.get(token)).toBe('hello');
  });

  it('getStore returns the same store on repeated calls', () => {
    const map = new ContextMap();
    const token = createContextToken<number>('cm-n', 0);
    const s1 = map.getStore(token);
    const s2 = map.getStore(token);
    expect(s1).toBe(s2);
  });

  it('subscribe triggers on value change', () => {
    const map = new ContextMap();
    const token = createContextToken<number>('cm-sub', 0);
    const values: number[] = [];
    const unsub = map.subscribe(token, (v) => values.push(v));
    map.set(token, 42);
    unsub();
    map.set(token, 99);
    expect(values).toEqual([42]);
  });
});
