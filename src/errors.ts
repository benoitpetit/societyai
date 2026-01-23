/**
 * Classe d'erreur personnalisée pour SocietyAI
 */
export class SocietyError extends Error {
  public readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SocietyError';
    this.code = code || 'UNKNOWN_ERROR';
    Object.setPrototypeOf(this, SocietyError.prototype);
  }
}

/**
 * Erreur quand un modèle n'est pas supporté
 */
export class ModelNotSupportedError extends SocietyError {
  constructor(message = 'Modèle d\'IA non supporté') {
    super(message, 'MODEL_NOT_SUPPORTED');
    this.name = 'ModelNotSupportedError';
  }
}

/**
 * Erreur quand le traitement du prompt échoue
 */
export class ProcessingFailedError extends SocietyError {
  constructor(message = 'Échec du traitement du prompt') {
    super(message, 'PROCESSING_FAILED');
    this.name = 'ProcessingFailedError';
  }
}

/**
 * Erreur quand le nombre d'agents est invalide
 */
export class InvalidAgentCountError extends SocietyError {
  constructor(message = 'Le nombre d\'agents doit être positif') {
    super(message, 'INVALID_AGENT_COUNT');
    this.name = 'InvalidAgentCountError';
  }
}

/**
 * Erreur quand aucun modèle n'est spécifié
 */
export class NoModelsSpecifiedError extends SocietyError {
  constructor(message = 'Au moins un modèle AI doit être spécifié') {
    super(message, 'NO_MODELS');
    this.name = 'NoModelsSpecifiedError';
  }
}

/**
 * Erreur quand aucun modèle de synthèse n'est fourni
 */
export class SynthesisModelRequiredError extends SocietyError {
  constructor(message = 'Un modèle de synthèse est requis pour ce mode') {
    super(message, 'NO_SYNTHESIS_MODEL');
    this.name = 'SynthesisModelRequiredError';
  }
}

/**
 * Erreur quand l'opération est annulée
 */
export class OperationCancelledError extends SocietyError {
  constructor(message = 'L\'opération a été annulée') {
    super(message, 'OPERATION_CANCELLED');
    this.name = 'OperationCancelledError';
  }
}

/**
 * Erreur quand le délai d'exécution est dépassé
 */
export class TimeoutError extends SocietyError {
  constructor(message = 'Délai d\'exécution dépassé') {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/**
 * Erreur quand la configuration est invalide
 */
export class InvalidConfigurationError extends SocietyError {
  constructor(message = 'Configuration invalide') {
    super(message, 'INVALID_CONFIG');
    this.name = 'InvalidConfigurationError';
  }
}

/**
 * Vérifie si une erreur est liée à une annulation ou un timeout
 */
export function isAbortError(error: Error): boolean {
  return (
    error.name === 'AbortError' ||
    error instanceof OperationCancelledError ||
    error instanceof TimeoutError
  );
}

/**
 * Enveloppe une erreur avec un message contextuel
 */
export function wrapError(error: Error, message: string): SocietyError {
  if (error.name === 'AbortError') {
    return new OperationCancelledError(`${message}: ${error.message}`);
  }

  if (error instanceof SocietyError) {
    return new SocietyError(`${message}: ${error.message}`, error.code);
  }

  return new SocietyError(`${message}: ${error.message}`);
}
