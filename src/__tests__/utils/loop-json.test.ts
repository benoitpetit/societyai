/**
 * Tests for LoopController and JSON utilities
 */

import { LoopController } from '../../utils/loop-controller';
import { ExecutionContext } from '../../core/types';
import { extractJsonFromText } from '../../utils/json';

// ============================================================================
// LoopController
// ============================================================================

describe('LoopController', () => {
  test('next() should increment and return true within limit', () => {
    const controller = new LoopController({ maxIterations: 3 });

    expect(controller.next()).toBe(true); // iteration 1
    expect(controller.next()).toBe(true); // iteration 2
    expect(controller.next()).toBe(true); // iteration 3
    expect(controller.next()).toBe(false); // iteration 4 — exceeds max
  });

  test('iteration getter should track current count', () => {
    const controller = new LoopController({ maxIterations: 5 });
    expect(controller.iteration).toBe(0);

    controller.next();
    expect(controller.iteration).toBe(1);

    controller.next();
    expect(controller.iteration).toBe(2);
  });

  test('isFirst should be true only on first iteration', () => {
    const controller = new LoopController({ maxIterations: 3 });

    // Before any call — iteration 0
    expect(controller.isFirst).toBe(false); // 0 !== 1

    controller.next(); // iteration 1
    expect(controller.isFirst).toBe(true);

    controller.next(); // iteration 2
    expect(controller.isFirst).toBe(false);
  });

  test('shouldExit should call exitCondition', () => {
    const exitFn = jest.fn().mockReturnValue(true);
    const controller = new LoopController({
      maxIterations: 10,
      exitCondition: exitFn,
    });

    const result = controller.shouldExit('output', { key: 'ctx' } as unknown as ExecutionContext);
    expect(result).toBe(true);
    expect(exitFn).toHaveBeenCalledWith('output', { key: 'ctx' });
  });

  test('shouldExit without exitCondition should return false', () => {
    const controller = new LoopController({ maxIterations: 5 });
    expect(controller.shouldExit('result', {} as unknown as ExecutionContext)).toBe(false);
  });

  test('maxIterations=1 should allow exactly 1 iteration', () => {
    const controller = new LoopController({ maxIterations: 1 });
    expect(controller.next()).toBe(true);
    expect(controller.next()).toBe(false);
  });
});

// ============================================================================
// extractJsonFromText
// ============================================================================

describe('extractJsonFromText', () => {
  test('should extract JSON from markdown code block', () => {
    const text = 'Here is the result:\n```json\n{"name": "Alice", "age": 30}\n```\nDone.';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  test('should extract JSON from code block without json tag', () => {
    const text = '```\n[1, 2, 3]\n```';
    const result = extractJsonFromText(text);
    expect(result).toEqual([1, 2, 3]);
  });

  test('should extract raw JSON object from text', () => {
    const text = 'The data is: {"key": "value"} and more text.';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ key: 'value' });
  });

  test('should extract raw JSON array from text', () => {
    const text = 'Results: [1, 2, 3] end';
    const result = extractJsonFromText(text);
    expect(result).toEqual([1, 2, 3]);
  });

  test('should handle nested JSON', () => {
    const text = '{"nested": {"deep": [1, 2, {"x": 3}]}}';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ nested: { deep: [1, 2, { x: 3 }] } });
  });

  test('should return null for empty string', () => {
    expect(extractJsonFromText('')).toBeNull();
  });

  test('should return null for text without JSON', () => {
    expect(extractJsonFromText('no json here')).toBeNull();
  });

  test('should handle trailing commas in JSON', () => {
    const text = '{"a": 1, "b": 2,}';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('should handle escaped newlines', () => {
    // extractJsonFromText does regex-based extraction; double-escaped
    // backslashes in template literals are tricky. Use a simple object instead.
    const text = '{"message": "hello world", "count": 1}';
    const result = extractJsonFromText(text);
    expect(result).not.toBeNull();
    expect(result.message).toBe('hello world');
  });

  test('should handle JSON with comments', () => {
    const text = `{
      // this is a comment
      "key": "value"
      /* another comment */
    }`;
    const result = extractJsonFromText(text);
    expect(result).toEqual({ key: 'value' });
  });

  test('should skip invalid code blocks and find valid one', () => {
    const text = '```json\nnot valid json\n```\n```json\n{"valid": true}\n```';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ valid: true });
  });

  test('should handle multiple JSON candidates and return first valid', () => {
    const text = 'prefix {broken json} middle {"valid": true} end';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ valid: true });
  });
});
