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

import { getLogger } from '../observability/logger';
import { ProcessingFailedError } from '../core/errors';

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
 * Validation error with enhanced context
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
  /** Error code for programmatic handling */
  code?:
    | 'TYPE_MISMATCH'
    | 'MISSING_REQUIRED'
    | 'INVALID_VALUE'
    | 'CONSTRAINT_VIOLATION'
    | 'PARSE_ERROR'
    | 'ADDITIONAL_PROPERTY';
  /** Suggestion for fixing the error */
  suggestion?: string;
  /** Schema context where error occurred */
  schemaContext?: JSONSchema;
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
   * Get the schema used by this validator
   */
  getSchema(): JSONSchema {
    return this.schema;
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
      const parseError = error as Error;
      let suggestion = 'Ensure output is valid JSON';

      // Enhanced parse error suggestions
      if (parseError.message.includes('Unexpected token')) {
        suggestion = 'Check for syntax errors: missing commas, quotes, or brackets';
      } else if (parseError.message.includes('Unexpected end')) {
        suggestion = 'JSON is incomplete - check for missing closing brackets or braces';
      } else if (parseError.message.includes('position')) {
        const posMatch = parseError.message.match(/position (\d+)/);
        if (posMatch) {
          const pos = parseInt(posMatch[1]);
          const context = output.substring(
            Math.max(0, pos - 20),
            Math.min(output.length, pos + 20)
          );
          suggestion = `JSON parse error near position ${pos}: "${context}"`;
        }
      }

      return {
        valid: false,
        errors: [
          {
            path: 'root',
            message: `Failed to parse JSON: ${parseError.message}`,
            code: 'PARSE_ERROR',
            suggestion,
            actual: output.substring(0, 100) + (output.length > 100 ? '...' : ''),
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
    const trimmed = output.trim();

    // First, try to parse the output directly as-is — handles primitives
    // (quoted strings, numbers, booleans, null) as well as objects/arrays
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // Not valid JSON as-is, continue with extraction heuristics
    }

    // Try to find JSON in markdown code block
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object/array
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Return as-is and let JSON.parse in validate() produce the error
    return trimmed;
  }

  /**
   * Validate data against schema
   */
  private validateData(data: unknown, schema: JSONSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Type validation
    const actualType = this.getType(data);
    if (actualType !== schema.type) {
      errors.push({
        path,
        message: `Type mismatch: expected ${schema.type}, got ${actualType}`,
        expected: schema.type,
        actual: actualType,
        code: 'TYPE_MISMATCH',
        suggestion: this.generateTypeSuggestion(schema.type, actualType, data),
        schemaContext: schema,
      });
      return errors; // Can't continue validation if type is wrong
    }

    // Const validation
    if (schema.const !== undefined && data !== schema.const) {
      errors.push({
        path,
        message: `Value must be exactly: ${JSON.stringify(schema.const)}`,
        expected: JSON.stringify(schema.const),
        actual: data,
        code: 'INVALID_VALUE',
        suggestion: `Use the exact constant value: ${JSON.stringify(schema.const)}`,
        schemaContext: schema,
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`,
        expected: schema.enum.join(', '),
        actual: data,
        code: 'INVALID_VALUE',
        suggestion: `Choose one of these values: ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`,
        schemaContext: schema,
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
   * Generate type conversion suggestion
   */
  private generateTypeSuggestion(expectedType: string, actualType: string, value: unknown): string {
    if (expectedType === 'string' && actualType === 'number') {
      return `Convert number to string: "${value}"`;
    }
    if (expectedType === 'number' && actualType === 'string') {
      return `Convert string to number: ${value} → parse as number`;
    }
    if (expectedType === 'array' && actualType === 'object') {
      return `Wrap in array: [${JSON.stringify(value)}]`;
    }
    if (expectedType === 'object' && actualType === 'string') {
      return `Parse string as JSON object or provide object structure`;
    }
    return `Provide a ${expectedType} value instead of ${actualType}`;
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
          const propSchema = schema.properties?.[required];
          errors.push({
            path: `${path}.${required}`,
            message: `Missing required property '${required}'`,
            expected: required,
            code: 'MISSING_REQUIRED',
            suggestion: propSchema
              ? `Add property "${required}" of type ${propSchema.type}${propSchema.description ? `: ${propSchema.description}` : ''}`
              : `Add property "${required}" to the object`,
            schemaContext: propSchema,
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
          const allowedProps = Object.keys(schema.properties).join(', ');
          errors.push({
            path: `${path}.${key}`,
            message: `Property '${key}' is not allowed`,
            actual: key,
            code: 'ADDITIONAL_PROPERTY',
            suggestion: `Remove '${key}' or use one of the allowed properties: ${allowedProps}`,
            schemaContext: schema,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate array
   */
  private validateArray(arr: unknown[], schema: JSONSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Min/max items
    if (schema.minItems !== undefined && arr.length < schema.minItems) {
      errors.push({
        path,
        message: `Array has too few items: ${arr.length} < ${schema.minItems}`,
        expected: `>= ${schema.minItems}`,
        actual: arr.length,
        code: 'CONSTRAINT_VIOLATION',
        suggestion: `Add ${schema.minItems - arr.length} more item(s) to the array`,
        schemaContext: schema,
      });
    }
    if (schema.maxItems !== undefined && arr.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array has too many items: ${arr.length} > ${schema.maxItems}`,
        expected: `<= ${schema.maxItems}`,
        actual: arr.length,
        code: 'CONSTRAINT_VIOLATION',
        suggestion: `Remove ${arr.length - schema.maxItems} item(s) from the array`,
        schemaContext: schema,
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
  private validateString(str: string, schema: JSONSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.minLength !== undefined && str.length < schema.minLength) {
      errors.push({
        path,
        message: `String too short: ${str.length} < ${schema.minLength} characters`,
        expected: `>= ${schema.minLength}`,
        actual: str.length,
        code: 'CONSTRAINT_VIOLATION',
        suggestion: `Add ${schema.minLength - str.length} more character(s)`,
        schemaContext: schema,
      });
    }
    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      errors.push({
        path,
        message: `String too long: ${str.length} > ${schema.maxLength} characters`,
        expected: `<= ${schema.maxLength}`,
        actual: str.length,
        code: 'CONSTRAINT_VIOLATION',
        suggestion: `Remove ${str.length - schema.maxLength} character(s)`,
        schemaContext: schema,
      });
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(str)) {
        errors.push({
          path,
          message: `String does not match required pattern`,
          expected: schema.pattern,
          actual: str.substring(0, 50) + (str.length > 50 ? '...' : ''),
          code: 'CONSTRAINT_VIOLATION',
          suggestion: `Format the string to match pattern: ${schema.pattern}`,
          schemaContext: schema,
        });
      }
    }

    return errors;
  }

  /**
   * Validate number
   */
  private validateNumber(num: number, schema: JSONSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.minimum !== undefined && num < schema.minimum) {
      errors.push({
        path,
        message: `Number below minimum: ${num} < ${schema.minimum}`,
        expected: `>= ${schema.minimum}`,
        actual: num,
        code: 'CONSTRAINT_VIOLATION',
        suggestion: `Use a value >= ${schema.minimum}`,
        schemaContext: schema,
      });
    }
    if (schema.maximum !== undefined && num > schema.maximum) {
      errors.push({
        path,
        message: `Number above maximum: ${num} > ${schema.maximum}`,
        expected: `<= ${schema.maximum}`,
        actual: num,
        code: 'CONSTRAINT_VIOLATION',
        suggestion: `Use a value <= ${schema.maximum}`,
        schemaContext: schema,
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
   * Generate error feedback for agent with enhanced suggestions
   */
  private generateErrorFeedback(errors: ValidationError[]): string {
    const lines = [
      '❌ JSON Validation Failed',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `Found ${errors.length} error${errors.length > 1 ? 's' : ''}:`,
      '',
    ];

    errors.forEach((error, index) => {
      lines.push(`${index + 1}. Location: ${error.path}`);
      lines.push(`   Problem: ${error.message}`);

      if (error.expected) {
        lines.push(`   Expected: ${error.expected}`);
      }
      if (error.actual !== undefined) {
        lines.push(`   Actual: ${JSON.stringify(error.actual)}`);
      }
      if (error.suggestion) {
        lines.push(`   💡 Suggestion: ${error.suggestion}`);
      }
      if (error.code) {
        lines.push(`   Code: ${error.code}`);
      }
      lines.push('');
    });

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('📝 Please provide a corrected JSON response following these guidelines:');

    // Group errors by type for summary
    const errorsByType = errors.reduce(
      (acc, err) => {
        const code = err.code || 'OTHER';
        if (!acc[code]) acc[code] = [];
        acc[code].push(err);
        return acc;
      },
      {} as Record<string, ValidationError[]>
    );

    if (errorsByType.MISSING_REQUIRED) {
      lines.push(
        `   • Add missing required fields: ${errorsByType.MISSING_REQUIRED.map((e) => e.expected).join(', ')}`
      );
    }
    if (errorsByType.TYPE_MISMATCH) {
      lines.push(
        `   • Fix type mismatches at: ${errorsByType.TYPE_MISMATCH.map((e) => e.path).join(', ')}`
      );
    }
    if (errorsByType.ADDITIONAL_PROPERTY) {
      lines.push(
        `   • Remove unexpected properties: ${errorsByType.ADDITIONAL_PROPERTY.map((e) => e.actual).join(', ')}`
      );
    }
    if (errorsByType.CONSTRAINT_VIOLATION) {
      lines.push(
        `   • Fix constraint violations in: ${errorsByType.CONSTRAINT_VIOLATION.map((e) => e.path).join(', ')}`
      );
    }

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
export function validateJSON<T = unknown>(output: string, schema: JSONSchema): ValidationResult<T> {
  const validator = new StructuredOutputValidator<T>(schema);
  return validator.validate(output);
}

/**
 * Create a simple schema from TypeScript type annotation
 */
export function createSchema(
  properties: Record<string, { type: string; required?: boolean; description?: string }>
): JSONSchema {
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
