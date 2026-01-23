import { RetryOptions } from './config';
import { getLogger } from './logger';
import { isAbortError, wrapError } from './errors';

/**
 * Options de retry par défaut
 */
export function defaultRetryOptions(): RetryOptions {
  return {
    maxRetries: 3,
    initialBackoff: 500,
    maxBackoff: 10000,
    backoffFactor: 1.5,
    jitter: true,
  };
}

/**
 * Exécute une fonction avec mécanisme de retry et backoff exponentiel
 * @param fn - La fonction à exécuter
 * @param options - Les options de retry
 * @param signal - Signal d'annulation optionnel
 * @returns Le résultat de la fonction
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
  signal?: AbortSignal
): Promise<T> {
  const opts = { ...defaultRetryOptions(), ...options };
  const logger = getLogger();

  let retryCount = 0;
  let backoff = opts.initialBackoff;
  let lastError: Error | null = null;

  while (retryCount <= opts.maxRetries) {
    // Vérifier si l'opération a été annulée
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    try {
      // Informer du retry si ce n'est pas la première tentative
      if (retryCount > 0) {
        logger.info(`Retry ${retryCount}/${opts.maxRetries} après erreur: ${lastError?.message}`);
      }

      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Si l'erreur est une annulation, ne pas réessayer
      if (isAbortError(lastError)) {
        throw lastError;
      }

      // Dernière tentative atteinte
      if (retryCount >= opts.maxRetries) {
        logger.error(`Max retries atteint (${opts.maxRetries}). Dernière erreur: ${lastError.message}`);
        throw wrapError(lastError, 'Nombre maximum de tentatives atteint');
      }

      // Calculer le backoff pour la prochaine tentative
      let nextBackoff = backoff;
      if (opts.jitter) {
        // Ajouter une variation aléatoire de ±20%
        const jitterFactor = 0.8 + Math.random() * 0.4; // entre 0.8 et 1.2
        nextBackoff = Math.floor(backoff * jitterFactor);
      }

      // Attendre avant de réessayer
      await sleep(nextBackoff, signal);

      // Incrémenter le compteur et augmenter le backoff
      retryCount++;
      backoff = Math.min(opts.maxBackoff, Math.floor(backoff * opts.backoffFactor));
    }
  }

  // Ne devrait jamais atteindre ce point
  throw lastError || new Error('Erreur inconnue lors du retry');
}

/**
 * Fonction utilitaire pour attendre un certain temps
 * @param ms - Temps d'attente en millisecondes
 * @param signal - Signal d'annulation optionnel
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Operation cancelled'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = (): void => {
        clearTimeout(timeout);
        reject(new Error('Operation cancelled'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}
