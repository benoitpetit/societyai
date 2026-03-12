/**
 * @fileoverview Tests for StructuredOutputValidator, createSchema, validateJSON, StructuredOutputBuilder
 */

import {
  StructuredOutputValidator,
  StructuredOutputBuilder,
  validateJSON,
  createSchema,
  JSONSchema,
} from '../../capabilities/validation';

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const userSchema: JSONSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0, maximum: 150 },
    active: { type: 'boolean' },
  },
  required: ['name', 'age'],
};

// ---------------------------------------------------------------------------
// StructuredOutputValidator.validate()
// ---------------------------------------------------------------------------

describe('StructuredOutputValidator.validate()', () => {
  let validator: StructuredOutputValidator;

  beforeEach(() => {
    validator = new StructuredOutputValidator(userSchema);
  });

  it('accepts valid JSON', () => {
    const result = validator.validate(JSON.stringify({ name: 'Alice', age: 30 }));
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', age: 30 });
  });

  it('accepts JSON embedded in markdown code block', () => {
    const input = '```json\n{"name":"Bob","age":25}\n```';
    const result = validator.validate(input);
    expect(result.valid).toBe(true);
    expect((result.data as { name: string }).name).toBe('Bob');
  });

  it('accepts JSON embedded in prose', () => {
    const input = 'Here is your answer: {"name":"Charlie","age":40}';
    const result = validator.validate(input);
    expect(result.valid).toBe(true);
  });

  it('returns PARSE_ERROR for completely invalid JSON', () => {
    const result = validator.validate('not json at all');
    expect(result.valid).toBe(false);
    expect(result.errors![0].code).toBe('PARSE_ERROR');
  });

  it('returns MISSING_REQUIRED when required field is absent', () => {
    const result = validator.validate(JSON.stringify({ name: 'Alice' }));
    expect(result.valid).toBe(false);
    const codes = result.errors!.map((e) => e.code);
    expect(codes).toContain('MISSING_REQUIRED');
  });

  it('returns TYPE_MISMATCH when type is wrong', () => {
    const result = validator.validate(JSON.stringify({ name: 42, age: 30 }));
    expect(result.valid).toBe(false);
    const codes = result.errors!.map((e) => e.code);
    expect(codes).toContain('TYPE_MISMATCH');
  });

  it('returns CONSTRAINT_VIOLATION for minimum violation', () => {
    const result = validator.validate(JSON.stringify({ name: 'Alice', age: -1 }));
    expect(result.valid).toBe(false);
    const codes = result.errors!.map((e) => e.code);
    expect(codes).toContain('CONSTRAINT_VIOLATION');
  });

  it('returns CONSTRAINT_VIOLATION for maximum violation', () => {
    const result = validator.validate(JSON.stringify({ name: 'Alice', age: 200 }));
    expect(result.valid).toBe(false);
    const codes = result.errors!.map((e) => e.code);
    expect(codes).toContain('CONSTRAINT_VIOLATION');
  });

  it('returns ADDITIONAL_PROPERTY when additionalProperties is false', () => {
    const strictSchema: JSONSchema = {
      ...userSchema,
      additionalProperties: false,
    };
    const strictValidator = new StructuredOutputValidator(strictSchema);
    const result = strictValidator.validate(JSON.stringify({ name: 'Alice', age: 30, extra: 'x' }));
    expect(result.valid).toBe(false);
    const codes = result.errors!.map((e) => e.code);
    expect(codes).toContain('ADDITIONAL_PROPERTY');
  });

  it('validates array type', () => {
    const arrSchema: JSONSchema = { type: 'array', items: { type: 'string' }, minItems: 1 };
    const v = new StructuredOutputValidator(arrSchema);
    expect(v.validate('["a","b"]').valid).toBe(true);
    expect(v.validate('[]').valid).toBe(false);
  });

  it('validates string minLength / maxLength', () => {
    const s: JSONSchema = { type: 'string', minLength: 3, maxLength: 5 };
    const v = new StructuredOutputValidator(s);
    expect(v.validate('"ab"').valid).toBe(false);
    expect(v.validate('"abc"').valid).toBe(true);
    expect(v.validate('"abcdef"').valid).toBe(false);
  });

  it('validates string pattern', () => {
    const s: JSONSchema = { type: 'string', pattern: '^[a-z]+$' };
    const v = new StructuredOutputValidator(s);
    expect(v.validate('"hello"').valid).toBe(true);
    expect(v.validate('"Hello"').valid).toBe(false);
  });

  it('validates enum', () => {
    const s: JSONSchema = { type: 'string', enum: ['a', 'b', 'c'] };
    const v = new StructuredOutputValidator(s);
    expect(v.validate('"a"').valid).toBe(true);
    expect(v.validate('"d"').valid).toBe(false);
  });

  it('validates const', () => {
    const s: JSONSchema = { type: 'string', const: 'fixed' };
    const v = new StructuredOutputValidator(s);
    expect(v.validate('"fixed"').valid).toBe(true);
    expect(v.validate('"other"').valid).toBe(false);
  });

  it('validate() is deterministic (same input → same result)', () => {
    const input = JSON.stringify({ name: 'Alice', age: 30 });
    const r1 = validator.validate(input);
    const r2 = validator.validate(input);
    expect(r1.valid).toBe(r2.valid);
  });

  it('provides suggestions in errors', () => {
    const result = validator.validate(JSON.stringify({ name: 42, age: 30 }));
    const withSuggestion = result.errors!.filter((e) => e.suggestion);
    expect(withSuggestion.length).toBeGreaterThan(0);
  });

  it('getSchema() returns the original schema', () => {
    expect(validator.getSchema()).toBe(userSchema);
  });

  it('getSchemaDescription() returns formatted string', () => {
    const desc = validator.getSchemaDescription();
    expect(desc).toContain('Expected JSON Schema');
    expect(desc).toContain('"type": "object"');
  });
});

// ---------------------------------------------------------------------------
// StructuredOutputValidator.validateAndRetry()
// ---------------------------------------------------------------------------

describe('StructuredOutputValidator.validateAndRetry()', () => {
  it('returns valid result immediately on first attempt', async () => {
    const v = new StructuredOutputValidator(userSchema);
    const retryFn = jest.fn();
    const result = await v.validateAndRetry(JSON.stringify({ name: 'Alice', age: 30 }), retryFn);
    expect(result.valid).toBe(true);
    expect(retryFn).not.toHaveBeenCalled();
  });

  it('calls retryFn and returns corrected result', async () => {
    const v = new StructuredOutputValidator(userSchema, 3);
    let calls = 0;
    const retryFn = jest.fn().mockImplementation(async () => {
      calls++;
      return JSON.stringify({ name: 'Alice', age: 30 });
    });
    const result = await v.validateAndRetry(JSON.stringify({ name: 'Alice' }), retryFn);
    expect(result.valid).toBe(true);
    expect(calls).toBe(1);
  });

  it('exhausts retries and returns final invalid result', async () => {
    const v = new StructuredOutputValidator(userSchema, 2);
    const retryFn = jest.fn().mockResolvedValue(JSON.stringify({ name: 'Alice' }));
    const result = await v.validateAndRetry(JSON.stringify({ name: 'Alice' }), retryFn);
    expect(result.valid).toBe(false);
    expect(retryFn).toHaveBeenCalledTimes(2);
  });

  it('handles retryFn throwing an error', async () => {
    const v = new StructuredOutputValidator(userSchema, 3);
    const retryFn = jest.fn().mockRejectedValue(new Error('network error'));
    const result = await v.validateAndRetry(JSON.stringify({ name: 'Alice' }), retryFn);
    expect(result.valid).toBe(false);
    expect(result.errors![0].path).toBe('retry');
  });
});

// ---------------------------------------------------------------------------
// validateJSON helper
// ---------------------------------------------------------------------------

describe('validateJSON()', () => {
  it('returns valid result for matching JSON', () => {
    const result = validateJSON<{ name: string; age: number }>(
      JSON.stringify({ name: 'Alice', age: 30 }),
      userSchema
    );
    expect(result.valid).toBe(true);
  });

  it('returns invalid result for mismatched JSON', () => {
    const result = validateJSON(JSON.stringify({ name: 'Alice' }), userSchema);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createSchema helper
// ---------------------------------------------------------------------------

describe('createSchema()', () => {
  it('builds a schema from a property map', () => {
    const schema = createSchema({
      name: { type: 'string', required: true },
      age: { type: 'number' },
    });
    expect(schema.type).toBe('object');
    expect(schema.properties!['name'].type).toBe('string');
    expect(schema.properties!['age'].type).toBe('number');
  });

  it('marks only explicit required fields', () => {
    const schema = createSchema({
      name: { type: 'string', required: true },
      nickname: { type: 'string' },
    });
    expect(schema.required).toContain('name');
    expect(schema.required).not.toContain('nickname');
  });

  it('does not include required array when no fields are required', () => {
    const schema = createSchema({ name: { type: 'string' } });
    expect(schema.required).toBeUndefined();
  });

  it('includes description on properties', () => {
    const schema = createSchema({ name: { type: 'string', description: 'Full name' } });
    expect(schema.properties!['name'].description).toBe('Full name');
  });
});

// ---------------------------------------------------------------------------
// StructuredOutputBuilder
// ---------------------------------------------------------------------------

describe('StructuredOutputBuilder', () => {
  it('builds a validator with withSchema()', () => {
    const v = StructuredOutputBuilder.create().withSchema(userSchema).build();
    expect(v.validate(JSON.stringify({ name: 'Alice', age: 30 })).valid).toBe(true);
  });

  it('builds a validator with fromObject()', () => {
    const v = StructuredOutputBuilder.create<{ x: number; y: number }>()
      .fromObject({ x: 1, y: 2 })
      .build();
    const result = v.validate(JSON.stringify({ x: 10, y: 20 }));
    expect(result.valid).toBe(true);
  });

  it('throws if no schema is set', () => {
    expect(() => StructuredOutputBuilder.create().build()).toThrow();
  });

  it('withMaxRetries sets retry count', async () => {
    const v = StructuredOutputBuilder.create().withSchema(userSchema).withMaxRetries(1).build();
    const retryFn = jest.fn().mockResolvedValue(JSON.stringify({ name: 'Alice' }));
    const result = await v.validateAndRetry(JSON.stringify({ name: 'Alice' }), retryFn);
    expect(result.valid).toBe(false);
    expect(retryFn).toHaveBeenCalledTimes(1);
  });
});
