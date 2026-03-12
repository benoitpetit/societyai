/**
 * Extended coverage tests for context.ts
 *
 * Targets uncovered lines: 373-377, 534-548, 565-568, 579-584, 591-596,
 * 603-607, 618-657, 665-716
 */

import {
  createContextToken,
  isContextToken,
  ContextProvider,
  ContextProviderBuilder,
  ContextScope,
  ContextStore,
  ContextMap,
  selectContext,
  fromObject,
  toObject,
  mergeContexts,
  AgentContextInjector,
  ContextAwarePromptBuilder,
  CommonContexts,
} from '../../core/context';

// ============================================================================
// ContextStore
// ============================================================================

describe('ContextStore', () => {
  it('gets and sets values', () => {
    const store = new ContextStore(10);
    expect(store.get()).toBe(10);
    store.set(20);
    expect(store.get()).toBe(20);
  });

  it('update() transforms the value', () => {
    const store = new ContextStore(5);
    store.update((v) => v * 2);
    expect(store.get()).toBe(10);
  });

  it('subscribe() receives change notifications', () => {
    const store = new ContextStore('a');
    const calls: [string, string][] = [];
    store.subscribe((v, prev) => calls.push([v, prev]));
    store.set('b');
    store.set('c');
    expect(calls).toEqual([
      ['b', 'a'],
      ['c', 'b'],
    ]);
  });

  it('subscribe() returns an unsubscribe function', () => {
    const store = new ContextStore(0);
    const calls: number[] = [];
    const unsub = store.subscribe((v) => calls.push(v));
    store.set(1);
    unsub();
    store.set(2);
    expect(calls).toEqual([1]); // Only received value before unsubscribe
  });
});

// ============================================================================
// ContextMap
// ============================================================================

describe('ContextMap', () => {
  it('get/set with token', () => {
    const map = new ContextMap();
    const token = createContextToken<number>('mapNum', 0);
    map.set(token, 42);
    expect(map.get(token)).toBe(42);
  });

  it('returns default value when not set', () => {
    const map = new ContextMap();
    const token = createContextToken<string>('mapStr', 'default');
    expect(map.get(token)).toBe('default');
  });

  it('subscribe to token changes', () => {
    const map = new ContextMap();
    const token = createContextToken<number>('mapSub', 0);
    const received: number[] = [];
    map.subscribe(token, (v) => received.push(v));
    map.set(token, 1);
    map.set(token, 2);
    expect(received).toEqual([1, 2]);
  });

  it('snapshot() captures all values', () => {
    const map = new ContextMap();
    const t1 = createContextToken<string>('snap1', 'a');
    const t2 = createContextToken<number>('snap2', 0);
    map.set(t1, 'hello');
    map.set(t2, 99);
    const snap = map.snapshot();
    expect(snap['snap1']).toBe('hello');
    expect(snap['snap2']).toBe(99);
  });

  it('restore() sets values from snapshot', () => {
    const map = new ContextMap();
    const snapshot = { myKey: 'restored' };
    map.restore(snapshot);
    const token = createContextToken<unknown>('myKey');
    expect(map.get(token)).toBe('restored');
  });
});

// ============================================================================
// ContextProviderBuilder
// ============================================================================

describe('ContextProviderBuilder', () => {
  it('provideAll() provides multiple values', () => {
    const token1 = createContextToken<unknown>('pa_x');
    const token2 = createContextToken<unknown>('pa_y');
    const provider = new ContextProviderBuilder().provideAll({ pa_x: 10, pa_y: 20 }).build();
    expect(provider.getOptional(token1)).toBe(10);
    expect(provider.getOptional(token2)).toBe(20);
  });

  it('inherit() creates a child context', () => {
    const parentToken = createContextToken<string>('inh_parent', 'from-parent');
    const parent = ContextProvider.create().provide(parentToken, 'from-parent').build();
    const child = new ContextProviderBuilder().inherit(parent).build();
    expect(child.getOptional(parentToken)).toBe('from-parent');
  });

  it('provideFactory() with custom scope', () => {
    const token = createContextToken<number>('factory_num');
    let calls = 0;
    const provider = new ContextProviderBuilder()
      .provideFactory(token, () => ++calls, ContextScope.AGENT)
      .build();
    const v1 = provider.get(token);
    const v2 = provider.get(token);
    expect(v1).toBe(1);
    expect(v2).toBe(1); // factory is called once, result cached
  });
});

// ============================================================================
// selectContext
// ============================================================================

describe('selectContext', () => {
  it('combines multiple context values', () => {
    const tA = createContextToken<number>('sel_a', 5);
    const tB = createContextToken<number>('sel_b', 3);
    const provider = ContextProvider.create().provide(tA, 5).provide(tB, 3).build();
    const result = selectContext(provider, [tA, tB] as const, (a, b) => a + b);
    expect(result).toBe(8);
  });
});

// ============================================================================
// fromObject / toObject
// ============================================================================

describe('fromObject / toObject', () => {
  it('fromObject creates a provider with the given values', () => {
    const provider = fromObject({ greeting: 'hello', count: 42 });
    const greetToken = createContextToken<unknown>('greeting');
    expect(provider.getOptional(greetToken)).toBe('hello');
  });

  it('toObject round-trips values', () => {
    const provider = fromObject({ foo: 'bar', num: 7 });
    const obj = toObject(provider);
    expect(obj['foo']).toBe('bar');
    expect(obj['num']).toBe(7);
  });
});

// ============================================================================
// mergeContexts
// ============================================================================

describe('mergeContexts', () => {
  it('merges values from multiple providers', () => {
    const tA = createContextToken<string>('mg_a');
    const tB = createContextToken<string>('mg_b');
    const p1 = ContextProvider.create().provide(tA, 'from-p1').build();
    const p2 = ContextProvider.create().provide(tB, 'from-p2').build();
    const merged = mergeContexts(p1, p2);
    expect(merged.getOptional(tA)).toBe('from-p1');
    expect(merged.getOptional(tB)).toBe('from-p2');
  });

  it('later provider overrides earlier for same token', () => {
    const t = createContextToken<string>('mg_override');
    const p1 = ContextProvider.create().provide(t, 'first').build();
    const p2 = ContextProvider.create().provide(t, 'second').build();
    const merged = mergeContexts(p1, p2);
    expect(merged.getOptional(t)).toBe('second');
  });
});

// ============================================================================
// AgentContextInjector
// ============================================================================

describe('AgentContextInjector', () => {
  it('injects context tokens from provider', () => {
    const token = createContextToken<string>('myUser');
    const provider = ContextProvider.create().provide(token, 'Alice').build();
    const injector = new AgentContextInjector(provider);
    const result = injector.inject('Hello {context:myUser}!');
    expect(result).toBe('Hello Alice!');
  });

  it('keeps placeholder if token not found', () => {
    const provider = ContextProvider.create().build();
    const injector = new AgentContextInjector(provider);
    const result = injector.inject('Hello {context:unknown}!');
    expect(result).toBe('Hello {context:unknown}!');
  });

  it('injects object values as JSON', () => {
    const token = createContextToken<object>('myObj');
    const provider = ContextProvider.create().provide(token, { x: 1 }).build();
    const injector = new AgentContextInjector(provider);
    const result = injector.inject('{context:myObj}');
    expect(result).toBe('{"x":1}');
  });

  it('injects additionalContext values', () => {
    const provider = ContextProvider.create().build();
    const injector = new AgentContextInjector(provider);
    const result = injector.inject('{name} is {age}', { name: 'Bob', age: 30 });
    expect(result).toBe('Bob is 30');
  });

  it('escapes regex metacharacters in additionalContext keys', () => {
    const provider = ContextProvider.create().build();
    const injector = new AgentContextInjector(provider);
    // Key contains regex special chars
    const result = injector.inject('{a.b}', { 'a.b': 'dotted' });
    expect(result).toBe('dotted');
  });

  it('injects additionalContext objects as JSON', () => {
    const provider = ContextProvider.create().build();
    const injector = new AgentContextInjector(provider);
    const result = injector.inject('{data}', { data: { key: 'val' } });
    expect(result).toBe('{"key":"val"}');
  });

  it('createPromptBuilder() returns ContextAwarePromptBuilder', () => {
    const provider = ContextProvider.create().build();
    const injector = new AgentContextInjector(provider);
    const builder = injector.createPromptBuilder();
    expect(builder).toBeInstanceOf(ContextAwarePromptBuilder);
  });
});

// ============================================================================
// ContextAwarePromptBuilder
// ============================================================================

describe('ContextAwarePromptBuilder', () => {
  it('builds prompt from text parts', () => {
    const provider = ContextProvider.create().build();
    const result = new ContextAwarePromptBuilder(provider).text('Hello ').text('World').build();
    expect(result).toBe('Hello World');
  });

  it('context() adds formatted context value', () => {
    const token = createContextToken<string>('pb_name', 'Alice');
    const provider = ContextProvider.create().provide(token, 'Alice').build();
    const result = new ContextAwarePromptBuilder(provider)
      .context(token, (v) => `Name: ${v}`)
      .build();
    expect(result).toBe('Name: Alice');
  });

  it('context() uses String() for non-formatter case', () => {
    const token = createContextToken<number>('pb_num', 0);
    const provider = ContextProvider.create().provide(token, 42).build();
    const result = new ContextAwarePromptBuilder(provider).context(token).build();
    expect(result).toBe('42');
  });

  it('contextIf() adds value when token exists', () => {
    const token = createContextToken<string>('pb_if', 'yes');
    const provider = ContextProvider.create().provide(token, 'yes').build();
    const result = new ContextAwarePromptBuilder(provider)
      .contextIf(token, (v) => `Found: ${v}`)
      .build();
    expect(result).toBe('Found: yes');
  });

  it('contextIf() uses fallback when token not found', () => {
    const token = createContextToken<string>('pb_noexist');
    const provider = ContextProvider.create().build();
    const result = new ContextAwarePromptBuilder(provider)
      .contextIf(token, (v) => `Found: ${v}`, 'default-value')
      .build();
    expect(result).toBe('default-value');
  });

  it('contextIf() outputs nothing when not found and no fallback', () => {
    const token = createContextToken<string>('pb_empty_fallback');
    const provider = ContextProvider.create().build();
    const result = new ContextAwarePromptBuilder(provider).contextIf(token, (v) => v).build();
    expect(result).toBe('');
  });

  it('newline() adds a newline separator', () => {
    const provider = ContextProvider.create().build();
    const result = new ContextAwarePromptBuilder(provider).text('A').newline().text('B').build();
    expect(result).toBe('A\nB');
  });
});

// ============================================================================
// CommonContexts
// ============================================================================

describe('CommonContexts', () => {
  it('predefined tokens are valid ContextTokens', () => {
    expect(isContextToken(CommonContexts.INPUT)).toBe(true);
    expect(isContextToken(CommonContexts.STEP_ID)).toBe(true);
    expect(isContextToken(CommonContexts.AGENT_ID)).toBe(true);
    expect(isContextToken(CommonContexts.WORKFLOW_ID)).toBe(true);
    expect(isContextToken(CommonContexts.TIMESTAMP)).toBe(true);
    expect(isContextToken(CommonContexts.PREVIOUS_RESULTS)).toBe(true);
    expect(isContextToken(CommonContexts.SHARED_DATA)).toBe(true);
    expect(isContextToken(CommonContexts.DEBUG)).toBe(true);
    expect(isContextToken(CommonContexts.LOGGER)).toBe(true);
  });

  it('default values are correct', () => {
    expect(CommonContexts.INPUT.defaultValue).toBe('');
    expect(CommonContexts.DEBUG.defaultValue).toBe(false);
    expect(CommonContexts.TIMESTAMP.defaultValue).toBe(0);
  });
});
