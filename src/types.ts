/**
 * Interface pour les modèles d'IA
 * Cette interface doit être implémentée par n'importe quel modèle
 * que le développeur souhaite utiliser avec SocietyAI
 */
export interface AIModel {
  /**
   * Traite un prompt et retourne une réponse
   * @param prompt - Le prompt à traiter
   * @param signal - Signal d'annulation optionnel
   * @returns Une promesse contenant la réponse du modèle
   */
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;

  /**
   * Retourne le nom du modèle d'IA
   */
  name(): string;

  /**
   * Vérifie si le modèle supporte un type spécifique de prompt
   * @param promptType - Le type de prompt à vérifier
   */
  supportsPromptType(promptType: string): boolean;
}

/**
 * Interface pour construire des prompts adaptés
 * à différents types de modèles d'IA
 */
export interface PromptBuilder {
  /**
   * Construit le prompt initial pour un agent
   * @param basePrompt - Le prompt de base
   * @param agentId - L'identifiant de l'agent
   */
  buildInitialPrompt(basePrompt: string, agentId: number): unknown;

  /**
   * Construit le prompt pour l'analyse initiale
   * @param basePrompt - Le prompt de base
   */
  buildInitialAnalysisPrompt(basePrompt: string): unknown;

  /**
   * Construit le prompt pour explorer une dimension spécifique
   * @param analysis - L'analyse précédente
   * @param dimension - La dimension à explorer
   * @param originalPrompt - Le prompt original
   */
  buildExplorationPrompt(
    analysis: string,
    dimension: string,
    originalPrompt: string
  ): unknown;

  /**
   * Construit le prompt pour intégrer les analyses
   * @param initialAnalysis - L'analyse initiale
   * @param insights - Les insights des agents
   * @param dimensions - Les dimensions explorées
   */
  buildIntegrationPrompt(
    initialAnalysis: string,
    insights: string[],
    dimensions: string[]
  ): unknown;

  /**
   * Construit le prompt pour la réponse finale
   * @param integratedAnalysis - L'analyse intégrée
   * @param originalPrompt - Le prompt original
   */
  buildFinalResponsePrompt(integratedAnalysis: string, originalPrompt: string): unknown;

  /**
   * Construit le prompt pour la synthèse des résultats
   * @param results - Les résultats des agents
   */
  buildSynthesisPrompt(results: string[]): unknown;
}

/**
 * Interface pour adapter les prompts et réponses entre
 * le format générique de SocietyAI et le format spécifique de chaque modèle
 */
export interface ModelAdapter {
  /**
   * Convertit un prompt générique au format spécifique du modèle
   * @param genericPrompt - Le prompt générique
   */
  convertPrompt(genericPrompt: unknown): Promise<unknown>;

  /**
   * Convertit une réponse spécifique du modèle au format string attendu
   * @param specificResponse - La réponse spécifique du modèle
   */
  convertResponse(specificResponse: unknown): Promise<string>;

  /**
   * Retourne les types de prompts supportés par ce modèle
   */
  getSupportedPromptTypes(): string[];
}

/**
 * Représente une étape dans une stratégie de collaboration
 */
export interface CollaborationStep {
  /**
   * Exécute cette étape de collaboration
   * @param society - Le groupe de société
   * @param signal - Signal d'annulation optionnel
   */
  execute(society: unknown, signal?: AbortSignal): Promise<void>;

  /**
   * Retourne le nom de cette étape
   */
  name(): string;
}

/**
 * Interface pour les stratégies de collaboration entre agents
 */
export interface CollaborationStrategy {
  /**
   * Retourne la séquence d'étapes pour cette stratégie
   */
  getSteps(): CollaborationStep[];

  /**
   * Configure le contexte collaboratif initial
   * @param config - La configuration
   * @param models - Les modèles d'IA
   */
  setupContext(config: SocietyConfig, models: AIModel[]): CollaborativeContext;
}

/**
 * Interface pour les stratégies d'assignation de modèles aux agents
 */
export interface ModelAssignmentStrategy {
  /**
   * Assigne un modèle à un agent spécifique
   * @param agentId - L'identifiant de l'agent
   * @param models - Les modèles disponibles
   * @param config - La configuration
   */
  assignModelToAgent(agentId: number, models: AIModel[], config: SocietyConfig): AIModel;
}

/**
 * Interface pour observer le comportement d'une société
 */
export interface SocietyObserver {
  /**
   * Appelé quand un agent commence à traiter un prompt
   */
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void;

  /**
   * Appelé quand un agent termine le traitement avec succès
   */
  onAgentComplete(agentId: number, modelName: string, result: string): void;

  /**
   * Appelé quand un agent rencontre une erreur
   */
  onAgentError(agentId: number, modelName: string, error: Error): void;

  /**
   * Appelé au début d'une phase de collaboration
   */
  onPhaseStart(phase: string): void;

  /**
   * Appelé à la fin d'une phase de collaboration
   */
  onPhaseComplete(phase: string): void;

  /**
   * Appelé au démarrage de la société
   */
  onSocietyStart(prompt: string, agentCount: number): void;

  /**
   * Appelé quand la société a terminé tout le traitement
   */
  onSocietyComplete(finalResult: string): void;
}

/**
 * Configuration de la société d'agents
 */
export interface SocietyConfig {
  /**
   * Le prompt à traiter
   */
  prompt: string;

  /**
   * Le nombre d'agents à créer
   */
  agentCount: number;

  /**
   * Utiliser plusieurs modèles différents
   */
  multiModel?: boolean;

  /**
   * Mode collaboratif activé
   */
  collaborative?: boolean;

  /**
   * Timeout pour les opérations (en ms)
   */
  timeout?: number;

  /**
   * Observer pour suivre le cycle de vie
   */
  observer?: SocietyObserver;
}

/**
 * Contexte collaboratif partagé entre les agents
 */
export interface CollaborativeContext {
  /**
   * Les dimensions à explorer
   */
  dimensions: string[];

  /**
   * L'analyse initiale partagée
   */
  initialAnalysis?: string;

  /**
   * Les insights partagés entre agents
   */
  sharedInsights: string[];

  /**
   * L'analyse intégrée
   */
  integratedAnalysis?: string;
}

/**
 * Représente un agent individuel dans la société
 */
export interface Agent {
  /**
   * Identifiant unique de l'agent
   */
  id: number;

  /**
   * Le modèle d'IA utilisé par cet agent
   */
  model: AIModel;

  /**
   * Le prompt à traiter
   */
  prompt: string;

  /**
   * Phase actuelle de traitement (pour mode collaboratif)
   */
  phase?: number;

  /**
   * Dimension à explorer (pour mode collaboratif)
   */
  dimensionToExplore?: string;

  /**
   * Analyse partagée entre agents
   */
  sharedAnalysis?: string;
}
