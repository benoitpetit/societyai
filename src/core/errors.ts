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
    Object.setPrototypeOf(this, ModelNotSupportedError.prototype);
  }
}

/**
 * Error when prompt processing fails
 */
export class ProcessingFailedError extends SocietyError {
  public readonly context?: {
    agentId?: string;
    stepId?: string;
    modelName?: string;
    retryCount?: number;
  };

  constructor(message = 'Prompt processing failed', context?: ProcessingFailedError['context']) {
    super(message, 'PROCESSING_FAILED');
    this.name = 'ProcessingFailedError';
    this.context = context;
    Object.setPrototypeOf(this, ProcessingFailedError.prototype);
  }

  toString(): string {
    let msg = `${this.name}: ${this.message}`;
    if (this.context) {
      const details: string[] = [];
      if (this.context.agentId) details.push(`Agent: ${this.context.agentId}`);
      if (this.context.stepId) details.push(`Step: ${this.context.stepId}`);
      if (this.context.modelName) details.push(`Model: ${this.context.modelName}`);
      if (this.context.retryCount !== undefined) details.push(`Retry: ${this.context.retryCount}`);
      if (details.length > 0) {
        msg += `\n  Context: ${details.join(' | ')}`;
      }
    }
    return msg;
  }
}

/**
 * Error when the number of agents is invalid
 */
export class InvalidAgentCountError extends SocietyError {
  constructor(message = 'The number of agents must be positive') {
    super(message, 'INVALID_AGENT_COUNT');
    this.name = 'InvalidAgentCountError';
    Object.setPrototypeOf(this, InvalidAgentCountError.prototype);
  }
}

/**
 * Error when no model is specified
 */
export class NoModelsSpecifiedError extends SocietyError {
  constructor(message = 'At least one AI model must be specified') {
    super(message, 'NO_MODELS');
    this.name = 'NoModelsSpecifiedError';
    Object.setPrototypeOf(this, NoModelsSpecifiedError.prototype);
  }
}

/**
 * Error when no synthesis model is provided
 */
export class SynthesisModelRequiredError extends SocietyError {
  constructor(message = 'A synthesis model is required for this mode') {
    super(message, 'NO_SYNTHESIS_MODEL');
    this.name = 'SynthesisModelRequiredError';
    Object.setPrototypeOf(this, SynthesisModelRequiredError.prototype);
  }
}

/**
 * Error when the operation is cancelled
 */
export class OperationCancelledError extends SocietyError {
  constructor(message = 'The operation was cancelled') {
    super(message, 'OPERATION_CANCELLED');
    this.name = 'OperationCancelledError';
    Object.setPrototypeOf(this, OperationCancelledError.prototype);
  }
}

/**
 * Error when execution timeout is exceeded
 */
export class TimeoutError extends SocietyError {
  public readonly context?: {
    timeoutMs?: number;
    elapsedMs?: number;
    stepId?: string;
  };

  constructor(message = 'Execution timeout exceeded', context?: TimeoutError['context']) {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
    this.context = context;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }

  toString(): string {
    let msg = `${this.name}: ${this.message}`;
    if (this.context) {
      if (this.context.timeoutMs) {
        msg += `\n  Timeout: ${this.context.timeoutMs}ms`;
      }
      if (this.context.elapsedMs) {
        msg += `\n  Elapsed: ${this.context.elapsedMs}ms`;
      }
      if (this.context.stepId) {
        msg += `\n  Step: ${this.context.stepId}`;
      }
    }
    return msg;
  }
}

/**
 * Error when configuration is invalid
 */
export class InvalidConfigurationError extends SocietyError {
  public readonly context?: {
    societyId?: string;
    stepId?: string;
    agentId?: string;
    suggestion?: string;
    availableIds?: string[];
  };

  constructor(message: string, context?: InvalidConfigurationError['context']) {
    super(message, 'INVALID_CONFIG');
    this.name = 'InvalidConfigurationError';
    this.context = context;
    Object.setPrototypeOf(this, InvalidConfigurationError.prototype);
  }

  toString(): string {
    let msg = `${this.name}: ${this.message}`;
    if (this.context) {
      const details: string[] = [];
      if (this.context.societyId) details.push(`Society: ${this.context.societyId}`);
      if (this.context.stepId) details.push(`Step: ${this.context.stepId}`);
      if (this.context.agentId) details.push(`Agent: ${this.context.agentId}`);
      if (this.context.availableIds && this.context.availableIds.length > 0) {
        details.push(`Available IDs: ${this.context.availableIds.join(', ')}`);
      }
      if (details.length > 0) {
        msg += `\n  Context: ${details.join(' | ')}`;
      }
      if (this.context.suggestion) {
        msg += `\n  💡 Suggestion: ${this.context.suggestion}`;
      }
    }
    return msg;
  }
}

/**
 * Error when workflow routing is invalid or ambiguous
 */
export class InvalidWorkflowRoutingError extends SocietyError {
  constructor(message = 'Invalid workflow routing') {
    super(message, 'INVALID_ROUTING');
    this.name = 'InvalidWorkflowRoutingError';
    Object.setPrototypeOf(this, InvalidWorkflowRoutingError.prototype);
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
