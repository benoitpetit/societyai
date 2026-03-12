import { AIModel, ModelAdapter } from './types';
import { StandardModelOptions } from './config';
import { getLogger } from '../observability/logger';
import { withRetry, defaultRetryOptions } from '../utils/retry';
import { ProcessingFailedError, wrapError } from './errors';

/**
 * Default options for standard models
 */
export function defaultStandardModelOptions(): StandardModelOptions {
  return {
    name: 'StandardModel',
    timeout: 20000,
    retryOptions: defaultRetryOptions(),
    logger: getLogger(),
    adapter: new TextModelAdapter(),
  };
}

/**
 * Base class for AI models
 * Can be extended by concrete implementations
 */
export class StandardModelBase implements AIModel {
  protected options: StandardModelOptions;
  protected supportedPromptTypes: string[] = ['text'];

  constructor(
    options?: Partial<StandardModelOptions>,
    protected processFunc?: (prompt: unknown, signal?: AbortSignal) => Promise<unknown>
  ) {
    this.options = { ...defaultStandardModelOptions(), ...options };
  }

  /**
   * Returns the model name
   */
  name(): string {
    return this.options.name;
  }

  /**
   * Processes a prompt and returns a response
   */
  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    if (!this.processFunc) {
      throw new ProcessingFailedError('Processing function not defined');
    }

    this.options.logger.debug(`Processing prompt by ${this.options.name}`);

    // Convert prompt via adapter if available
    let processPrompt = prompt;
    if (this.options.adapter) {
      try {
        processPrompt = await this.options.adapter.convertPrompt(prompt);
      } catch (error) {
        throw wrapError(error as Error, 'Failed to convert prompt');
      }
    }

    // Create AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    // Combine signals if external signal provided
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      // Use retry mechanism
      const result = await withRetry(
        async () => {
          const resp = await this.processFunc!(processPrompt, controller.signal);

          // Convert response via adapter if available
          if (this.options.adapter) {
            return await this.options.adapter.convertResponse(resp);
          }

          if (typeof resp !== 'string') {
            throw new Error('Model returned non-string response without configured adapter');
          }

          return resp;
        },
        this.options.retryOptions,
        controller.signal
      );

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      this.options.logger.error(
        `Processing failed by ${this.options.name}: ${(error as Error).message}`
      );
      throw wrapError(error as Error, `Processing failed by ${this.options.name}`);
    }
  }

  /**
   * Checks if the model supports a specific prompt type
   */
  supportsPromptType(promptType: string): boolean {
    return this.supportedPromptTypes.includes(promptType);
  }

  /**
   * Sets the supported prompt types
   */
  withSupportedPromptTypes(types: string[]): this {
    this.supportedPromptTypes = types;
    return this;
  }

  /**
   * Sets the model name
   */
  withName(name: string): this {
    this.options.name = name;
    return this;
  }

  /**
   * Sets the adapter for this model
   */
  withAdapter(adapter: ModelAdapter): this {
    this.options.adapter = adapter;
    return this;
  }

  /**
   * Sets the timeout for model calls
   */
  withTimeout(timeout: number): this {
    this.options.timeout = timeout;
    return this;
  }
}

/**
 * Simple adapter for text-based models
 */
export class TextModelAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // All values can be coerced to string; strings are returned as-is.
    return typeof genericPrompt === 'string' ? genericPrompt : String(genericPrompt);
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    if (typeof specificResponse === 'string') {
      return specificResponse;
    }

    if (specificResponse instanceof Buffer) {
      return specificResponse.toString();
    }

    throw new Error(`Unsupported response format: ${typeof specificResponse}`);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'string'];
  }
}

/**
 * Adapter for OpenAI models (like GPT-3.5, GPT-4)
 */
export class OpenAIAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // If it's already a StructuredPrompt, return as is
    if (typeof genericPrompt === 'object' && genericPrompt !== null) {
      const obj = genericPrompt as Record<string, unknown>;
      if ('messages' in obj || 'system' in obj) {
        return genericPrompt;
      }
    }

    // Otherwise, convert to OpenAI messages format
    let prompt: string;
    if (typeof genericPrompt === 'string') {
      prompt = genericPrompt;
    } else {
      prompt = String(genericPrompt);
    }

    return {
      messages: [
        { role: 'system', content: 'You are a precise and helpful AI assistant.' },
        { role: 'user', content: prompt },
      ],
    };
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    if (typeof specificResponse === 'string') {
      return specificResponse;
    }

    // Handle OpenAI response format
    if (typeof specificResponse === 'object' && specificResponse !== null) {
      const obj = specificResponse as Record<string, unknown>;

      // Format: { choices: [{ message: { content: "..." } }] }
      if ('choices' in obj && Array.isArray(obj.choices) && obj.choices.length > 0) {
        const choice = obj.choices[0] as Record<string, unknown>;
        if ('message' in choice && typeof choice.message === 'object') {
          const message = choice.message as Record<string, unknown>;
          if ('content' in message && typeof message.content === 'string') {
            return message.content;
          }
        }
      }

      // Format: { content: "..." }
      if ('content' in obj && typeof obj.content === 'string') {
        return obj.content;
      }
    }

    throw new Error(`Unsupported OpenAI response format: ${typeof specificResponse}`);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'structured', 'messages'];
  }
}

/**
 * Adapter for Google Gemini models
 */
export class GeminiAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // If it's already a StructuredPrompt, return as is
    if (typeof genericPrompt === 'object' && genericPrompt !== null) {
      const obj = genericPrompt as Record<string, unknown>;
      if ('contents' in obj) {
        return genericPrompt;
      }
    }

    // Otherwise, convert to Gemini format
    let prompt: string;
    if (typeof genericPrompt === 'string') {
      prompt = genericPrompt;
    } else {
      prompt = String(genericPrompt);
    }

    return {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    };
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    if (typeof specificResponse === 'string') {
      return specificResponse;
    }

    // Handle Gemini response format
    if (typeof specificResponse === 'object' && specificResponse !== null) {
      const obj = specificResponse as Record<string, unknown>;

      // Format: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
      if ('candidates' in obj && Array.isArray(obj.candidates) && obj.candidates.length > 0) {
        const candidate = obj.candidates[0] as Record<string, unknown>;
        if ('content' in candidate && typeof candidate.content === 'object') {
          const content = candidate.content as Record<string, unknown>;
          if ('parts' in content && Array.isArray(content.parts) && content.parts.length > 0) {
            const part = content.parts[0] as Record<string, unknown>;
            if ('text' in part && typeof part.text === 'string') {
              return part.text;
            }
          }
        }
      }

      // Simplified format: { text: "..." }
      if ('text' in obj && typeof obj.text === 'string') {
        return obj.text;
      }
    }

    throw new Error(`Unsupported Gemini response format: ${typeof specificResponse}`);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'structured', 'contents'];
  }
}
