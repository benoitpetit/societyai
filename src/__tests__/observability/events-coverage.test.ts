/**
 * Extended coverage tests for observability/events.ts
 *
 * Targets: once, onMany, onAll, removeAllListeners, emitCustom, filter,
 *          toObserver, listenerCount, waitFor, FilteredEventEmitter,
 *          ProgressTracker, EventLogger, EventAggregator, createEventEmitter,
 *          createProgressTracker, createEventLogger, disableHistory,
 *          setCorrelationId, safeCall (error paths)
 */

import {
  SocietyEventEmitter,
  FilteredEventEmitter,
  ProgressTracker,
  EventLogger,
  EventAggregator,
  createEventEmitter,
  createProgressTracker,
  createEventLogger,
} from '../../observability/events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmitter(): SocietyEventEmitter {
  return new SocietyEventEmitter();
}

// ---------------------------------------------------------------------------
// SocietyEventEmitter — basic subscription helpers
// ---------------------------------------------------------------------------

describe('SocietyEventEmitter — once()', () => {
  it('calls handler exactly once then auto-unsubscribes', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();

    emitter.once('debug', handler);
    emitter.emit('debug', { level: 'info', message: 'm1' });
    emitter.emit('debug', { level: 'info', message: 'm2' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].message).toBe('m1');
  });

  it('returns an unsubscribe function that works before first event', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();

    const unsub = emitter.once('debug', handler);
    unsub(); // cancel before any event fires
    emitter.emit('debug', { level: 'info', message: 'should not fire' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SocietyEventEmitter — onMany()', () => {
  it('subscribes to multiple event types with one call', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();

    emitter.onMany(['debug', 'progress'], handler);
    emitter.emit('debug', { level: 'info', message: 'd' });
    emitter.emit('progress', { percent: 50, phase: 'p' });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('returned unsubscribe removes all subscriptions', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();

    const unsub = emitter.onMany(['debug', 'progress'], handler);
    unsub();

    emitter.emit('debug', { level: 'info', message: 'd' });
    emitter.emit('progress', { percent: 10, phase: 'p' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SocietyEventEmitter — onAll()', () => {
  it('receives every event type', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();

    emitter.onAll(handler);
    emitter.emit('debug', { level: 'info', message: 'd' });
    emitter.emit('progress', { percent: 10, phase: 'p' });
    emitter.emit('agent:start', { agentId: 'a1', modelName: 'gpt', prompt: 'hello' });

    expect(handler).toHaveBeenCalledTimes(3);
  });
});

describe('SocietyEventEmitter — removeAllListeners()', () => {
  it('removes all listeners for a specific type', () => {
    const emitter = makeEmitter();
    const h1 = jest.fn();
    const h2 = jest.fn();

    emitter.on('debug', h1);
    emitter.on('debug', h2);
    emitter.removeAllListeners('debug');

    emitter.emit('debug', { level: 'info', message: 'm' });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('removes all listeners for all types when called without argument', () => {
    const emitter = makeEmitter();
    const h1 = jest.fn();
    const h2 = jest.fn();

    emitter.on('debug', h1);
    emitter.on('progress', h2);
    emitter.removeAllListeners();

    emitter.emit('debug', { level: 'info', message: 'm' });
    emitter.emit('progress', { percent: 10, phase: 'p' });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });
});

describe('SocietyEventEmitter — listenerCount()', () => {
  it('returns 0 when no listeners registered', () => {
    const emitter = makeEmitter();
    expect(emitter.listenerCount('debug')).toBe(0);
  });

  it('counts registered listeners correctly', () => {
    const emitter = makeEmitter();
    emitter.on('debug', jest.fn());
    emitter.on('debug', jest.fn());
    expect(emitter.listenerCount('debug')).toBe(2);
  });

  it('decrements after off()', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();
    emitter.on('debug', handler);
    emitter.off('debug', handler);
    expect(emitter.listenerCount('debug')).toBe(0);
  });
});

describe('SocietyEventEmitter — emitCustom()', () => {
  it('fires a custom event with name and data', () => {
    const emitter = makeEmitter();
    const handler = jest.fn();

    emitter.on('custom', handler);
    emitter.emitCustom('my-event', { value: 42 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].name).toBe('my-event');
    expect(handler.mock.calls[0][0].data).toEqual({ value: 42 });
  });
});

describe('SocietyEventEmitter — disableHistory() / setCorrelationId()', () => {
  it('disableHistory stops recording events', () => {
    const emitter = makeEmitter();
    emitter.enableHistory();
    emitter.emit('debug', { level: 'info', message: 'before' });
    emitter.disableHistory();
    emitter.emit('debug', { level: 'info', message: 'after' });

    // Only the first event is in history
    expect(emitter.getHistory()).toHaveLength(1);
  });

  it('setCorrelationId stamps events with the ID', () => {
    const emitter = makeEmitter();
    emitter.enableHistory();
    emitter.setCorrelationId('trace-123');
    emitter.emit('debug', { level: 'info', message: 'test' });

    const history = emitter.getHistory();
    expect(history[0].correlationId).toBe('trace-123');
  });
});

describe('SocietyEventEmitter — waitFor()', () => {
  it('resolves when event fires within timeout', async () => {
    const emitter = makeEmitter();
    const promise = emitter.waitFor('debug', 500);

    setTimeout(() => emitter.emit('debug', { level: 'info', message: 'hi' }), 10);

    const event = await promise;
    expect(event.type).toBe('debug');
  });

  it('resolves without timeout if no timeout given', async () => {
    const emitter = makeEmitter();
    const promise = emitter.waitFor('debug'); // no timeout

    emitter.emit('debug', { level: 'info', message: 'immediate' });
    const event = await promise;
    expect(event.type).toBe('debug');
  });
});

describe('SocietyEventEmitter — filter()', () => {
  it('returns a FilteredEventEmitter', () => {
    const emitter = makeEmitter();
    const filtered = emitter.filter((e) => e.type === 'debug');
    expect(filtered).toBeInstanceOf(FilteredEventEmitter);
  });
});

describe('SocietyEventEmitter — toObserver()', () => {
  it('returns an observer that emits lifecycle events', () => {
    const emitter = makeEmitter();
    const observer = emitter.toObserver();
    const handler = jest.fn();
    emitter.onAll(handler);

    observer.onSocietyStart('hello', 2);
    observer.onSocietyComplete('result');
    observer.onAgentStart('a1', 'gpt4', 'prompt');
    observer.onAgentComplete('a1', 'gpt4', 'output');
    observer.onAgentError('a1', 'gpt4', new Error('fail'));
    observer.onPhaseStart('phase1');
    observer.onPhaseComplete('phase1');

    expect(handler).toHaveBeenCalledTimes(7);
  });

  it('observer accumulates phase results', () => {
    const emitter = makeEmitter();
    const observer = emitter.toObserver();
    const taskCompleteEvents: unknown[] = [];

    emitter.on('task:complete', (e) => {
      taskCompleteEvents.push(e);
    });

    observer.onPhaseStart('research');
    observer.onAgentComplete('a1', 'gpt4', 'result1');
    observer.onPhaseComplete('research');

    expect(taskCompleteEvents).toHaveLength(1);
  });

  it('observer handles agentComplete without active phase', () => {
    const emitter = makeEmitter();
    const observer = emitter.toObserver();
    // No phase started — should not throw
    expect(() => observer.onAgentComplete('a1', 'gpt4', 'output')).not.toThrow();
  });
});

describe('SocietyEventEmitter — safeCall error handling', () => {
  it('swallows synchronous errors from handlers without propagating', () => {
    const emitter = makeEmitter();
    emitter.on('debug', () => {
      throw new Error('sync handler error');
    });

    // Should not throw
    expect(() => emitter.emit('debug', { level: 'info', message: 'test' })).not.toThrow();
  });

  it('handles rejected async handler promises', async () => {
    const emitter = makeEmitter();
    emitter.on('debug', async () => {
      throw new Error('async handler error');
    });

    // Should not throw or reject
    await expect(
      Promise.resolve(emitter.emit('debug', { level: 'info', message: 'test' }))
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FilteredEventEmitter
// ---------------------------------------------------------------------------

describe('FilteredEventEmitter', () => {
  it('on() only delivers events matching the predicate', () => {
    const emitter = makeEmitter();
    const filtered = emitter.filter((e) => e.type === 'debug');
    const handler = jest.fn();

    filtered.on('debug', handler);
    emitter.emit('debug', { level: 'info', message: 'yes' });
    emitter.emit('debug', { level: 'error', message: 'no' });

    // Both are 'debug' type — but our predicate just checks type, so both should pass
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('on() returns unsubscribe function', () => {
    const emitter = makeEmitter();
    const filtered = emitter.filter(() => true);
    const handler = jest.fn();

    const unsub = filtered.on('debug', handler);
    unsub();

    emitter.emit('debug', { level: 'info', message: 'should not fire' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('onAll() delivers all events matching predicate', () => {
    const emitter = makeEmitter();
    const filtered = emitter.filter((e) => e.type !== 'progress');
    const handler = jest.fn();

    filtered.onAll(handler);
    emitter.emit('debug', { level: 'info', message: 'd' });
    emitter.emit('progress', { percent: 50, phase: 'p' }); // filtered out

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe('debug');
  });

  it('can be constructed directly', () => {
    const emitter = makeEmitter();
    const filtered = new FilteredEventEmitter(emitter, () => true);
    expect(filtered).toBeInstanceOf(FilteredEventEmitter);
  });
});

// ---------------------------------------------------------------------------
// ProgressTracker
// ---------------------------------------------------------------------------

describe('ProgressTracker', () => {
  it('start() emits progress at 0%', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const handler = jest.fn();

    emitter.on('progress', handler);
    tracker.start(10);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].percent).toBe(0);
  });

  it('increment() advances progress', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const percents: number[] = [];

    emitter.on('progress', (e) => {
      percents.push(e.percent);
    });
    tracker.start(4); // 0%
    tracker.increment(); // 25%
    tracker.increment(2); // 75%

    expect(percents).toEqual([0, 25, 75]);
  });

  it('increment() does not exceed 100%', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const percents: number[] = [];

    emitter.on('progress', (e) => {
      percents.push(e.percent);
    });
    tracker.start(2);
    tracker.increment(100); // clamped to totalSteps=2

    expect(percents[percents.length - 1]).toBe(100);
  });

  it('setProgress() sets absolute progress', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const handler = jest.fn();

    emitter.on('progress', handler);
    tracker.start(10);
    tracker.setProgress(5);

    const last = handler.mock.calls[handler.mock.calls.length - 1][0];
    expect(last.percent).toBe(50);
  });

  it('setPhase() updates phase in progress events', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const handler = jest.fn();

    emitter.on('progress', handler);
    tracker.start(2);
    tracker.setPhase('analysis');
    tracker.increment();

    const last = handler.mock.calls[handler.mock.calls.length - 1][0];
    expect(last.phase).toBe('analysis');
  });

  it('complete() sets progress to 100%', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const handler = jest.fn();

    emitter.on('progress', handler);
    tracker.start(5);
    tracker.complete();

    const last = handler.mock.calls[handler.mock.calls.length - 1][0];
    expect(last.percent).toBe(100);
  });

  it('getPercent() returns 0 when totalSteps is 0', () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    expect(tracker.getPercent()).toBe(0);
  });

  it('emits estimatedTimeRemaining when progress is partial', async () => {
    const emitter = makeEmitter();
    const tracker = new ProgressTracker(emitter);
    const events: { estimatedTimeRemaining?: number }[] = [];

    emitter.on('progress', (e) => {
      events.push(e);
    });
    tracker.start(10);
    // Wait a tiny bit so elapsed > 0
    await new Promise((r) => setTimeout(r, 5));
    tracker.increment(5); // 50%

    const last = events[events.length - 1];
    // Should have estimatedTimeRemaining defined (may be 0 or positive)
    expect('estimatedTimeRemaining' in last).toBe(true);
  });

  it('createProgressTracker factory returns ProgressTracker', () => {
    const emitter = makeEmitter();
    const tracker = createProgressTracker(emitter);
    expect(tracker).toBeInstanceOf(ProgressTracker);
  });
});

// ---------------------------------------------------------------------------
// EventLogger
// ---------------------------------------------------------------------------

describe('EventLogger', () => {
  function makeLogger(): { log: jest.Mock; error: jest.Mock; warn: jest.Mock; info: jest.Mock } {
    const log = jest.fn();
    const error = jest.fn();
    const warn = jest.fn();
    const info = jest.fn();
    return { log, error, warn, info };
  }

  it('start() logs society:start event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('society:start', {
      workflowId: 'w1',
      workflowName: 'Test',
      input: 'i',
      agentCount: 3,
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain('Test');
  });

  it('logs society:complete event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('society:complete', {
      workflowId: 'w1',
      workflowName: 'Test',
      result: {
        success: true,
        output: 'done',
        taskResults: new Map(),
        messages: [],
        duration: 100,
      },
      duration: 100,
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain('100ms');
  });

  it('logs society:error event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('society:error', {
      workflowId: 'w1',
      workflowName: 'Test',
      error: new Error('boom'),
    });

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs task:start event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('task:start', {
      stepName: 'step1',
      agentIds: ['a1'],
      executionType: 'sequential',
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain('step1');
  });

  it('logs task:complete event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('task:complete', { stepName: 'step1', results: [], duration: 50 });
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('logs task:error event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('task:error', {
      stepName: 'step1',
      error: new Error('step fail'),
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs agent:start event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('agent:start', { agentId: 'a1', modelName: 'gpt', prompt: 'hello' });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain('a1');
  });

  it('logs agent:complete event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('agent:complete', { agentId: 'a1', modelName: 'gpt', result: 'ok', duration: 20 });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain('20ms');
  });

  it('logs agent:error event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('agent:error', { agentId: 'a1', modelName: 'gpt', error: new Error('oops') });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs progress event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('progress', { percent: 50, phase: 'analysis' });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain('50%');
  });

  it('logs debug event at info level', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('debug', { level: 'info', message: 'debug msg' });
    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  it('logs debug event at warn level', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('debug', { level: 'warn', message: 'warn msg' });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('logs debug event at error level', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emit('debug', { level: 'error', message: 'error msg' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs custom (default) event', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();

    emitter.emitCustom('my-event', { foo: 'bar' });
    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  it('stop() prevents further logging', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start();
    el.stop();

    emitter.emit('debug', { level: 'info', message: 'after stop' });
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('with filter: only logs matching events', () => {
    const emitter = makeEmitter();
    const logger = makeLogger();
    const el = new EventLogger(emitter, logger);
    el.start((e) => e.type === 'progress');

    emitter.emit('debug', { level: 'info', message: 'ignored' });
    emitter.emit('progress', { percent: 10, phase: 'p' });

    // Only progress should be logged
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('uses console as default logger', () => {
    const emitter = makeEmitter();
    // Just verify construction with defaults does not throw
    expect(() => new EventLogger(emitter)).not.toThrow();
  });

  it('createEventLogger factory works', () => {
    const emitter = makeEmitter();
    const el = createEventLogger(emitter);
    expect(el).toBeInstanceOf(EventLogger);
  });
});

// ---------------------------------------------------------------------------
// EventAggregator
// ---------------------------------------------------------------------------

describe('EventAggregator', () => {
  it('can be constructed without emitter', () => {
    const agg = new EventAggregator();
    expect(agg.getSummary().totalEvents).toBe(0);
  });

  it('can be constructed with emitter and auto-collects events', () => {
    const emitter = makeEmitter();
    const agg = new EventAggregator(emitter);

    emitter.emit('debug', { level: 'info', message: 'm' });
    emitter.emit('progress', { percent: 50, phase: 'p' });

    expect(agg.getSummary().totalEvents).toBe(2);
  });

  it('add() manually adds events', () => {
    const agg = new EventAggregator();
    agg.add({
      type: 'debug',
      timestamp: Date.now(),
      level: 'info',
      message: 'manual',
    } as Parameters<typeof agg.add>[0]);
    expect(agg.getSummary().totalEvents).toBe(1);
  });

  it('getSummary() counts by category', () => {
    const emitter = makeEmitter();
    const agg = new EventAggregator(emitter);

    emitter.emit('society:start', {
      workflowId: 'w1',
      workflowName: 'W',
      input: 'i',
      agentCount: 1,
    });
    emitter.emit('task:start', { stepName: 's', agentIds: [], executionType: 'seq' });
    emitter.emit('agent:start', { agentId: 'a', modelName: 'gpt', prompt: 'p' });
    emitter.emit('agent:complete', { agentId: 'a', modelName: 'gpt', result: 'r', duration: 10 });
    emitter.emit('agent:error', { agentId: 'a', modelName: 'gpt', error: new Error('e') });

    const summary = agg.getSummary();
    expect(summary.societyCount).toBe(1);
    expect(summary.taskCount).toBe(1);
    expect(summary.agentCount).toBe(3);
    expect(summary.errorCount).toBe(1);
    expect(summary.avgAgentDuration).toBe(10);
    expect(summary.minAgentDuration).toBe(10);
    expect(summary.maxAgentDuration).toBe(10);
  });

  it('getSummary() handles empty durations gracefully', () => {
    const agg = new EventAggregator();
    const summary = agg.getSummary();
    expect(summary.avgAgentDuration).toBe(0);
    expect(summary.minAgentDuration).toBe(0);
    expect(summary.maxAgentDuration).toBe(0);
  });

  it('getByType() returns filtered events', () => {
    const emitter = makeEmitter();
    const agg = new EventAggregator(emitter);

    emitter.emit('debug', { level: 'info', message: 'a' });
    emitter.emit('debug', { level: 'warn', message: 'b' });
    emitter.emit('progress', { percent: 50, phase: 'p' });

    const debugs = agg.getByType('debug');
    expect(debugs).toHaveLength(2);
  });

  it('clear() empties all events', () => {
    const emitter = makeEmitter();
    const agg = new EventAggregator(emitter);

    emitter.emit('debug', { level: 'info', message: 'm' });
    expect(agg.getSummary().totalEvents).toBe(1);

    agg.clear();
    expect(agg.getSummary().totalEvents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

describe('createEventEmitter()', () => {
  it('returns a SocietyEventEmitter instance', () => {
    const emitter = createEventEmitter();
    expect(emitter).toBeInstanceOf(SocietyEventEmitter);
  });
});
