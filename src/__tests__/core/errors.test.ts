/**
 * Tests for error classes — comprehensive coverage
 */

import {
  SocietyError,
  ModelNotSupportedError,
  ProcessingFailedError,
  InvalidAgentCountError,
  NoModelsSpecifiedError,
  SynthesisModelRequiredError,
  OperationCancelledError,
  ExecutionTimeoutError,
  TimeoutError,
  InvalidConfigurationError,
  InvalidWorkflowRoutingError,
  isAbortError,
  wrapError,
} from '../../core/errors';

describe('Error Classes', () => {
  // =====================================================
  // SocietyError (base)
  // =====================================================

  describe('SocietyError', () => {
    test('should set message and default code', () => {
      const err = new SocietyError('test');
      expect(err.message).toBe('test');
      expect(err.code).toBe('UNKNOWN_ERROR');
      expect(err.name).toBe('SocietyError');
      expect(err).toBeInstanceOf(Error);
    });

    test('should accept custom code', () => {
      const err = new SocietyError('msg', 'CUSTOM');
      expect(err.code).toBe('CUSTOM');
    });

    test('prototype chain should be correct', () => {
      const err = new SocietyError('test');
      expect(err instanceof SocietyError).toBe(true);
      expect(err instanceof Error).toBe(true);
    });
  });

  // =====================================================
  // ModelNotSupportedError
  // =====================================================

  describe('ModelNotSupportedError', () => {
    test('should have default message and code', () => {
      const err = new ModelNotSupportedError();
      expect(err.message).toBe('AI model not supported');
      expect(err.code).toBe('MODEL_NOT_SUPPORTED');
      expect(err.name).toBe('ModelNotSupportedError');
    });

    test('should accept custom message', () => {
      const err = new ModelNotSupportedError('GPT-5 not available');
      expect(err.message).toBe('GPT-5 not available');
    });

    test('should extend SocietyError', () => {
      const err = new ModelNotSupportedError();
      expect(err).toBeInstanceOf(SocietyError);
    });
  });

  // =====================================================
  // ProcessingFailedError
  // =====================================================

  describe('ProcessingFailedError', () => {
    test('should have default message', () => {
      const err = new ProcessingFailedError();
      expect(err.message).toBe('Prompt processing failed');
      expect(err.code).toBe('PROCESSING_FAILED');
    });

    test('should store context', () => {
      const err = new ProcessingFailedError('failed', {
        agentId: 'a1',
        stepId: 's1',
        modelName: 'gpt-4',
        retryCount: 3,
      });
      expect(err.context).toBeDefined();
      expect(err.context!.agentId).toBe('a1');
    });

    test('toString() should include context details', () => {
      const err = new ProcessingFailedError('failed', {
        agentId: 'a1',
        stepId: 's1',
        modelName: 'gpt-4',
        retryCount: 2,
      });
      const str = err.toString();
      expect(str).toContain('Agent: a1');
      expect(str).toContain('Step: s1');
      expect(str).toContain('Model: gpt-4');
      expect(str).toContain('Retry: 2');
    });

    test('toString() without context should not crash', () => {
      const err = new ProcessingFailedError('failed');
      expect(err.toString()).toContain('ProcessingFailedError');
    });

    test('toString() with partial context should work', () => {
      const err = new ProcessingFailedError('failed', { agentId: 'a1' });
      const str = err.toString();
      expect(str).toContain('Agent: a1');
      expect(str).not.toContain('Step:');
    });
  });

  // =====================================================
  // Simple error classes
  // =====================================================

  describe('InvalidAgentCountError', () => {
    test('default message and code', () => {
      const err = new InvalidAgentCountError();
      expect(err.code).toBe('INVALID_AGENT_COUNT');
      expect(err.name).toBe('InvalidAgentCountError');
    });
  });

  describe('NoModelsSpecifiedError', () => {
    test('default message and code', () => {
      const err = new NoModelsSpecifiedError();
      expect(err.code).toBe('NO_MODELS');
      expect(err.name).toBe('NoModelsSpecifiedError');
    });
  });

  describe('SynthesisModelRequiredError', () => {
    test('default message and code', () => {
      const err = new SynthesisModelRequiredError();
      expect(err.code).toBe('NO_SYNTHESIS_MODEL');
      expect(err.name).toBe('SynthesisModelRequiredError');
    });
  });

  describe('OperationCancelledError', () => {
    test('default message and code', () => {
      const err = new OperationCancelledError();
      expect(err.code).toBe('OPERATION_CANCELLED');
      expect(err.name).toBe('OperationCancelledError');
    });
  });

  describe('InvalidWorkflowRoutingError', () => {
    test('default message and code', () => {
      const err = new InvalidWorkflowRoutingError();
      expect(err.code).toBe('INVALID_ROUTING');
      expect(err.name).toBe('InvalidWorkflowRoutingError');
    });
  });

  // =====================================================
  // ExecutionTimeoutError (TimeoutError is a deprecated alias)
  // =====================================================

  describe('ExecutionTimeoutError', () => {
    test('default message and code', () => {
      const err = new ExecutionTimeoutError();
      expect(err.code).toBe('TIMEOUT');
      expect(err.name).toBe('ExecutionTimeoutError');
    });

    test('TimeoutError alias produces ExecutionTimeoutError instances', () => {
      const err = new TimeoutError();
      expect(err).toBeInstanceOf(ExecutionTimeoutError);
      expect(err.name).toBe('ExecutionTimeoutError');
    });

    test('toString() with full context', () => {
      const err = new ExecutionTimeoutError('timed out', {
        timeoutMs: 5000,
        elapsedMs: 5123,
        stepId: 'step-3',
      });
      const str = err.toString();
      expect(str).toContain('Timeout: 5000ms');
      expect(str).toContain('Elapsed: 5123ms');
      expect(str).toContain('Step: step-3');
    });

    test('toString() with partial context', () => {
      const err = new ExecutionTimeoutError('timed out', { timeoutMs: 3000 });
      const str = err.toString();
      expect(str).toContain('3000ms');
      expect(str).not.toContain('Elapsed');
    });

    test('toString() without context', () => {
      const err = new ExecutionTimeoutError('timed out');
      expect(err.toString()).toContain('ExecutionTimeoutError');
    });
  });

  // =====================================================
  // InvalidConfigurationError
  // =====================================================

  describe('InvalidConfigurationError', () => {
    test('should store context', () => {
      const err = new InvalidConfigurationError('bad config', {
        societyId: 's1',
        stepId: 'step-1',
        agentId: 'a1',
        suggestion: 'Try adding an agent',
        availableIds: ['a1', 'a2', 'a3'],
      });
      expect(err.code).toBe('INVALID_CONFIG');
      expect(err.context!.societyId).toBe('s1');
    });

    test('toString() should include all context details', () => {
      const err = new InvalidConfigurationError('bad config', {
        societyId: 's1',
        stepId: 'step-1',
        agentId: 'a1',
        suggestion: 'Try adding an agent',
        availableIds: ['x', 'y'],
      });
      const str = err.toString();
      expect(str).toContain('Society: s1');
      expect(str).toContain('Step: step-1');
      expect(str).toContain('Agent: a1');
      expect(str).toContain('Available IDs: x, y');
      expect(str).toContain('Suggestion: Try adding an agent');
    });

    test('toString() with empty availableIds should not show them', () => {
      const err = new InvalidConfigurationError('bad', {
        societyId: 's1',
        availableIds: [],
      });
      const str = err.toString();
      expect(str).toContain('Society: s1');
      expect(str).not.toContain('Available IDs');
    });

    test('toString() without context', () => {
      const err = new InvalidConfigurationError('bad');
      expect(err.toString()).toContain('InvalidConfigurationError');
    });
  });

  // =====================================================
  // isAbortError()
  // =====================================================

  describe('isAbortError', () => {
    test('should detect AbortError by name', () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      expect(isAbortError(err)).toBe(true);
    });

    test('should detect OperationCancelledError', () => {
      expect(isAbortError(new OperationCancelledError())).toBe(true);
    });

    test('should detect ExecutionTimeoutError (via TimeoutError alias)', () => {
      expect(isAbortError(new TimeoutError())).toBe(true);
    });

    test('should return false for regular errors', () => {
      expect(isAbortError(new Error('nope'))).toBe(false);
    });

    test('should return false for other SocietyErrors', () => {
      expect(isAbortError(new ProcessingFailedError())).toBe(false);
    });
  });

  // =====================================================
  // wrapError()
  // =====================================================

  describe('wrapError', () => {
    test('should wrap AbortError as OperationCancelledError', () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      const wrapped = wrapError(err, 'context');
      expect(wrapped).toBeInstanceOf(OperationCancelledError);
      expect(wrapped.message).toContain('context');
      expect(wrapped.message).toContain('aborted');
    });

    test('should wrap SocietyError preserving code', () => {
      const err = new ProcessingFailedError('original');
      const wrapped = wrapError(err, 'wrapper');
      expect(wrapped).toBeInstanceOf(SocietyError);
      expect(wrapped.code).toBe('PROCESSING_FAILED');
      expect(wrapped.message).toContain('wrapper');
      expect(wrapped.message).toContain('original');
    });

    test('should wrap generic Error as SocietyError', () => {
      const err = new Error('generic');
      const wrapped = wrapError(err, 'context');
      expect(wrapped).toBeInstanceOf(SocietyError);
      expect(wrapped.message).toContain('context');
      expect(wrapped.message).toContain('generic');
    });
  });
});
