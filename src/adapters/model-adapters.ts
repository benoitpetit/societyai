/**
 * @fileoverview Model Adapters - Simplified adapters for common AI providers
 *
 * This module provides factory functions to create serializable model configurations
 * that can be used with isolated worker threads. These adapters solve the problem
 * of passing model configurations to workers without requiring manual factory registration.
 *
 * @example
 * ```typescript
 * import { Society } from 'societyai';
 * import { ModelAdapters } from 'societyai/adapters';
 *
 * const society = Society.create()
 *   .addAgent(agent => agent
 *     .withId('processor')
 *     .withModel(ModelAdapters.openai({
 *       apiKey: process.env.OPENAI_API_KEY,
 *       model: 'gpt-4'
 *     }))
 *     .withExecutionMode('isolated')
 *   )
 *   .execute('Hello');
 * ```
 */

import { AIModel } from '../core/types';

/**
 * Serializable model configuration for isolated workers
 */
export interface SerializableModelConfig {
  /** Provider name (openai, anthropic, etc.) */
  provider: string;
  /** Model identifier */
  name: string;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
  /** Static response for testing (optional) */
  _staticResponse?: string;
}

/**
 * Model adapter factory type
 */
export type ModelAdapter = (config: Record<string, unknown>) => SerializableModelConfig;

/**
 * Built-in model adapters for common AI providers
 *
 * These adapters create serializable configurations that can be passed
 * to isolated worker threads without requiring manual factory registration.
 */
export const ModelAdapters = {
  /**
   * OpenAI adapter
   *
   * @example
   * ```typescript
   * ModelAdapters.openai({
   *   apiKey: process.env.OPENAI_API_KEY,
   *   model: 'gpt-4', // optional, defaults to 'gpt-4'
   *   temperature: 0.7, // optional
   *   maxTokens: 1000, // optional
   * })
   * ```
   */
  openai: (config: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    baseURL?: string;
  }): SerializableModelConfig => ({
    provider: 'openai',
    name: config.model || 'gpt-4',
    config: {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1000,
    },
  }),

  /**
   * Anthropic adapter
   *
   * @example
   * ```typescript
   * ModelAdapters.anthropic({
   *   apiKey: process.env.ANTHROPIC_API_KEY,
   *   model: 'claude-3-opus-20240229', // optional
   *   maxTokens: 1000, // optional
   * })
   * ```
   */
  anthropic: (config: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    baseURL?: string;
  }): SerializableModelConfig => ({
    provider: 'anthropic',
    name: config.model || 'claude-3-opus-20240229',
    config: {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.anthropic.com/v1',
      maxTokens: config.maxTokens ?? 1000,
      temperature: config.temperature ?? 0.7,
    },
  }),

  /**
   * Google Gemini adapter
   *
   * @example
   * ```typescript
   * ModelAdapters.gemini({
   *   apiKey: process.env.GOOGLE_API_KEY,
   *   model: 'gemini-pro', // optional
   * })
   * ```
   */
  gemini: (config: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): SerializableModelConfig => ({
    provider: 'gemini',
    name: config.model || 'gemini-pro',
    config: {
      apiKey: config.apiKey,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1000,
    },
  }),

  /**
   * Azure OpenAI adapter
   *
   * @example
   * ```typescript
   * ModelAdapters.azureOpenAI({
   *   apiKey: process.env.AZURE_OPENAI_API_KEY,
   *   endpoint: 'https://your-resource.openai.azure.com',
   *   deployment: 'your-deployment-name',
   *   apiVersion: '2024-02-01', // optional
   * })
   * ```
   */
  azureOpenAI: (config: {
    apiKey: string;
    endpoint: string;
    deployment: string;
    apiVersion?: string;
    temperature?: number;
    maxTokens?: number;
  }): SerializableModelConfig => ({
    provider: 'azure-openai',
    name: config.deployment,
    config: {
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      deployment: config.deployment,
      apiVersion: config.apiVersion || '2024-02-01',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1000,
    },
  }),

  /**
   * Ollama adapter (local models)
   *
   * @example
   * ```typescript
   * ModelAdapters.ollama({
   *   model: 'llama2',
   *   baseURL: 'http://localhost:11434', // optional
   * })
   * ```
   */
  ollama: (config: {
    model: string;
    baseURL?: string;
    temperature?: number;
  }): SerializableModelConfig => ({
    provider: 'ollama',
    name: config.model,
    config: {
      baseURL: config.baseURL || 'http://localhost:11434',
      temperature: config.temperature ?? 0.7,
    },
  }),

  /**
   * Create a mock model adapter for testing
   *
   * @example
   * ```typescript
   * ModelAdapters.mock({
   *   response: 'Mock response',
   *   delay: 100, // optional delay in ms
   * })
   * ```
   */
  mock: (config: { response: string; delay?: number }): SerializableModelConfig => ({
    provider: 'mock',
    name: 'mock-model',
    config: {
      delay: config.delay ?? 0,
    },
    _staticResponse: config.response,
  }),

  /**
   * Auto-detect provider from an existing AIModel instance
   *
   * This is a best-effort detection based on the model name.
   * For production use, prefer explicit adapters.
   *
   * @example
   * ```typescript
   * const adapter = ModelAdapters.fromModel(existingModel);
   * if (adapter) {
   *   // Use the adapter
   * }
   * ```
   */
  fromModel: (model: AIModel): SerializableModelConfig | null => {
    const name = model.name().toLowerCase();

    // Detect provider from model name patterns
    if (name.includes('gpt') || name.includes('openai')) {
      return {
        provider: 'openai',
        name: model.name(),
        config: {},
      };
    }

    if (name.includes('claude') || name.includes('anthropic')) {
      return {
        provider: 'anthropic',
        name: model.name(),
        config: {},
      };
    }

    if (name.includes('gemini') || name.includes('google')) {
      return {
        provider: 'gemini',
        name: model.name(),
        config: {},
      };
    }

    // Unknown provider
    return null;
  },
} as const;

/**
 * Type guard to check if a value is a SerializableModelConfig
 */
export function isSerializableModelConfig(value: unknown): value is SerializableModelConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'provider' in value &&
    'name' in value &&
    'config' in value &&
    typeof (value as SerializableModelConfig).provider === 'string' &&
    typeof (value as SerializableModelConfig).name === 'string' &&
    typeof (value as SerializableModelConfig).config === 'object'
  );
}

/**
 * Helper to convert a SerializableModelConfig back to a usable AIModel
 * This should be called inside the worker thread
 *
 * @internal
 */
export function createModelFromConfig(config: SerializableModelConfig): AIModel {
  // This function is used internally by worker threads to reconstruct models
  // from serializable configurations
  return {
    name: () => config.name,
    process: async (_prompt: unknown, _signal?: AbortSignal): Promise<string> => {
      // This is a placeholder - actual implementation depends on the provider
      // and should be registered via IsolatedWorkerRegistry
      throw new Error(
        `Model provider '${config.provider}' not registered. ` +
          `Call IsolatedWorkerRegistry.register('${config.provider}', factory) before creating the IsolatedWorkerPool.`
      );
    },
    supportsPromptType: (_promptType: string): boolean => true,
  };
}
