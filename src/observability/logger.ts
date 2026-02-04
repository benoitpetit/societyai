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

    // Remplacer les %s, %d, %j dans le message
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

    // Ajouter les arguments restants
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

// Instance singleton du logger
let loggerInstance: Logger | null = null;

/**
 * Retourne l'instance singleton du logger
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new DefaultLogger();
  }
  return loggerInstance;
}

/**
 * Définit le logger global
 */
export function setLogger(logger: Logger): void {
  loggerInstance = logger;
}

/**
 * Définit le niveau de log global
 */
export function setGlobalLogLevel(level: LogLevel): void {
  getLogger().setLevel(level);
}
