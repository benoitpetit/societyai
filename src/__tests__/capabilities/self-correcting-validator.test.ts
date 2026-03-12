/**
 * @fileoverview Tests for SelfCorrectingValidator
 */

import {
  SelfCorrectingValidator,
  createSelfCorrectingValidator,
  CorrectionStrategy,
} from '../../capabilities/self-correcting-validator';
import { JSONSchema } from '../../capabilities/validation';
import { AIModel } from '../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(responses: string[]): AIModel {
  let callCount = 0;
  return {
    name: () => 'mock',
    supportsPromptType: () => true,
    process: jest.fn().mockImplementation(async () => {
      const response = responses[callCount] ?? responses[responses.length - 1];
      callCount++;
      return response;
    }),
  };
}

const schema: JSONSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
};

const validJSON = JSON.stringify({ name: 'Alice', age: 30 });
const invalidJSON = JSON.stringify({ name: 'Alice' }); // missing 'age'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SelfCorrectingValidator', () => {
  describe('validateAndCorrect — immediate success', () => {
    it('returns parsed data when initial output is valid', async () => {
      const model = makeModel([]);
      const validator = new SelfCorrectingValidator({ schema, model });

      const result = await validator.validateAndCorrect(validJSON);
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('does not call model.process when initial output is already valid', async () => {
      const model = makeModel([]);
      const validator = new SelfCorrectingValidator({ schema, model });
      await validator.validateAndCorrect(validJSON);
      expect(model.process).not.toHaveBeenCalled();
    });

    it('records no attempts when initial output is valid', async () => {
      const model = makeModel([]);
      const validator = new SelfCorrectingValidator({ schema, model });
      await validator.validateAndCorrect(validJSON);
      expect(validator.getAttempts()).toHaveLength(0);
    });
  });

  describe('validateAndCorrect — correction loop', () => {
    it('corrects on second attempt', async () => {
      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, maxCorrectionAttempts: 3 });

      const result = await validator.validateAndCorrect(invalidJSON);
      expect(result).toEqual({ name: 'Alice', age: 30 });
      expect(model.process).toHaveBeenCalledTimes(1);
    });

    it('records successful attempt with correct attemptNumber', async () => {
      const model = makeModel([invalidJSON, validJSON]); // fails once, then succeeds
      const validator = new SelfCorrectingValidator({ schema, model, maxCorrectionAttempts: 3 });

      await validator.validateAndCorrect(invalidJSON);
      const attempts = validator.getAttempts();
      expect(attempts).toHaveLength(2);
      expect(attempts[0].successful).toBe(false);
      expect(attempts[1].successful).toBe(true);
      expect(attempts[1].attemptNumber).toBe(2);
    });

    it('throws after exhausting all attempts', async () => {
      const model = makeModel([invalidJSON, invalidJSON, invalidJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, maxCorrectionAttempts: 3 });

      await expect(validator.validateAndCorrect(invalidJSON)).rejects.toThrow(
        /Validation failed after/
      );
    });

    it('respects maxCorrectionAttempts', async () => {
      const model = makeModel([invalidJSON, invalidJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, maxCorrectionAttempts: 2 });

      await expect(validator.validateAndCorrect(invalidJSON)).rejects.toThrow();
      expect(model.process).toHaveBeenCalledTimes(2);
    });

    it('propagates model errors', async () => {
      const model: AIModel = {
        name: () => 'mock',
        supportsPromptType: () => true,
        process: jest.fn().mockRejectedValue(new Error('model exploded')),
      };
      const validator = new SelfCorrectingValidator({ schema, model });

      await expect(validator.validateAndCorrect(invalidJSON)).rejects.toThrow('model exploded');
    });
  });

  describe('abort support', () => {
    it('throws when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({
        schema,
        model,
        signal: controller.signal,
      });

      await expect(validator.validateAndCorrect(invalidJSON)).rejects.toThrow(
        'Self-correction aborted'
      );
    });
  });

  describe('getStats()', () => {
    it('returns zero stats when no attempts have been made', () => {
      const model = makeModel([]);
      const validator = new SelfCorrectingValidator({ schema, model });

      const stats = validator.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulAttempts).toBe(0);
      expect(stats.failedAttempts).toBe(0);
      expect(stats.averageAttemptsToSuccess).toBe(0);
    });

    it('averageAttemptsToSuccess equals the attempt number of the successful attempt', async () => {
      // 2 failures then 1 success (attempt 3)
      const model = makeModel([invalidJSON, invalidJSON, validJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, maxCorrectionAttempts: 5 });

      await validator.validateAndCorrect(invalidJSON);
      const stats = validator.getStats();

      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulAttempts).toBe(1);
      expect(stats.failedAttempts).toBe(2);
      expect(stats.averageAttemptsToSuccess).toBe(3);
    });

    it('averageAttemptsToSuccess is 0 when all attempts fail', async () => {
      const model = makeModel([invalidJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, maxCorrectionAttempts: 1 });

      await expect(validator.validateAndCorrect(invalidJSON)).rejects.toThrow();
      const stats = validator.getStats();
      expect(stats.averageAttemptsToSuccess).toBe(0);
    });
  });

  describe('correction strategies', () => {
    const strategies: CorrectionStrategy[] = ['guided', 'aggressive', 'minimal'];

    for (const strategy of strategies) {
      it(`strategy "${strategy}" calls model with a correction prompt`, async () => {
        const model = makeModel([validJSON]);
        const validator = new SelfCorrectingValidator({ schema, model, strategy });

        await validator.validateAndCorrect(invalidJSON);
        expect(model.process).toHaveBeenCalledTimes(1);
        const promptArg = (model.process as jest.Mock).mock.calls[0][0] as string;
        expect(typeof promptArg).toBe('string');
        expect(promptArg.length).toBeGreaterThan(0);
      });
    }

    it('guided prompt includes error details', async () => {
      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, strategy: 'guided' });

      await validator.validateAndCorrect(invalidJSON);
      const prompt = (model.process as jest.Mock).mock.calls[0][0] as string;
      expect(prompt).toContain('Validation Errors');
    });

    it('aggressive prompt includes step-by-step instructions', async () => {
      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, strategy: 'aggressive' });

      await validator.validateAndCorrect(invalidJSON);
      const prompt = (model.process as jest.Mock).mock.calls[0][0] as string;
      expect(prompt).toContain('Step-by-Step');
    });

    it('minimal prompt includes schema only', async () => {
      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({ schema, model, strategy: 'minimal' });

      await validator.validateAndCorrect(invalidJSON);
      const prompt = (model.process as jest.Mock).mock.calls[0][0] as string;
      expect(prompt).toContain('"type": "object"');
    });
  });

  describe('custom system prompt', () => {
    it('uses provided systemPrompt', async () => {
      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({
        schema,
        model,
        systemPrompt: 'MY_CUSTOM_SYSTEM_PROMPT',
      });

      await validator.validateAndCorrect(invalidJSON);
      const prompt = (model.process as jest.Mock).mock.calls[0][0] as string;
      expect(prompt).toContain('MY_CUSTOM_SYSTEM_PROMPT');
    });
  });

  describe('getAttempts()', () => {
    it('returns a copy of attempts — mutations do not affect internal state', async () => {
      const model = makeModel([validJSON]);
      const validator = new SelfCorrectingValidator({ schema, model });

      await validator.validateAndCorrect(invalidJSON);
      const attempts1 = validator.getAttempts();
      attempts1.push({
        attemptNumber: 99,
        input: '',
        output: '',
        errors: [],
        timestamp: 0,
        successful: false,
      });
      const attempts2 = validator.getAttempts();
      expect(attempts2).toHaveLength(1);
    });
  });

  describe('createSelfCorrectingValidator helper', () => {
    it('creates a validator that corrects output', async () => {
      const model = makeModel([validJSON]);
      const validator = createSelfCorrectingValidator<{ name: string; age: number }>(
        schema,
        model,
        { maxCorrectionAttempts: 2 }
      );

      const result = await validator.validateAndCorrect(invalidJSON);
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(30);
    });
  });
});
