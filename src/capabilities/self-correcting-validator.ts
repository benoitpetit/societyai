/**
 * @fileoverview Advanced Validation with LLM Self-Correction
 *
 * Extends the basic validation system with intelligent auto-correction
 * that leverages the LLM itself to fix validation errors.
 *
 * @example
 * ```ts
 * import { SelfCorrectingValidator } from 'societyai/capabilities';
 *
 * const validator = new SelfCorrectingValidator({
 *   schema: userSchema,
 *   model: myLLM,
 *   maxCorrectionAttempts: 3,
 *   strategy: 'guided' // or 'aggressive'
 * });
 *
 * const result = await validator.validateAndCorrect(agentOutput);
 * // Returns valid data or throws after exhausting attempts
 * ```
 */

import {
  StructuredOutputValidator,
  ValidationError,
  ValidationResult,
  JSONSchema,
} from './validation';
import { AIModel } from '../core/types';
import { getLogger } from '../observability/logger';

/**
 * Self-correction strategy
 */
export type CorrectionStrategy =
  | 'guided' // Provide detailed error feedback (default)
  | 'aggressive' // Include schema + examples + step-by-step instructions
  | 'minimal'; // Only provide schema

/**
 * Configuration for SelfCorrectingValidator
 */
export interface SelfCorrectingConfig {
  /** JSON Schema for validation */
  schema: JSONSchema;
  /** LLM model for self-correction */
  model: AIModel;
  /** Maximum correction attempts (default: 3) */
  maxCorrectionAttempts?: number;
  /** Correction strategy (default: 'guided') */
  strategy?: CorrectionStrategy;
  /** System prompt override */
  systemPrompt?: string;
  /** Include examples in correction prompt */
  includeExamples?: boolean;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Correction attempt details
 */
export interface CorrectionAttempt {
  attemptNumber: number;
  input: string;
  output: string;
  errors: ValidationError[];
  timestamp: number;
  successful: boolean;
}

/**
 * Self-Correcting Validator
 *
 * Uses the LLM itself to fix validation errors through iterative refinement.
 *
 * Process:
 * 1. Validate initial output
 * 2. If invalid, generate correction prompt with error details
 * 3. Ask LLM to fix the issues
 * 4. Validate again
 * 5. Repeat until valid or max attempts reached
 *
 * Features:
 * - Multiple correction strategies
 * - Detailed error tracking
 * - Schema injection
 * - Example-based guidance
 * - Abort support
 */
export class SelfCorrectingValidator<T = unknown> {
  private validator: StructuredOutputValidator<T>;
  private model: AIModel;
  private maxAttempts: number;
  private strategy: CorrectionStrategy;
  private systemPrompt: string;
  private includeExamples: boolean;
  private signal?: AbortSignal;
  private logger = getLogger();
  private attempts: CorrectionAttempt[] = [];

  constructor(config: SelfCorrectingConfig) {
    this.validator = new StructuredOutputValidator<T>(config.schema);
    this.model = config.model;
    this.maxAttempts = config.maxCorrectionAttempts || 3;
    this.strategy = config.strategy || 'guided';
    this.includeExamples = config.includeExamples ?? true;
    this.signal = config.signal;

    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
  }

  /**
   * Validate and auto-correct output
   *
   * @param output - Initial LLM output to validate
   * @returns Validated and corrected data
   * @throws Error if validation fails after all attempts
   */
  async validateAndCorrect(output: string): Promise<T> {
    this.attempts = [];
    let currentOutput = output;
    let attemptNumber = 0;

    // Initial validation
    let result = this.validator.validate(currentOutput);

    if (result.valid) {
      this.logger.info('[SelfCorrection] Initial output is valid');
      return result.data as T;
    }

    // Correction loop
    while (!result.valid && attemptNumber < this.maxAttempts) {
      if (this.signal?.aborted) {
        throw new Error('Self-correction aborted');
      }

      attemptNumber++;

      this.logger.info(`[SelfCorrection] Attempt ${attemptNumber}/${this.maxAttempts}`);

      // Record attempt
      this.attempts.push({
        attemptNumber,
        input: currentOutput,
        output: '',
        errors: result.errors || [],
        timestamp: Date.now(),
        successful: false,
      });

      // Generate correction prompt
      const correctionPrompt = this.buildCorrectionPrompt(currentOutput, result);

      // Ask LLM to fix
      try {
        currentOutput = await this.model.process(correctionPrompt, this.signal);

        // Update attempt
        this.attempts[this.attempts.length - 1].output = currentOutput;

        // Validate again
        result = this.validator.validate(currentOutput);

        if (result.valid) {
          this.attempts[this.attempts.length - 1].successful = true;
          this.logger.info(`[SelfCorrection] ✅ Correction successful on attempt ${attemptNumber}`);
          return result.data as T;
        }
      } catch (error) {
        this.logger.error(`[SelfCorrection] Error during correction: ${(error as Error).message}`);
        throw error;
      }
    }

    // Failed to correct
    const errorMsg = this.buildFailureMessage(result);
    this.logger.error(`[SelfCorrection] ❌ Failed to correct after ${attemptNumber} attempts`);
    throw new Error(errorMsg);
  }

  /**
   * Get correction attempts history
   */
  getAttempts(): CorrectionAttempt[] {
    return [...this.attempts];
  }

  /**
   * Get correction statistics
   */
  getStats(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    averageAttemptsToSuccess: number;
  } {
    const total = this.attempts.length;
    const successful = this.attempts.filter((a) => a.successful).length;
    const failed = total - successful;

    return {
      totalAttempts: total,
      successfulAttempts: successful,
      failedAttempts: failed,
      averageAttemptsToSuccess: successful > 0 ? total / successful : 0,
    };
  }

  // --- Private Methods ---

  /**
   * Build correction prompt based on strategy
   */
  private buildCorrectionPrompt(invalidOutput: string, validationResult: ValidationResult): string {
    const errors = validationResult.errors || [];

    switch (this.strategy) {
      case 'minimal':
        return this.buildMinimalPrompt(invalidOutput);

      case 'aggressive':
        return this.buildAggressivePrompt(invalidOutput, errors);

      case 'guided':
      default:
        return this.buildGuidedPrompt(invalidOutput, errors);
    }
  }

  /**
   * Minimal strategy: just schema
   */
  private buildMinimalPrompt(invalidOutput: string): string {
    return `
${this.systemPrompt}

Your previous output was invalid. Please provide a corrected JSON response that matches this exact schema:

\`\`\`json
${JSON.stringify(this.validator.getSchema(), null, 2)}
\`\`\`

Your previous (invalid) output:
\`\`\`json
${invalidOutput}
\`\`\`

Provide ONLY the corrected JSON, nothing else.
    `.trim();
  }

  /**
   * Guided strategy: errors + suggestions
   */
  private buildGuidedPrompt(invalidOutput: string, errors: ValidationError[]): string {
    const errorDetails = errors
      .map((err, idx) => {
        const parts = [`${idx + 1}. **${err.path}**`, `   - Problem: ${err.message}`];

        if (err.expected) parts.push(`   - Expected: ${err.expected}`);
        if (err.actual !== undefined) parts.push(`   - Got: ${JSON.stringify(err.actual)}`);
        if (err.suggestion) parts.push(`   - 💡 Fix: ${err.suggestion}`);

        return parts.join('\n');
      })
      .join('\n\n');

    return `
${this.systemPrompt}

Your previous JSON output has validation errors. Please fix them carefully.

**Validation Errors (${errors.length}):**
${errorDetails}

**Expected Schema:**
\`\`\`json
${JSON.stringify(this.validator.getSchema(), null, 2)}
\`\`\`

**Your Previous Output:**
\`\`\`json
${invalidOutput}
\`\`\`

**Instructions:**
1. Review each error carefully
2. Apply the suggested fixes
3. Ensure all required fields are present
4. Verify types match the schema
5. Output ONLY valid JSON, no explanations

Provide the corrected JSON now:
    `.trim();
  }

  /**
   * Aggressive strategy: everything including examples
   */
  private buildAggressivePrompt(invalidOutput: string, errors: ValidationError[]): string {
    const guidedPrompt = this.buildGuidedPrompt(invalidOutput, errors);

    const examples = this.includeExamples ? this.generateExamples() : '';

    return `
${guidedPrompt}

${examples}

**Step-by-Step Correction Process:**
1. ✅ Check schema structure - does your JSON match the expected shape?
2. ✅ Verify all required fields exist
3. ✅ Confirm data types (string, number, boolean, array, object)
4. ✅ Validate constraints (min/max, patterns, enums)
5. ✅ Remove any extra fields not in the schema

Now provide the fully corrected JSON:
    `.trim();
  }

  /**
   * Generate examples from schema
   */
  private generateExamples(): string {
    const schema = this.validator.getSchema();
    const example = this.generateExampleFromSchema(schema);

    return `
**Example Valid Output:**
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`
    `.trim();
  }

  /**
   * Generate example data from schema
   */
  private generateExampleFromSchema(schema: JSONSchema): unknown {
    switch (schema.type) {
      case 'object': {
        const obj: Record<string, unknown> = {};
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            obj[key] = this.generateExampleFromSchema(propSchema as JSONSchema);
          }
        }
        return obj;
      }

      case 'array':
        return schema.items ? [this.generateExampleFromSchema(schema.items as JSONSchema)] : [];

      case 'string':
        if (schema.enum) return schema.enum[0];
        if (schema.const) return schema.const;
        return 'example-string';

      case 'number':
        if (schema.minimum) return schema.minimum;
        if (schema.const) return schema.const;
        return 42;

      case 'boolean':
        return true;

      case 'null':
        return null;

      default:
        return null;
    }
  }

  /**
   * Build failure message
   */
  private buildFailureMessage(lastResult: ValidationResult): string {
    const errors = lastResult.errors || [];
    const errorList = errors.map((e) => `- ${e.path}: ${e.message}`).join('\n');

    return `
Validation failed after ${this.attempts.length} correction attempts.

Remaining errors:
${errorList}

Schema:
${JSON.stringify(this.validator.getSchema(), null, 2)}

Last output:
${this.attempts[this.attempts.length - 1]?.output || 'N/A'}
    `.trim();
  }

  /**
   * Default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are a JSON correction expert. Your task is to fix invalid JSON outputs to match the required schema exactly. Be precise and follow all validation rules.`;
  }
}

/**
 * Helper function to create a self-correcting validator
 */
export function createSelfCorrectingValidator<T = unknown>(
  schema: JSONSchema,
  model: AIModel,
  options?: Partial<SelfCorrectingConfig>
): SelfCorrectingValidator<T> {
  return new SelfCorrectingValidator<T>({
    schema,
    model,
    ...options,
  });
}
