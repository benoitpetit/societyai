import type { ModelAdapter } from './types';

/**
 * Retry options for AI model calls
 */
export interface RetryOptions {
  /**
   * Maximum number of attempts before giving up
   */
  maxRetries: number;

  /**
   * Initial delay before the first retry (in ms)
   */
  initialBackoff: number;

  /**
   * Maximum delay between two attempts (in ms)
   */
  maxBackoff: number;

  /**
   * Backoff multiplier applied on each retry
   */
  backoffFactor: number;

  /**
   * Add random jitter to the backoff delay
   */
  jitter: boolean;
}

/**
 * Log level
 */
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

/**
 * Logger interface
 */
export interface Logger {
  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void;

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void;

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void;

  /**
   * Log an error message
   */
  error(message: string, ...args: unknown[]): void;

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void;
}

/**
 * Chat message in an exchange
 */
export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Structured prompt used by some models
 */
export interface StructuredPrompt {
  system?: string;
  user?: string;
  messages?: ChatMessage[];
  options?: Record<string, unknown>;
}

/**
 * Standard options for AI models
 */
export interface StandardModelOptions {
  /**
   * Model name
   */
  name: string;

  /**
   * Timeout for model calls (in ms)
   */
  timeout: number;

  /**
   * Retry options for this model
   */
  retryOptions: RetryOptions;

  /**
   * Logger to use
   */
  logger: Logger;

  /**
   * Adapter for this model
   */
  adapter?: ModelAdapter;
}

/**
 * Task to be executed by the worker pool
 */
export interface WorkerTask<T = string> {
  /**
   * Function to execute
   */
  fn: () => Promise<T>;

  /**
   * Execution result
   */
  result?: T;

  /**
   * Error if execution failed
   */
  error?: Error;
}
