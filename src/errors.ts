/**
 * Custom error class for SocietyAI
 */
export class SocietyError extends Error {
  public readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SocietyError';
    this.code = code || 'UNKNOWN_ERROR';
    Object.setPrototypeOf(this, SocietyError.prototype);
  }
}

/**
 * Error when a model is not supported
 */
export class ModelNotSupportedError extends SocietyError {
  constructor(message = 'AI model not supported') {
    super(message, 'MODEL_NOT_SUPPORTED');
    this.name = 'ModelNotSupportedError';
  }
}

/**
 * Error when prompt processing fails
 */
export class ProcessingFailedError extends SocietyError {
  constructor(message = 'Prompt processing failed') {
    super(message, 'PROCESSING_FAILED');
    this.name = 'ProcessingFailedError';
  }
}

/**
 * Error when the number of agents is invalid
 */
export class InvalidAgentCountError extends SocietyError {
  constructor(message = 'The number of agents must be positive') {
    super(message, 'INVALID_AGENT_COUNT');
    this.name = 'InvalidAgentCountError';
  }
}

/**
 * Error when no model is specified
 */
export class NoModelsSpecifiedError extends SocietyError {
  constructor(message = 'At least one AI model must be specified') {
    super(message, 'NO_MODELS');
    this.name = 'NoModelsSpecifiedError';
  }
}

/**
 * Error when no synthesis model is provided
 */
export class SynthesisModelRequiredError extends SocietyError {
  constructor(message = 'A synthesis model is required for this mode') {
    super(message, 'NO_SYNTHESIS_MODEL');
    this.name = 'SynthesisModelRequiredError';
  }
}

/**
 * Error when the operation is cancelled
 */
export class OperationCancelledError extends SocietyError {
  constructor(message = 'The operation was cancelled') {
    super(message, 'OPERATION_CANCELLED');
    this.name = 'OperationCancelledError';
  }
}

/**
 * Error when execution timeout is exceeded
 */
export class TimeoutError extends SocietyError {
  constructor(message = 'Execution timeout exceeded') {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/**
 * Error when configuration is invalid
 */
export class InvalidConfigurationError extends SocietyError {
  constructor(message = 'Invalid configuration') {
    super(message, 'INVALID_CONFIG');
    this.name = 'InvalidConfigurationError';
  }
}

/**
 * Check if an error is related to cancellation or timeout
 */
export function isAbortError(error: Error): boolean {
  return (
    error.name === 'AbortError' ||
    error instanceof OperationCancelledError ||
    error instanceof TimeoutError
  );
}

/**
 * Wrap an error with contextual message
 */
export function wrapError(error: Error, message: string): SocietyError {
  if (error.name === 'AbortError') {
    return new OperationCancelledError(`${message}: ${error.message}`);
  }

  if (error instanceof SocietyError) {
    return new SocietyError(`${message}: ${error.message}`, error.code);
  }

  return new SocietyError(`${message}: ${error.message}`);
}
