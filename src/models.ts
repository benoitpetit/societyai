import { AIModel, ModelAdapter } from './types';
import { StandardModelOptions } from './config';
import { getLogger } from './logger';
import { withRetry, defaultRetryOptions } from './retry';
import { ProcessingFailedError, wrapError } from './errors';

/**
 * Options par défaut pour les modèles standards
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
 * Classe de base pour les modèles d'IA
 * Peut être étendue par des implémentations concrètes
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
   * Retourne le nom du modèle
   */
  name(): string {
    return this.options.name;
  }

  /**
   * Traite un prompt et retourne une réponse
   */
  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    if (!this.processFunc) {
      throw new ProcessingFailedError('Fonction de traitement non définie');
    }

    this.options.logger.debug(`Traitement du prompt par ${this.options.name}`);

    // Convertir le prompt via l'adaptateur si disponible
    let processPrompt = prompt;
    if (this.options.adapter) {
      try {
        processPrompt = await this.options.adapter.convertPrompt(prompt);
      } catch (error) {
        throw wrapError(error as Error, 'Échec de la conversion du prompt');
      }
    }

    // Créer un AbortController avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    // Combiner les signaux si un signal externe est fourni
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Utiliser le mécanisme de retry
      const result = await withRetry(
        async () => {
          const resp = await this.processFunc!(processPrompt, controller.signal);

          // Convertir la réponse via l'adaptateur si disponible
          if (this.options.adapter) {
            return await this.options.adapter.convertResponse(resp);
          }

          if (typeof resp !== 'string') {
            throw new Error('Le modèle a renvoyé une réponse non-string sans adaptateur configuré');
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
      this.options.logger.error(`Échec du traitement par ${this.options.name}: ${(error as Error).message}`);
      throw wrapError(error as Error, `Échec du traitement par ${this.options.name}`);
    }
  }

  /**
   * Vérifie si le modèle supporte un type spécifique de prompt
   */
  supportsPromptType(promptType: string): boolean {
    return this.supportedPromptTypes.includes(promptType);
  }

  /**
   * Définit les types de prompts supportés
   */
  withSupportedPromptTypes(types: string[]): this {
    this.supportedPromptTypes = types;
    return this;
  }

  /**
   * Définit le nom du modèle
   */
  withName(name: string): this {
    this.options.name = name;
    return this;
  }

  /**
   * Définit l'adaptateur pour ce modèle
   */
  withAdapter(adapter: ModelAdapter): this {
    this.options.adapter = adapter;
    return this;
  }

  /**
   * Définit le timeout pour les appels au modèle
   */
  withTimeout(timeout: number): this {
    this.options.timeout = timeout;
    return this;
  }
}

/**
 * Adaptateur simple pour les modèles basés sur du texte
 */
export class TextModelAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    if (typeof genericPrompt === 'string') {
      return genericPrompt;
    }

    if (genericPrompt && typeof (genericPrompt as { toString: () => string }).toString === 'function') {
      return String(genericPrompt);
    }

    return String(genericPrompt);
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    if (typeof specificResponse === 'string') {
      return specificResponse;
    }

    if (specificResponse instanceof Buffer) {
      return specificResponse.toString();
    }

    throw new Error(`Format de réponse non supporté: ${typeof specificResponse}`);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'string'];
  }
}

/**
 * Adaptateur pour les modèles OpenAI (comme GPT-3.5, GPT-4)
 */
export class OpenAIAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // Si c'est déjà un StructuredPrompt, le retourner tel quel
    if (typeof genericPrompt === 'object' && genericPrompt !== null) {
      const obj = genericPrompt as Record<string, unknown>;
      if ('messages' in obj || 'system' in obj) {
        return genericPrompt;
      }
    }

    // Sinon, convertir en format de messages OpenAI
    let prompt: string;
    if (typeof genericPrompt === 'string') {
      prompt = genericPrompt;
    } else {
      prompt = String(genericPrompt);
    }

    return {
      messages: [
        { role: 'system', content: 'Tu es un assistant IA intelligent, précis et utile.' },
        { role: 'user', content: prompt },
      ],
    };
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    if (typeof specificResponse === 'string') {
      return specificResponse;
    }

    // Gérer les réponses au format OpenAI
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

    throw new Error(`Format de réponse OpenAI non supporté: ${typeof specificResponse}`);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'structured', 'messages'];
  }
}

/**
 * Adaptateur pour les modèles Google Gemini
 */
export class GeminiAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // Si c'est déjà un StructuredPrompt, le retourner tel quel
    if (typeof genericPrompt === 'object' && genericPrompt !== null) {
      const obj = genericPrompt as Record<string, unknown>;
      if ('contents' in obj) {
        return genericPrompt;
      }
    }

    // Sinon, convertir en format Gemini
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

    // Gérer les réponses au format Gemini
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

      // Format simplifié: { text: "..." }
      if ('text' in obj && typeof obj.text === 'string') {
        return obj.text;
      }
    }

    throw new Error(`Format de réponse Gemini non supporté: ${typeof specificResponse}`);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'structured', 'contents'];
  }
}
