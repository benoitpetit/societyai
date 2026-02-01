/**
 * @fileoverview Structured Output System with Validation
 *
 * This module provides automatic JSON schema validation with retry logic
 * to ensure AI outputs conform to expected structures.
 *
 * Features:
 * - JSON Schema validation
 * - Automatic retry with error feedback
 * - Type-safe output parsing
 * - Support for Zod schemas (optional)
 * - Custom validators
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number', minimum: 0 }
 *   },
 *   required: ['name', 'age']
 * };
 *
 * const validator = new StructuredOutputValidator(schema);
 * const result = await validator.validateAndRetry(
 *   agentOutput,
 *   async (error) => await agent.retry(error)
 * );
 * ```
 */

import { getLogger } from './logger';
import { ProcessingFailedError } from './errors';

// ============================================================================
// SCHEMA TYPES
// ============================================================================

/**
 * JSON Schema type
 */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean | JSONSchema;
  description?: string;
  default?: unknown;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error path (e.g., 'data.user.name') */
  path: string;
  /** Error message */
  message: string;
  /** Expected value/type */
  expected?: string;
  /** Actual value */
  actual?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult<T = unknown> {
  /** Validation success */
  valid: boolean;
  /** Parsed data if valid */
  data?: T;
  /** Validation errors if invalid */
  errors?: ValidationError[];
}

// ============================================================================
// STRUCTURED OUTPUT VALIDATOR
// ============================================================================

/**
 * Validator for structured output with automatic retry
 */
export class StructuredOutputValidator<T = unknown> {
  private schema: JSONSchema;
  private logger = getLogger();
  private maxRetries: number;

  constructor(schema: JSONSchema, maxRetries: number = 3) {
    this.schema = schema;
    this.maxRetries = maxRetries;
  }

  /**
   * Validate raw output against schema
   */
  validate(output: string): ValidationResult<T> {
    try {
      // Try to extract JSON from output
      const jsonString = this.extractJSON(output);
      const data = JSON.parse(jsonString);

      // Validate against schema
      const errors = this.validateData(data, this.schema, 'data');

      if (errors.length > 0) {
        return { valid: false, errors };
      }

      return { valid: true, data: data as T };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: 'root',
            message: `Failed to parse JSON: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Validate and retry with error feedback
   */
  async validateAndRetry(
    initialOutput: string,
    retryFunc: (errorFeedback: string) => Promise<string>
  ): Promise<ValidationResult<T>> {
    let currentOutput = initialOutput;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const result = this.validate(currentOutput);

      if (result.valid) {
        this.logger.info(`Validation successful after ${attempt} attempts`);
        return result;
      }

      if (attempt === this.maxRetries) {
        this.logger.error(`Validation failed after ${this.maxRetries} retries`);
        return result;
      }

      // Generate error feedback
      const feedback = this.generateErrorFeedback(result.errors!);
      this.logger.debug(`Retry ${attempt + 1}: ${feedback}`);

      // Retry with feedback
      try {
        currentOutput = await retryFunc(feedback);
        attempt++;
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              path: 'retry',
              message: `Retry failed: ${(error as Error).message}`,
            },
          ],
        };
      }
    }

    return { valid: false, errors: [] };
  }

  /**
   * Extract JSON from output (handles markdown code blocks, etc.)
   */
  private extractJSON(output: string): string {
    // Try to find JSON in markdown code block
    const codeBlockMatch = output.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object/array
    const jsonMatch = output.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Return as-is
    return output.trim();
  }

  /**
   * Validate data against schema
   */
  private validateData(
    data: unknown,
    schema: JSONSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Type validation
    const actualType = this.getType(data);
    if (actualType !== schema.type) {
      errors.push({
        path,
        message: `Expected type ${schema.type}`,
        expected: schema.type,
        actual: actualType,
      });
      return errors; // Can't continue validation if type is wrong
    }

    // Const validation
    if (schema.const !== undefined && data !== schema.const) {
      errors.push({
        path,
        message: `Expected constant value`,
        expected: JSON.stringify(schema.const),
        actual: data,
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        expected: schema.enum.join(', '),
        actual: data,
      });
    }

    // Type-specific validations
    switch (schema.type) {
      case 'object':
        errors.push(...this.validateObject(data as Record<string, unknown>, schema, path));
        break;
      case 'array':
        errors.push(...this.validateArray(data as unknown[], schema, path));
        break;
      case 'string':
        errors.push(...this.validateString(data as string, schema, path));
        break;
      case 'number':
        errors.push(...this.validateNumber(data as number, schema, path));
        break;
    }

    return errors;
  }

  /**
   * Validate object
   */
  private validateObject(
    obj: Record<string, unknown>,
    schema: JSONSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check required properties
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in obj)) {
          errors.push({
            path: `${path}.${required}`,
            message: `Missing required property`,
            expected: required,
          });
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key];
        if (propSchema) {
          errors.push(...this.validateData(value, propSchema, `${path}.${key}`));
        } else if (schema.additionalProperties === false) {
          errors.push({
            path: `${path}.${key}`,
            message: `Additional property not allowed`,
            actual: key,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate array
   */
  private validateArray(
    arr: unknown[],
    schema: JSONSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Min/max items
    if (schema.minItems !== undefined && arr.length < schema.minItems) {
      errors.push({
        path,
        message: `Array must have at least ${schema.minItems} items`,
        expected: `>= ${schema.minItems}`,
        actual: arr.length,
      });
    }
    if (schema.maxItems !== undefined && arr.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array must have at most ${schema.maxItems} items`,
        expected: `<= ${schema.maxItems}`,
        actual: arr.length,
      });
    }

    // Validate items
    if (schema.items) {
      arr.forEach((item, index) => {
        errors.push(...this.validateData(item, schema.items!, `${path}[${index}]`));
      });
    }

    return errors;
  }

  /**
   * Validate string
   */
  private validateString(
    str: string,
    schema: JSONSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.minLength !== undefined && str.length < schema.minLength) {
      errors.push({
        path,
        message: `String must be at least ${schema.minLength} characters`,
        expected: `>= ${schema.minLength}`,
        actual: str.length,
      });
    }
    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${schema.maxLength} characters`,
        expected: `<= ${schema.maxLength}`,
        actual: str.length,
      });
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(str)) {
        errors.push({
          path,
          message: `String must match pattern: ${schema.pattern}`,
          expected: schema.pattern,
          actual: str,
        });
      }
    }

    return errors;
  }

  /**
   * Validate number
   */
  private validateNumber(
    num: number,
    schema: JSONSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.minimum !== undefined && num < schema.minimum) {
      errors.push({
        path,
        message: `Number must be >= ${schema.minimum}`,
        expected: `>= ${schema.minimum}`,
        actual: num,
      });
    }
    if (schema.maximum !== undefined && num > schema.maximum) {
      errors.push({
        path,
        message: `Number must be <= ${schema.maximum}`,
        expected: `<= ${schema.maximum}`,
        actual: num,
      });
    }

    return errors;
  }

  /**
   * Get JavaScript type
   */
  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Generate error feedback for agent
   */
  private generateErrorFeedback(errors: ValidationError[]): string {
    const lines = [
      'Your output does not match the required schema. Please fix the following errors:',
      '',
    ];

    for (const error of errors) {
      lines.push(`- ${error.path}: ${error.message}`);
      if (error.expected) {
        lines.push(`  Expected: ${error.expected}`);
      }
      if (error.actual !== undefined) {
        lines.push(`  Actual: ${JSON.stringify(error.actual)}`);
      }
    }

    lines.push('');
    lines.push('Please provide a corrected JSON response that matches the schema.');

    return lines.join('\n');
  }

  /**
   * Get schema as formatted string (for agent prompt)
   */
  getSchemaDescription(): string {
    return `Expected JSON Schema:\n${JSON.stringify(this.schema, null, 2)}`;
  }
}

// ============================================================================
// STRUCTURED OUTPUT BUILDER
// ============================================================================

/**
 * Builder for creating structured output validators
 */
export class StructuredOutputBuilder<T = unknown> {
  private schema?: JSONSchema;
  private maxRetries: number = 3;

  static create<T = unknown>(): StructuredOutputBuilder<T> {
    return new StructuredOutputBuilder<T>();
  }

  /**
   * Set JSON schema
   */
  withSchema(schema: JSONSchema): this {
    this.schema = schema;
    return this;
  }

  /**
   * Create schema from object structure
   */
  fromObject(example: Record<string, unknown>): this {
    this.schema = this.inferSchema(example);
    return this;
  }

  /**
   * Set max retries
   */
  withMaxRetries(maxRetries: number): this {
    this.maxRetries = maxRetries;
    return this;
  }

  /**
   * Build validator
   */
  build(): StructuredOutputValidator<T> {
    if (!this.schema) {
      throw new ProcessingFailedError('Schema is required');
    }
    return new StructuredOutputValidator<T>(this.schema, this.maxRetries);
  }

  /**
   * Infer schema from example object
   */
  private inferSchema(obj: unknown): JSONSchema {
    const type = this.getType(obj);

    const schema: JSONSchema = { type: type as JSONSchema['type'] };

    if (type === 'object' && obj !== null) {
      schema.properties = {};
      schema.required = [];

      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        schema.properties[key] = this.inferSchema(value);
        schema.required.push(key);
      }
    } else if (type === 'array') {
      const arr = obj as unknown[];
      if (arr.length > 0) {
        schema.items = this.inferSchema(arr[0]);
      }
    }

    return schema;
  }

  /**
   * Get type
   */
  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick validation function
 */
export function validateJSON<T = unknown>(
  output: string,
  schema: JSONSchema
): ValidationResult<T> {
  const validator = new StructuredOutputValidator<T>(schema);
  return validator.validate(output);
}

/**
 * Create a simple schema from TypeScript type annotation
 */
export function createSchema(properties: Record<string, { type: string; required?: boolean; description?: string }>): JSONSchema {
  const schema: JSONSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  for (const [key, config] of Object.entries(properties)) {
    schema.properties![key] = {
      type: config.type as JSONSchema['type'],
      description: config.description,
    };

    if (config.required !== false) {
      schema.required!.push(key);
    }
  }

  return schema;
}
