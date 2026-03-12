/**
 * Coverage tests for observability/logger.ts
 *
 * Targets: DefaultLogger (all log levels + format), getLogger, setLogger,
 *          setGlobalLogLevel, singleton pattern.
 */

import { DefaultLogger, getLogger, setLogger, setGlobalLogLevel } from '../../observability/logger';
import { LogLevel } from '../../core/config';

// ---------------------------------------------------------------------------
// DefaultLogger
// ---------------------------------------------------------------------------

describe('DefaultLogger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs info messages by default', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('hello');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[INFO] hello'));
  });

  it('does not log debug by default (level is INFO)', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    spy.mockClear();
    const logger = new DefaultLogger();
    logger.debug('debug msg');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs debug when level is set to DEBUG', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.setLevel(LogLevel.DEBUG);
    logger.debug('debug msg');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] debug msg'));
  });

  it('logs warn messages when level is WARN or higher', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.warn('warn msg');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[WARN] warn msg'));
  });

  it('does not log warn when level is ERROR', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    spy.mockClear();
    const logger = new DefaultLogger();
    logger.setLevel(LogLevel.ERROR);
    logger.warn('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs error messages', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.error('err msg');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] err msg'));
  });

  it('does not log info at WARN level', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    spy.mockClear();
    const logger = new DefaultLogger();
    logger.setLevel(LogLevel.WARN);
    logger.info('quiet');
    expect(spy).not.toHaveBeenCalled();
  });

  // format() tests

  it('formats message without args unchanged', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('plain message');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('plain message'));
  });

  it('substitutes %s placeholder', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('hello %s', 'world');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('hello world'));
  });

  it('substitutes %d placeholder', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('count %d', 42);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('count 42'));
  });

  it('substitutes %j placeholder with JSON', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('data %j', { key: 'value' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"key"'));
  });

  it('appends extra string args after placeholders', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('msg', 'extra1', 'extra2');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('extra1 extra2'));
  });

  it('appends extra object args as JSON', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    logger.info('msg', { foo: 'bar' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"foo"'));
  });

  it('handles unmatched placeholders gracefully', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new DefaultLogger();
    // More placeholders than args — leftover %s stays as-is
    logger.info('%s %s', 'only-one');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('only-one %s'));
  });

  it('setLevel() persists across subsequent calls', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Clear any prior calls accumulated by other tests in this describe
    logSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();

    const logger = new DefaultLogger();
    logger.setLevel(LogLevel.ERROR);

    logger.info('ignored');
    logger.warn('also ignored');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    logger.error('shown');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getLogger / setLogger / setGlobalLogLevel
// ---------------------------------------------------------------------------

describe('getLogger()', () => {
  it('returns a logger instance', () => {
    const logger = getLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('returns the same singleton on repeated calls', () => {
    const a = getLogger();
    const b = getLogger();
    expect(a).toBe(b);
  });
});

describe('setLogger()', () => {
  afterEach(() => {
    // Restore the default logger so other tests aren't affected
    setLogger(new DefaultLogger());
  });

  it('replaces the global logger', () => {
    const customLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLevel: jest.fn(),
    };
    setLogger(customLogger);
    expect(getLogger()).toBe(customLogger);
  });
});

describe('setGlobalLogLevel()', () => {
  it('sets the log level on the global logger', () => {
    const spy = jest.spyOn(getLogger(), 'setLevel');
    setGlobalLogLevel(LogLevel.DEBUG);
    expect(spy).toHaveBeenCalledWith(LogLevel.DEBUG);
    spy.mockRestore();
    // Reset to INFO
    setGlobalLogLevel(LogLevel.INFO);
  });
});
