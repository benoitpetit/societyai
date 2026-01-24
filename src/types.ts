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

// ============================================================================
// SYSTÈME DE RÔLES ET AGENTS CONFIGURABLES
// ============================================================================

/**
 * Définition d'un rôle d'agent configurable
 * Permet aux utilisateurs de créer des agents avec des comportements personnalisés
 */
export interface AgentRole {
  /**
   * Identifiant unique du rôle
   */
  id: string;

  /**
   * Nom lisible du rôle (ex: "Chef de projet", "Développeur", "Testeur")
   */
  name: string;

  /**
   * Description du rôle
   */
  description?: string;

  /**
   * Instructions système pour ce rôle
   * Définit comment l'agent doit se comporter
   */
  systemPrompt: string;

  /**
   * Capacités spécifiques de ce rôle
   */
  capabilities?: string[];

  /**
   * Contraintes ou limitations pour ce rôle
   */
  constraints?: string[];

  /**
   * Template pour formater les prompts de cet agent
   * Utilise des placeholders: {input}, {context}, {history}, {sharedData}
   */
  promptTemplate?: string;
}

/**
 * Configuration complète d'un agent
 */
export interface AgentConfig {
  /**
   * Identifiant unique de l'agent
   */
  id: string;

  /**
   * Nom de l'agent
   */
  name?: string;

  /**
   * Rôle de l'agent
   */
  role: AgentRole;

  /**
   * Modèle IA à utiliser
   */
  model: AIModel;

  /**
   * Agents avec lesquels cet agent peut communiquer directement
   */
  canCommunicateWith?: string[];

  /**
   * Priorité de l'agent (pour l'ordre d'exécution)
   */
  priority?: number;

  /**
   * Données de contexte initiales pour cet agent
   */
  initialContext?: Record<string, unknown>;

  /**
   * Configuration de retry spécifique à cet agent
   */
  retryConfig?: {
    maxRetries?: number;
    initialBackoff?: number;
  };
}

/**
 * Message échangé entre agents
 */
export interface AgentMessage {
  /**
   * ID de l'agent émetteur
   */
  from: string;

  /**
   * ID de l'agent destinataire (ou 'broadcast' pour tous)
   */
  to: string | 'broadcast';

  /**
   * Type de message
   */
  type: 'request' | 'response' | 'notification' | 'data' | 'feedback' | 'validation';

  /**
   * Contenu du message
   */
  content: string;

  /**
   * Données structurées optionnelles
   */
  data?: Record<string, unknown>;

  /**
   * Timestamp du message
   */
  timestamp: number;

  /**
   * ID du message parent (pour les réponses)
   */
  replyTo?: string;

  /**
   * Identifiant unique du message
   */
  messageId: string;
}

/**
 * Canal de communication entre agents
 */
export interface CommunicationChannel {
  /**
   * Envoie un message
   */
  send(message: AgentMessage): Promise<void>;

  /**
   * S'abonne aux messages destinés à un agent
   */
  subscribe(agentId: string, handler: (message: AgentMessage) => void): void;

  /**
   * Se désabonne
   */
  unsubscribe(agentId: string): void;

  /**
   * Récupère l'historique des messages
   */
  getHistory(filter?: { from?: string; to?: string; type?: string }): AgentMessage[];

  /**
   * Efface l'historique
   */
  clearHistory(): void;
}

// ============================================================================
// SYSTÈME DE WORKFLOW CONFIGURABLE
// ============================================================================

/**
 * Type d'exécution d'une étape de workflow
 */
export type WorkflowStepExecutionType = 
  | 'sequential'    // Agents exécutés un par un
  | 'parallel'      // Agents exécutés en parallèle
  | 'collaborative' // Agents qui échangent entre eux pendant l'exécution
  | 'conditional';  // Exécution conditionnelle basée sur les résultats précédents

/**
 * Étape configurable dans un workflow
 */
export interface WorkflowStep {
  /**
   * Identifiant de l'étape
   */
  id: string;

  /**
   * Nom de l'étape
   */
  name: string;

  /**
   * Description de l'étape
   */
  description?: string;

  /**
   * IDs des agents participant à cette étape
   */
  agentIds: string[];

  /**
   * Type d'exécution
   */
  executionType: WorkflowStepExecutionType;

  /**
   * Instructions spécifiques pour cette étape
   * Injectées dans le prompt de chaque agent
   */
  instructions?: string;

  /**
   * Template de prompt pour cette étape
   * Surcharge le promptTemplate du rôle si défini
   */
  promptTemplate?: string;

  /**
   * Nombre maximum d'itérations pour les étapes collaboratives
   */
  maxIterations?: number;

  /**
   * Condition pour passer à l'étape suivante (pour les étapes collaboratives)
   */
  completionCondition?: (results: StepResult[], iteration: number) => boolean;

  /**
   * Fonction de transformation des résultats avant passage à l'étape suivante
   */
  resultTransformer?: (results: StepResult[] | StepResult) => unknown;

  /**
   * Condition pour exécuter cette étape (pour type 'conditional')
   */
  condition?: (previousResults: Map<string, StepResult[]>) => boolean;

  /**
   * Étapes suivantes possibles (si non défini, passe à l'étape suivante dans l'ordre)
   */
  nextSteps?: string[];

  /**
   * Fonction pour déterminer dynamiquement l'étape suivante
   */
  nextStepResolver?: (results: StepResult[]) => string | null;
}

/**
 * Résultat d'exécution d'une étape pour un agent
 */
export interface StepResult {
  /**
   * ID de l'agent
   */
  agentId: string;

  /**
   * ID de l'étape
   */
  stepId: string;

  /**
   * Contenu de la réponse
   */
  content: string;

  /**
   * Métadonnées additionnelles
   */
  metadata?: Record<string, unknown>;

  /**
   * Timestamp de completion
   */
  timestamp: number;

  /**
   * Succès ou échec
   */
  success: boolean;

  /**
   * Erreur éventuelle
   */
  error?: Error;

  /**
   * Numéro d'itération (pour les étapes collaboratives)
   */
  iteration?: number;
}

/**
 * Configuration d'un workflow complet
 */
export interface WorkflowConfig {
  /**
   * Identifiant du workflow
   */
  id: string;

  /**
   * Nom du workflow
   */
  name: string;

  /**
   * Description du workflow
   */
  description?: string;

  /**
   * Étapes du workflow dans l'ordre d'exécution par défaut
   */
  steps: WorkflowStep[];

  /**
   * ID de l'étape de départ
   */
  entryStepId?: string;

  /**
   * Agents participant au workflow
   */
  agents: AgentConfig[];

  /**
   * Données de contexte global partagées entre toutes les étapes
   */
  globalContext?: Record<string, unknown>;

  /**
   * Fonction appelée avant chaque étape
   */
  onBeforeStep?: (step: WorkflowStep, context: WorkflowContext) => Promise<void>;

  /**
   * Fonction appelée après chaque étape
   */
  onAfterStep?: (step: WorkflowStep, results: StepResult[], context: WorkflowContext) => Promise<void>;

  /**
   * Fonction pour générer le résultat final
   */
  finalResultGenerator?: (results: Map<string, StepResult[]>, context: WorkflowContext) => Promise<string>;
}

/**
 * Contexte d'exécution du workflow
 */
export interface WorkflowContext {
  /**
   * Prompt/input initial
   */
  input: string;

  /**
   * Données partagées entre étapes (mutable)
   */
  sharedData: Map<string, unknown>;

  /**
   * Résultats de toutes les étapes précédentes
   */
  stepResults: Map<string, StepResult[]>;

  /**
   * Historique des communications entre agents
   */
  messageHistory: AgentMessage[];

  /**
   * Métadonnées du workflow
   */
  metadata: Record<string, unknown>;
}

/**
 * Interface pour les exécuteurs de workflow
 */
export interface WorkflowExecutor {
  /**
   * Exécute un workflow complet
   */
  execute(workflow: WorkflowConfig, input: string, signal?: AbortSignal): Promise<WorkflowResult>;

  /**
   * Exécute une étape spécifique
   */
  executeStep(
    step: WorkflowStep, 
    agents: Map<string, AgentConfig>, 
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]>;
}

/**
 * Résultat final d'un workflow
 */
export interface WorkflowResult {
  /**
   * Succès global
   */
  success: boolean;

  /**
   * Résultat final généré
   */
  output: string;

  /**
   * Résultats de chaque étape
   */
  stepResults: Map<string, StepResult[]>;

  /**
   * Messages échangés pendant l'exécution
   */
  messages: AgentMessage[];

  /**
   * Durée totale en ms
   */
  duration: number;

  /**
   * Erreurs rencontrées
   */
  errors?: Error[];
}

// ============================================================================
// BUILDERS ET FACTORIES
// ============================================================================

/**
 * Interface pour construire des rôles d'agents
 */
export interface AgentRoleBuilder {
  withId(id: string): AgentRoleBuilder;
  withName(name: string): AgentRoleBuilder;
  withDescription(description: string): AgentRoleBuilder;
  withSystemPrompt(prompt: string): AgentRoleBuilder;
  withCapabilities(capabilities: string[]): AgentRoleBuilder;
  withConstraints(constraints: string[]): AgentRoleBuilder;
  withPromptTemplate(template: string): AgentRoleBuilder;
  build(): AgentRole;
}

/**
 * Interface pour construire des agents
 */
export interface AgentConfigBuilder {
  withId(id: string): AgentConfigBuilder;
  withName(name: string): AgentConfigBuilder;
  withRole(role: AgentRole): AgentConfigBuilder;
  withModel(model: AIModel): AgentConfigBuilder;
  canCommunicateWith(agentIds: string[]): AgentConfigBuilder;
  withPriority(priority: number): AgentConfigBuilder;
  withInitialContext(context: Record<string, unknown>): AgentConfigBuilder;
  build(): AgentConfig;
}

/**
 * Interface pour construire des workflows
 */
export interface WorkflowBuilder {
  withId(id: string): WorkflowBuilder;
  withName(name: string): WorkflowBuilder;
  withDescription(description: string): WorkflowBuilder;
  addAgent(agent: AgentConfig): WorkflowBuilder;
  addStep(step: WorkflowStep): WorkflowBuilder;
  withGlobalContext(context: Record<string, unknown>): WorkflowBuilder;
  withFinalResultGenerator(generator: WorkflowConfig['finalResultGenerator']): WorkflowBuilder;
  build(): WorkflowConfig;
}

/**
 * Rôles prédéfinis communs (optionnels, pour faciliter l'usage)
 */
export const CommonRoles = {
  ANALYST: 'analyst',
  REVIEWER: 'reviewer',
  IMPLEMENTER: 'implementer',
  TESTER: 'tester',
  COORDINATOR: 'coordinator',
  SYNTHESIZER: 'synthesizer',
} as const;

/**
 * Types de workflow prédéfinis (optionnels)
 */
export const WorkflowPatterns = {
  /** Pipeline simple: A → B → C */
  PIPELINE: 'pipeline',
  /** Review: A fait, B vérifie, retour à A si nécessaire */
  REVIEW_LOOP: 'review-loop',
  /** Parallèle puis synthèse: A, B, C en parallèle → D synthétise */
  PARALLEL_SYNTHESIS: 'parallel-synthesis',
  /** Hiérarchique: Coordinateur distribue, équipe exécute, coordinateur valide */
  HIERARCHICAL: 'hierarchical',
  /** Consensus: Agents discutent jusqu'à accord */
  CONSENSUS: 'consensus',
} as const;

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

  /**
   * Perspectives personnalisées pour chaque agent (mode standard)
   * Chaque perspective sera préfixée au prompt pour un agent
   * Exemple: ["Analyze technically: ", "Consider user experience: "]
   */
  agentPerspectives?: string[];

  /**
   * Dimensions personnalisées à explorer (mode collaboratif)
   * Chaque agent explorera une dimension différente
   * Exemple: ["Security aspects", "Performance optimization", "User needs"]
   */
  dimensions?: string[];

  /**
   * Template de prompt pour les agents
   * Placeholders disponibles: {perspective}, {input}, {context}
   */
  promptTemplate?: string;

  /**
   * Template pour la synthèse des résultats
   * Placeholder disponible: {results}
   */
  synthesisPromptTemplate?: string;

  /**
   * Fonction personnalisée pour générer le résultat final
   */
  resultGenerator?: (agentResults: string[]) => string;
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
