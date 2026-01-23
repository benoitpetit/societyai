import {
  AIModel,
  Agent,
  SocietyConfig,
  SocietyObserver,
  CollaborativeContext,
} from './types';
import {
  InvalidAgentCountError,
  NoModelsSpecifiedError,
  SynthesisModelRequiredError,
} from './errors';
import { getLogger } from './logger';
import { WorkerPool } from './worker-pool';

/**
 * Groupe de société d'agents
 */
export class SocietyGroup {
  public agents: Agent[] = [];
  public models: AIModel[];
  public multiModel: boolean;
  public context?: CollaborativeContext;
  public observer?: SocietyObserver;

  constructor(
    agents: Agent[],
    models: AIModel[],
    multiModel = false,
    context?: CollaborativeContext,
    observer?: SocietyObserver
  ) {
    this.agents = agents;
    this.models = models;
    this.multiModel = multiModel;
    this.context = context;
    this.observer = observer;
  }

  /**
   * Lance tous les agents en parallèle
   */
  async run(signal?: AbortSignal): Promise<void> {
    const logger = getLogger();
    logger.info(`Démarrage de la société avec ${this.agents.length} agents`);

    if (this.observer) {
      this.observer.onSocietyStart(this.agents[0]?.prompt || '', this.agents.length);
    }

    // Créer un pool de workers
    const pool = new WorkerPool(this.agents.length, signal);

    // Préparer les tâches pour chaque agent
    const tasks = this.agents.map((agent) => async () => {
      logger.debug(`Agent ${agent.id} (${agent.model.name()}) démarre le traitement`);

      if (this.observer) {
        this.observer.onAgentStart(agent.id, agent.model.name(), agent.prompt);
      }

      try {
        const response = await agent.model.process(agent.prompt, signal);

        logger.info(`Agent ${agent.id} (${agent.model.name()}) a terminé avec succès`);

        if (this.observer) {
          this.observer.onAgentComplete(agent.id, agent.model.name(), response);
        }

        return response;
      } catch (error) {
        logger.error(`Agent ${agent.id} (${agent.model.name()}) a échoué: ${(error as Error).message}`);

        if (this.observer) {
          this.observer.onAgentError(agent.id, agent.model.name(), error as Error);
        }

        throw error;
      }
    });

    // Exécuter toutes les tâches
    await Promise.all(tasks.map((task) => pool.submit(task)));

    await pool.waitAll();

    logger.info('Tous les agents ont terminé');

    return;
  }

  /**
   * Collecte les résultats de tous les agents
   */
  async collectResults(signal?: AbortSignal): Promise<string> {
    const results: string[] = [];

    // Récupérer les résultats des agents
    for (const agent of this.agents) {
      const response = await agent.model.process(agent.prompt, signal);
      results.push(response);
    }

    // Combiner les résultats
    let finalResult = 'Synthèse des analyses des agents:\n\n';
    for (let i = 0; i < results.length; i++) {
      finalResult += `Agent ${i + 1}: ${results[i]}\n\n`;
    }

    if (this.observer) {
      this.observer.onSocietyComplete(finalResult);
    }

    return finalResult;
  }

  /**
   * Collecte les résultats et utilise un modèle dédié pour la synthèse
   */
  async collectResultsWithSynthesisModel(
    synthesisModel: AIModel,
    signal?: AbortSignal
  ): Promise<string> {
    const results: string[] = [];

    // Récupérer les résultats des agents
    for (const agent of this.agents) {
      const response = await agent.model.process(agent.prompt, signal);
      results.push(response);
    }

    // Présentation des résultats individuels
    let finalResult = 'Synthèse des analyses des agents:\n\n';
    for (let i = 0; i < results.length; i++) {
      finalResult += `Agent ${i + 1}: ${results[i]}\n\n`;
    }

    try {
      // Utiliser le modèle de synthèse
      const synthesis = await synthesizeWithModel(results, synthesisModel, signal);
      finalResult += '\nConclusion consolidée (via modèle de synthèse):\n' + synthesis;
    } catch (error) {
      // En cas d'erreur, utiliser la méthode simple
      finalResult +=
        '\nConclusion consolidée (méthode simple - erreur du modèle de synthèse):\n' +
        synthesizeResults(results) +
        '\n\nErreur de synthèse: ' +
        (error as Error).message;
    }

    if (this.observer) {
      this.observer.onSocietyComplete(finalResult);
    }

    return finalResult;
  }

  /**
   * Effectue l'analyse initiale du prompt (mode collaboratif)
   */
  async performInitialAnalysis(signal?: AbortSignal): Promise<void> {
    if (this.agents.length === 0) {
      throw new Error('Aucun agent disponible pour l\'analyse');
    }

    if (this.observer) {
      this.observer.onPhaseStart('Analyse initiale');
    }

    const primaryAgent = this.agents[0];

    const analysisPrompt =
      'Analyse profondément cette demande pour en comprendre l\'essence, les attentes implicites et explicites, ' +
      'et le niveau de détail approprié pour y répondre de manière optimale: ' +
      primaryAgent.prompt;

    const initialAnalysis = await primaryAgent.model.process(analysisPrompt, signal);

    if (this.context) {
      this.context.initialAnalysis = initialAnalysis;
    }

    // Partager l'analyse avec tous les agents
    for (const agent of this.agents) {
      agent.sharedAnalysis = initialAnalysis;
    }

    if (this.observer) {
      this.observer.onPhaseComplete('Analyse initiale');
    }
  }

  /**
   * Fait explorer les différentes dimensions du sujet par les agents (mode collaboratif)
   */
  async exploreDimensions(signal?: AbortSignal): Promise<void> {
    if (this.observer) {
      this.observer.onPhaseStart('Exploration des dimensions');
    }

    const insights = await Promise.all(
      this.agents.map(async (agent) => {
        const explorationPrompt = `En te basant sur cette analyse initiale:\n\n${agent.sharedAnalysis}\n\n` +
          `Explore en profondeur cette dimension spécifique: ${agent.dimensionToExplore}\n\n` +
          `Pour la question originale: ${agent.prompt}\n\n` +
          `Analyse cette dimension de manière détaillée et approfondie, en tenant compte des autres aspects ` +
          `mais en te concentrant particulièrement sur cette dimension. ` +
          `Pense étape par étape et développe une analyse nuancée et complète.`;

        return await agent.model.process(explorationPrompt, signal);
      })
    );

    if (this.context) {
      this.context.sharedInsights = insights;
    }

    if (this.observer) {
      this.observer.onPhaseComplete('Exploration des dimensions');
    }
  }

  /**
   * Intègre les analyses des différentes dimensions (mode collaboratif)
   */
  async integrateAnalyses(signal?: AbortSignal): Promise<void> {
    if (this.agents.length === 0 || !this.context?.sharedInsights?.length) {
      throw new Error('Aucune analyse à intégrer');
    }

    if (this.observer) {
      this.observer.onPhaseStart('Intégration des analyses');
    }

    const primaryAgent = this.agents[0];

    let integrationPrompt =
      'Intègre organiquement ces différentes analyses en une compréhension cohérente et unifiée:\n\n';

    integrationPrompt += 'Compréhension initiale de la demande:\n' + this.context.initialAnalysis + '\n\n';

    for (let i = 0; i < this.context.sharedInsights.length; i++) {
      integrationPrompt +=
        `Dimension: ${this.agents[i].dimensionToExplore}\n${this.context.sharedInsights[i]}\n\n`;
    }

    integrationPrompt +=
      'Ta tâche est de synthétiser ces analyses en une compréhension intégrée qui combine ' +
      'organiquement toutes les dimensions, en évitant de simplement juxtaposer les informations. ' +
      'Identifie les connexions, les patterns et les idées transversales. ' +
      'Forme une analyse unifiée qui représente une réflexion collaborative approfondie.';

    const integratedAnalysis = await primaryAgent.model.process(integrationPrompt, signal);

    if (this.context) {
      this.context.integratedAnalysis = integratedAnalysis;
    }

    // Partager l'analyse intégrée avec tous les agents
    for (const agent of this.agents) {
      agent.sharedAnalysis = integratedAnalysis;
    }

    if (this.observer) {
      this.observer.onPhaseComplete('Intégration des analyses');
    }
  }

  /**
   * Génère la réponse finale basée sur l'analyse intégrée (mode collaboratif)
   */
  async generateFinalResponse(signal?: AbortSignal): Promise<string> {
    if (this.agents.length === 0) {
      throw new Error('Aucun agent disponible pour générer la réponse');
    }

    if (this.observer) {
      this.observer.onPhaseStart('Génération de la réponse finale');
    }

    const primaryAgent = this.agents[0];

    const responsePrompt =
      `En t'appuyant sur cette analyse intégrée et approfondie:\n\n${primaryAgent.sharedAnalysis}\n\n` +
      `Formule une réponse directe, claire et complète à la demande originale: ${primaryAgent.prompt}\n\n` +
      `La réponse doit être parfaitement adaptée aux besoins implicites et explicites de l'utilisateur, ` +
      `en intégrant harmonieusement les perspectives des différentes dimensions analysées. ` +
      `La réponse doit être cohérente, structurée et offrir un maximum de valeur à l'utilisateur. ` +
      `N'inclus pas de mentions du processus analytique, concentre-toi uniquement sur la réponse à la demande.`;

    const finalResponse = await primaryAgent.model.process(responsePrompt, signal);

    if (this.observer) {
      this.observer.onPhaseComplete('Génération de la réponse finale');
      this.observer.onSocietyComplete(finalResponse);
    }

    return finalResponse;
  }
}

/**
 * Crée une société d'agents
 */
export function createSociety(
  config: SocietyConfig,
  models: AIModel[],
  observer?: SocietyObserver
): SocietyGroup {
  const agents: Agent[] = [];

  for (let i = 0; i < config.agentCount; i++) {
    let model: AIModel;
    if (config.multiModel && models.length > 1) {
      model = models[i % models.length];
    } else {
      model = models[0];
    }

    const agentPrompt = generatePromptForAgent(config.prompt, i);

    const agent: Agent = {
      id: i,
      model,
      prompt: agentPrompt,
    };

    agents.push(agent);
  }

  return new SocietyGroup(agents, models, config.multiModel, undefined, observer);
}

/**
 * Crée une société d'agents collaboratifs
 */
export function createCollaborativeSociety(
  config: SocietyConfig,
  models: AIModel[],
  observer?: SocietyObserver
): SocietyGroup {
  const dimensions = [
    'Compréhension fondamentale et factuelle du sujet',
    'Aspects pratiques et mise en œuvre concrète',
    'Implications plus larges et considérations de contexte',
    'Défis potentiels et approches pour les surmonter',
    'Applications pratiques et exemples concrets',
  ];

  const limitedDimensions = dimensions.slice(0, Math.min(config.agentCount, dimensions.length));

  const context: CollaborativeContext = {
    dimensions: limitedDimensions,
    sharedInsights: [],
  };

  const agents: Agent[] = [];

  for (let i = 0; i < config.agentCount; i++) {
    let model: AIModel;
    if (config.multiModel && models.length > 1) {
      model = models[i % models.length];
    } else {
      model = models[0];
    }

    const dimensionIndex = i % limitedDimensions.length;

    const agent: Agent = {
      id: i,
      model,
      prompt: config.prompt,
      phase: 0,
      dimensionToExplore: limitedDimensions[dimensionIndex],
    };

    agents.push(agent);
  }

  return new SocietyGroup(agents, models, config.multiModel, context, observer);
}

/**
 * Personnalise légèrement le prompt pour chaque agent
 */
function generatePromptForAgent(basePrompt: string, agentId: number): string {
  const perspectives = [
    'Analyse cette demande de manière factuelle et concise: ',
    'Considère les implications et le contexte plus large de cette demande: ',
    'Identifie les exigences spécifiques et le but de cette demande: ',
    'Réfléchis aux approches les plus innovantes pour répondre à cette demande: ',
    'Examine les aspects techniques et pratiques de cette demande: ',
  ];

  const perspective = perspectives[agentId % perspectives.length];
  return perspective + basePrompt;
}

/**
 * Combine les résultats des agents en une réponse cohérente
 */
function synthesizeResults(results: string[]): string {
  let synthesis = 'Synthèse des résultats:\n';
  for (let i = 0; i < results.length; i++) {
    synthesis += `\nAgent ${i + 1}:\n${results[i]}\n`;
  }
  return synthesis;
}

/**
 * Combine les résultats des agents en utilisant un modèle spécifique
 */
async function synthesizeWithModel(
  results: string[],
  model: AIModel,
  signal?: AbortSignal
): Promise<string> {
  let prompt = 'Analyse et synthétise les perspectives suivantes des agents en une réponse cohérente et approfondie:\n\n';

  for (let i = 0; i < results.length; i++) {
    prompt += `=== AGENT ${i + 1} ===\n${results[i]}\n\n`;
  }

  prompt +=
    'Ta tâche est de produire une synthèse complète qui:\n' +
    '1. Identifie les points d\'accord et de désaccord entre les agents\n' +
    '2. Combine les perspectives uniques en une vision cohérente\n' +
    '3. Présente une conclusion qui intègre les meilleures idées de chaque agent\n' +
    '4. Offre une réponse finale plus complète que chacune des perspectives individuelles\n\n' +
    'Synthèse:';

  return await model.process(prompt, signal);
}

/**
 * Crée une société d'agents qui analysent le prompt et travaillent ensemble
 * pour générer une réponse améliorée
 */
export async function society(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel = false,
  observer?: SocietyObserver
): Promise<string> {
  if (agentCount <= 0) {
    throw new InvalidAgentCountError();
  }

  if (models.length === 0) {
    throw new NoModelsSpecifiedError();
  }

  return await runSociety(
    {
      prompt,
      agentCount,
      multiModel,
      observer,
    },
    models
  );
}

/**
 * Crée une société d'agents qui analysent le prompt et utilise
 * un modèle dédié pour synthétiser les résultats des agents
 */
export async function societyWithSynthesis(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel: boolean,
  synthModel: AIModel,
  observer?: SocietyObserver
): Promise<string> {
  if (agentCount <= 0) {
    throw new InvalidAgentCountError();
  }

  if (models.length === 0) {
    throw new NoModelsSpecifiedError();
  }

  if (!synthModel) {
    throw new SynthesisModelRequiredError();
  }

  return await runSocietyWithSynthesis(
    {
      prompt,
      agentCount,
      multiModel,
      observer,
    },
    models,
    synthModel
  );
}

/**
 * Crée une société d'agents qui travaillent ensemble de manière collaborative,
 * avec une analyse initiale commune et une exploration de dimensions complémentaires
 */
export async function societyCollaborative(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel = false,
  observer?: SocietyObserver
): Promise<string> {
  if (agentCount <= 0) {
    throw new InvalidAgentCountError();
  }

  if (models.length === 0) {
    throw new NoModelsSpecifiedError();
  }

  return await runSocietyCollaborative(
    {
      prompt,
      agentCount,
      multiModel,
      collaborative: true,
      observer,
    },
    models
  );
}

/**
 * Exécute la société d'agents avec les configurations fournies
 */
export async function runSociety(config: SocietyConfig, models: AIModel[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = config.timeout
    ? setTimeout(() => controller.abort(), config.timeout)
    : undefined;

  try {
    const societyGroup = createSociety(config, models, config.observer);
    await societyGroup.run(controller.signal);
    const result = await societyGroup.collectResults(controller.signal);

    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Exécute la société d'agents avec les configurations fournies
 * et utilise un modèle spécifique pour la synthèse finale
 */
export async function runSocietyWithSynthesis(
  config: SocietyConfig,
  models: AIModel[],
  synthModel: AIModel
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = config.timeout
    ? setTimeout(() => controller.abort(), config.timeout)
    : undefined;

  try {
    const societyGroup = createSociety(config, models, config.observer);
    await societyGroup.run(controller.signal);
    const result = await societyGroup.collectResultsWithSynthesisModel(
      synthModel,
      controller.signal
    );

    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Exécute la société d'agents en mode collaboratif
 */
export async function runSocietyCollaborative(
  config: SocietyConfig,
  models: AIModel[]
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = config.timeout
    ? setTimeout(() => controller.abort(), config.timeout)
    : undefined;

  try {
    const societyGroup = createCollaborativeSociety(config, models, config.observer);

    await societyGroup.performInitialAnalysis(controller.signal);
    await societyGroup.exploreDimensions(controller.signal);
    await societyGroup.integrateAnalyses(controller.signal);
    const result = await societyGroup.generateFinalResponse(controller.signal);

    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}
