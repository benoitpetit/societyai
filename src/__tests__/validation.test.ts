/**
 * Tests for Structured Output Validation
 */

import {
  StructuredOutputBuilder,
  StructuredOutputValidator,
  createSchema,
  validateJSON,
  JSONSchema,
} from '..';

describe('Structured Output Validation', () => {
  describe('StructuredOutputValidator', () => {
    const simpleSchema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    let validator: StructuredOutputValidator;

    beforeEach(() => {
      validator = new StructuredOutputValidator(simpleSchema);
    });

    it('should validate correct JSON', () => {
      const output = '{"name": "John", "age": 30}';
      const result = validator.validate(output);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should reject invalid JSON syntax', () => {
      const output = '{invalid json}';
      const result = validator.validate(output);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should detect missing required fields', () => {
      const output = '{"age": 30}';
      const result = validator.validate(output);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((e: { message: string }) => e.message.includes('required'))).toBe(true);
    });

    it('should detect type mismatches', () => {
      const output = '{"name": "John", "age": "thirty"}';
      const result = validator.validate(output);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((e: { path: string }) => e.path.includes('age'))).toBe(true);
    });

    it('should extract JSON from markdown code blocks', () => {
      const output = '```json\n{"name": "John", "age": 30}\n```';
      const result = validator.validate(output);

      expect(result.valid).toBe(true);
    });

    it('should validate number constraints', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          age: { type: 'number', minimum: 0, maximum: 150 },
        },
        required: ['age'],
      };

      const validator = new StructuredOutputValidator(schema);

      const result1 = validator.validate('{"age": -5}');
      expect(result1.valid).toBe(false);

      const result2 = validator.validate('{"age": 200}');
      expect(result2.valid).toBe(false);

      const result3 = validator.validate('{"age": 30}');
      expect(result3.valid).toBe(true);
    });

    it('should validate string constraints', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 20 },
        },
        required: ['username'],
      };

      const validator = new StructuredOutputValidator(schema);

      const result1 = validator.validate('{"username": "ab"}');
      expect(result1.valid).toBe(false);

      const result2 = validator.validate('{"username": "averylongusernamethatexceedslimit"}');
      expect(result2.valid).toBe(false);

      const result3 = validator.validate('{"username": "john"}');
      expect(result3.valid).toBe(true);
    });

    it('should validate string patterns', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
        },
        required: ['email'],
      };

      const validator = new StructuredOutputValidator(schema);

      const result1 = validator.validate('{"email": "invalid"}');
      expect(result1.valid).toBe(false);

      const result2 = validator.validate('{"email": "john@example.com"}');
      expect(result2.valid).toBe(true);
    });

    it('should validate arrays', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ['tags'],
      };

      const validator = new StructuredOutputValidator(schema);

      const result1 = validator.validate('{"tags": []}');
      expect(result1.valid).toBe(false);

      const result2 = validator.validate('{"tags": ["a", "b", "c", "d", "e", "f"]}');
      expect(result2.valid).toBe(false);

      const result3 = validator.validate('{"tags": ["typescript", "javascript"]}');
      expect(result3.valid).toBe(true);
    });

    it('should validate nested objects', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      };

      const validator = new StructuredOutputValidator(schema);

      const result1 = validator.validate('{"user": {}}');
      expect(result1.valid).toBe(false);

      const result2 = validator.validate('{"user": {"name": "John", "email": "john@example.com"}}');
      expect(result2.valid).toBe(true);
    });

    it('should validate enum values', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
        },
        required: ['status'],
      };

      const validator = new StructuredOutputValidator(schema);

      const result1 = validator.validate('{"status": "invalid"}');
      expect(result1.valid).toBe(false);

      const result2 = validator.validate('{"status": "active"}');
      expect(result2.valid).toBe(true);
    });
  });

  describe('StructuredOutputBuilder', () => {
    it('should create validator with schema', () => {
      const validator = StructuredOutputBuilder.create()
        .withSchema({
          type: 'object',
          properties: { name: { type: 'string' } },
        })
        .build();

      expect(validator).toBeInstanceOf(StructuredOutputValidator);
    });

    it('should infer schema from object', () => {
      const validator = StructuredOutputBuilder.create()
        .fromObject({
          name: 'John',
          age: 30,
          active: true,
        })
        .build();

      const result = validator.validate('{"name": "Alice", "age": 25, "active": false}');
      expect(result.valid).toBe(true);
    });

    it('should set max retries', () => {
      const validator = StructuredOutputBuilder.create()
        .withSchema({ type: 'object' })
        .withMaxRetries(5)
        .build();

      expect(validator).toBeInstanceOf(StructuredOutputValidator);
    });

    it('should throw error if schema is missing', () => {
      expect(() => {
        StructuredOutputBuilder.create().build();
      }).toThrow('Schema is required');
    });
  });

  describe('Helper Functions', () => {
    it('should validate with quick helper', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      };

      const result = validateJSON('{"name": "John"}', schema);
      expect(result.valid).toBe(true);
    });

    it('should create schema from properties', () => {
      const schema = createSchema({
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        views: { type: 'number', required: false },
      });

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('title');
      expect(schema.required).toContain('title');
      expect(schema.required).not.toContain('views');
    });
  });

  describe('Validation with Retry', () => {
    it('should retry on validation failure', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: { age: { type: 'number' } },
        required: ['age'],
      };

      const validator = new StructuredOutputValidator(schema, 3);

      let attemptCount = 0;
      const retryFunc = async (feedback: string): Promise<string> => {
        attemptCount++;
        expect(feedback).toContain('error');
        
        // Return valid JSON on second attempt
        if (attemptCount === 2) {
          return '{"age": 30}';
        }
        return '{"age": "thirty"}';
      };

      const result = await validator.validateAndRetry('{"age": "invalid"}', retryFunc);

      expect(attemptCount).toBe(2);
      expect(result.valid).toBe(true);
    });

    it('should stop after max retries', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: { value: { type: 'number' } },
        required: ['value'],
      };

      const validator = new StructuredOutputValidator(schema, 2);

      let attemptCount = 0;
      const retryFunc = async (): Promise<string> => {
        attemptCount++;
        return '{"value": "invalid"}'; // Always invalid
      };

      const result = await validator.validateAndRetry('{"value": "invalid"}', retryFunc);

      expect(attemptCount).toBe(2);
      expect(result.valid).toBe(false);
    });
  });
});
