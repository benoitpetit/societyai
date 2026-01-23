/**
 * Options de retry pour les appels aux modèles d'IA
 */
export interface RetryOptions {
  /**
   * Nombre maximum de tentatives avant d'abandonner
   */
  maxRetries: number;

  /**
   * Délai initial avant la première nouvelle tentative (en ms)
   */
  initialBackoff: number;

  /**
   * Délai maximum entre deux tentatives (en ms)
   */
  maxBackoff: number;

  /**
   * Facteur de multiplication du backoff à chaque nouvelle tentative
   */
  backoffFactor: number;

  /**
   * Ajouter une variation aléatoire au backoff
   */
  jitter: boolean;
}

/**
 * Niveau de log
 */
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Interface pour le système de logging
 */
export interface Logger {
  /**
   * Log un message de debug
   */
  debug(message: string, ...args: unknown[]): void;

  /**
   * Log un message d'information
   */
  info(message: string, ...args: unknown[]): void;

  /**
   * Log un message d'erreur
   */
  error(message: string, ...args: unknown[]): void;

  /**
   * Définit le niveau de log
   */
  setLevel(level: LogLevel): void;
}

/**
 * Message dans un échange de chat
 */
export interface Message {
  role: string;
  content: string;
}

/**
 * Prompt structuré utilisé par certains modèles
 */
export interface StructuredPrompt {
  system?: string;
  user?: string;
  messages?: Message[];
  options?: Record<string, unknown>;
}

/**
 * Options standard pour les modèles d'IA
 */
export interface StandardModelOptions {
  /**
   * Nom du modèle
   */
  name: string;

  /**
   * Timeout pour les appels au modèle (en ms)
   */
  timeout: number;

  /**
   * Options de retry pour ce modèle
   */
  retryOptions: RetryOptions;

  /**
   * Logger à utiliser
   */
  logger: Logger;

  /**
   * Adaptateur pour ce modèle
   */
  adapter?: ModelAdapter;
}

/**
 * Tâche à exécuter par le pool de workers
 */
export interface Task<T = string> {
  /**
   * Fonction à exécuter
   */
  fn: () => Promise<T>;

  /**
   * Résultat de l'exécution
   */
  result?: T;

  /**
   * Erreur éventuelle
   */
  error?: Error;
}

import type { ModelAdapter } from './types';
