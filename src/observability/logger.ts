import { Logger, LogLevel } from '../core/config';

/**
 * Default Logger implementation
 */
export class DefaultLogger implements Logger {
  private level: LogLevel = LogLevel.INFO;

  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${this.format(message, args)}`);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`[INFO] ${this.format(message, args)}`);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${this.format(message, args)}`);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${this.format(message, args)}`);
    }
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Format a message with its arguments
   */
  private format(message: string, args: unknown[]): string {
    if (args.length === 0) {
      return message;
    }

    // Replace %s, %d, %j placeholders in the message
    let formatted = message;
    let argIndex = 0;

    formatted = formatted.replace(/%[sdj]/g, (match) => {
      if (argIndex >= args.length) {
        return match;
      }

      const arg = args[argIndex++];

      switch (match) {
        case '%s':
          return String(arg);
        case '%d':
          return String(Number(arg));
        case '%j':
          return JSON.stringify(arg);
        default:
          return match;
      }
    });

    // Append any remaining arguments
    if (argIndex < args.length) {
      const remaining = args.slice(argIndex).map((arg) => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg);
        }
        return String(arg);
      });
      formatted += ' ' + remaining.join(' ');
    }

    return formatted;
  }
}

// Singleton logger instance
let loggerInstance: Logger | null = null;

/**
 * Returns the singleton logger instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new DefaultLogger();
  }
  return loggerInstance;
}

/**
 * Sets the global logger
 */
export function setLogger(logger: Logger): void {
  loggerInstance = logger;
}

/**
 * Sets the global log level
 */
export function setGlobalLogLevel(level: LogLevel): void {
  getLogger().setLevel(level);
}
