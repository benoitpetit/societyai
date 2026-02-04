import { SocietyEventEmitter } from '../../observability/events';

describe('Event System', () => {
  let emitter: SocietyEventEmitter;

  beforeEach(() => {
    emitter = new SocietyEventEmitter();
  });

  test('should emit and receive events', async () => {
    const handler = jest.fn();
    emitter.on('society:start', handler);

    await emitter.emit('society:start', {
      workflowId: 'w1',
      workflowName: 'Test',
      input: 'in',
      agentCount: 1,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].workflowId).toBe('w1');
  });

  test('should support wildcard listeners', async () => {
    const handler = jest.fn();
    emitter.on('*', handler);

    await emitter.emit('debug', {
      level: 'info',
      message: 'test',
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should stop listening with off()', async () => {
    const handler = jest.fn();
    emitter.on('debug', handler);
    emitter.off('debug', handler);

    await emitter.emit('debug', {
      level: 'info',
      message: 'test',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  test('should handle history when enabled', async () => {
    emitter.enableHistory(5);

    for (let i = 0; i < 10; i++) {
      await emitter.emit('debug', { level: 'info', message: `msg-${i}` });
    }

    const history = emitter.getHistory();
    // Should be capped at 5
    expect(history).toHaveLength(5);
    // Should keep latest events (5-9)
    expect((history[4] as any).message).toBe('msg-9');
  });

  test('should filter history', async () => {
    emitter.enableHistory();

    await emitter.emit('debug', { level: 'info', message: 'a' });
    await emitter.emit('society:start', { workflowId: 'w1' } as any);

    const debugs = emitter.getHistory((e) => e.type === 'debug');
    expect(debugs).toHaveLength(1);
    expect(debugs[0].type).toBe('debug');
  });

  test('should clear history', async () => {
    emitter.enableHistory();
    await emitter.emit('debug', { level: 'info', message: 'm' });
    expect(emitter.getHistory()).toHaveLength(1);

    emitter.clearHistory();
    expect(emitter.getHistory()).toHaveLength(0);
  });

  test('waitFor should resolve when event occurs', async () => {
    const promise = emitter.waitFor('agent:complete', 100);

    setTimeout(async () => {
      await emitter.emit('agent:complete', {
        agentId: 'a1',
        modelName: 'gpt',
        result: 'ok',
        duration: 10,
      });
    }, 10);

    const event = await promise;
    expect(event.type).toBe('agent:complete');
  });

  test('waitFor should timeout if event does not occur', async () => {
    const promise = emitter.waitFor('agent:complete', 10);
    await expect(promise).rejects.toThrow('Timeout waiting for event');
  });
});
