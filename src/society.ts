import {
  AIModel,
  AgentConfig,
  AgentRole,
  AgentMessage,
  CommunicationChannel,
  WorkflowConfig,
  WorkflowStep,
  WorkflowContext,
  WorkflowResult,
  WorkflowExecutor,
  StepResult,
  WorkflowStepExecutionType,
  SocietyObserver,
} from './types';
import { getLogger } from './logger';
import { WorkerPool } from './worker-pool';

// ============================================================================
// SYSTÈME DE COMMUNICATION ENTRE AGENTS
// ============================================================================

/**
 * Implémentation par défaut du canal de communication
 */
export class MessageBus implements CommunicationChannel {
  private handlers: Map<string, (message: AgentMessage) => void> = new Map();
  private history: AgentMessage[] = [];

  async send(message: AgentMessage): Promise<void> {
    this.history.push(message);

    if (message.to === 'broadcast') {
      // Envoyer à tous les abonnés
      for (const [agentId, handler] of this.handlers) {
        if (agentId !== message.from) {
          handler(message);
        }
      }
    } else {
      // Envoyer au destinataire spécifique
      const handler = this.handlers.get(message.to);
      if (handler) {
        handler(message);
      }
    }
  }

  subscribe(agentId: string, handler: (message: AgentMessage) => void): void {
    this.handlers.set(agentId, handler);
  }

  unsubscribe(agentId: string): void {
    this.handlers.delete(agentId);
  }

  getHistory(filter?: { from?: string; to?: string; type?: string }): AgentMessage[] {
    if (!filter) return [...this.history];

    return this.history.filter((msg) => {
      if (filter.from && msg.from !== filter.from) return false;
      if (filter.to && msg.to !== filter.to && msg.to !== 'broadcast') return false;
      if (filter.type && msg.type !== filter.type) return false;
      return true;
    });
  }

  clearHistory(): void {
    this.history = [];
  }
}

// ============================================================================
// BUILDERS POUR CONFIGURATION FACILE
// ============================================================================

/**
 * Builder pour créer des rôles d'agents
 */
export class RoleBuilder {
  private role: Partial<AgentRole> = {};

  constructor(idOrName?: string) {
    if (idOrName) {
      this.role.id = idOrName;
      this.role.name = idOrName;
    }
  }

  static create(): RoleBuilder {
    return new RoleBuilder();
  }

  withId(id: string): this {
    this.role.id = id;
    return this;
  }

  withName(name: string): this {
    this.role.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.role.description = description;
    return this;
  }

  withSystemPrompt(prompt: string): this {
    this.role.systemPrompt = prompt;
    return this;
  }

  withCapabilities(capabilities: string[]): this {
    this.role.capabilities = capabilities;
    return this;
  }

  withConstraints(constraints: string[]): this {
    this.role.constraints = constraints;
    return this;
  }

  withPromptTemplate(template: string): this {
    this.role.promptTemplate = template;
    return this;
  }

  build(): AgentRole {
    if (!this.role.id) throw new Error('Role id is required');
    if (!this.role.name) throw new Error('Role name is required');
    if (!this.role.systemPrompt) throw new Error('Role systemPrompt is required');

    return {
      id: this.role.id,
      name: this.role.name,
      systemPrompt: this.role.systemPrompt,
      description: this.role.description,
      capabilities: this.role.capabilities,
      constraints: this.role.constraints,
      promptTemplate: this.role.promptTemplate,
    };
  }
}

/**
 * Builder pour créer des configurations d'agents
 */
export class AgentBuilder {
  private config: Partial<AgentConfig> = {};

  constructor(id?: string) {
    if (id) {
      this.config.id = id;
      this.config.name = id;
    }
  }

  static create(): AgentBuilder {
    return new AgentBuilder();
  }

  withId(id: string): this {
    this.config.id = id;
    return this;
  }

  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  withRole(role: AgentRole): this {
    this.config.role = role;
    return this;
  }

  withModel(model: AIModel): this {
    this.config.model = model;
    return this;
  }

  canCommunicateWith(agentIds: string[]): this {
    this.config.canCommunicateWith = agentIds;
    return this;
  }

  withPriority(priority: number): this {
    this.config.priority = priority;
    return this;
  }

  withInitialContext(context: Record<string, unknown>): this {
    this.config.initialContext = context;
    return this;
  }

  build(): AgentConfig {
    if (!this.config.id) throw new Error('Agent id is required');
    if (!this.config.role) throw new Error('Agent role is required');
    if (!this.config.model) throw new Error('Agent model is required');

    return {
      id: this.config.id,
      name: this.config.name,
      role: this.config.role,
      model: this.config.model,
      canCommunicateWith: this.config.canCommunicateWith,
      priority: this.config.priority ?? 0,
      initialContext: this.config.initialContext,
    };
  }
}

/**
 * Builder pour créer des étapes de workflow
 */
export class StepBuilder {
  private step: Partial<WorkflowStep> = {};

  constructor(id?: string) {
    if (id) {
      this.step.id = id;
      this.step.name = id;
    }
  }

  static create(): StepBuilder {
    return new StepBuilder();
  }

  withId(id: string): this {
    this.step.id = id;
    return this;
  }

  withName(name: string): this {
    this.step.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.step.description = description;
    return this;
  }

  withAgents(agentIds: string[]): this {
    this.step.agentIds = agentIds;
    return this;
  }

  withExecutionType(type: WorkflowStepExecutionType): this {
    this.step.executionType = type;
    return this;
  }

  withInstructions(instructions: string): this {
    this.step.instructions = instructions;
    return this;
  }

  withPromptTemplate(template: string): this {
    this.step.promptTemplate = template;
    return this;
  }

  withMaxIterations(max: number): this {
    this.step.maxIterations = max;
    return this;
  }

  withCompletionCondition(condition: WorkflowStep['completionCondition']): this {
    this.step.completionCondition = condition;
    return this;
  }

  withResultTransformer(transformer: WorkflowStep['resultTransformer']): this {
    this.step.resultTransformer = transformer;
    return this;
  }

  withCondition(condition: WorkflowStep['condition']): this {
    this.step.condition = condition;
    return this;
  }

  withNextSteps(stepIds: string[]): this {
    this.step.nextSteps = stepIds;
    return this;
  }

  withNextStepResolver(resolver: WorkflowStep['nextStepResolver']): this {
    this.step.nextStepResolver = resolver;
    return this;
  }

  build(): WorkflowStep {
    if (!this.step.id) throw new Error('Step id is required');
    if (!this.step.name) throw new Error('Step name is required');
    if (!this.step.agentIds || this.step.agentIds.length === 0) {
      throw new Error('Step must have at least one agent');
    }

    return {
      id: this.step.id,
      name: this.step.name,
      description: this.step.description,
      agentIds: this.step.agentIds,
      executionType: this.step.executionType ?? 'sequential',
      instructions: this.step.instructions,
      promptTemplate: this.step.promptTemplate,
      maxIterations: this.step.maxIterations,
      completionCondition: this.step.completionCondition,
      resultTransformer: this.step.resultTransformer,
      condition: this.step.condition,
      nextSteps: this.step.nextSteps,
      nextStepResolver: this.step.nextStepResolver,
    };
  }
}

/**
 * Builder pour créer des workflows complets
 */
export class WorkflowConfigBuilder {
  private config: Partial<WorkflowConfig> = {
    agents: [],
    steps: [],
  };

  constructor(id?: string) {
    if (id) {
      this.config.id = id;
      this.config.name = id;
    }
  }

  static create(): WorkflowConfigBuilder {
    return new WorkflowConfigBuilder();
  }

  withId(id: string): this {
    this.config.id = id;
    return this;
  }

  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  addAgent(agent: AgentConfig): this {
    this.config.agents!.push(agent);
    return this;
  }

  addAgents(agents: AgentConfig[]): this {
    this.config.agents!.push(...agents);
    return this;
  }

  addStep(step: WorkflowStep): this {
    this.config.steps!.push(step);
    return this;
  }

  addSteps(steps: WorkflowStep[]): this {
    this.config.steps!.push(...steps);
    return this;
  }

  withEntryStep(stepId: string): this {
    this.config.entryStepId = stepId;
    return this;
  }

  withGlobalContext(context: Record<string, unknown>): this {
    this.config.globalContext = context;
    return this;
  }

  onBeforeStep(handler: WorkflowConfig['onBeforeStep']): this {
    this.config.onBeforeStep = handler;
    return this;
  }

  onAfterStep(handler: WorkflowConfig['onAfterStep']): this {
    this.config.onAfterStep = handler;
    return this;
  }

  withFinalResultGenerator(generator: WorkflowConfig['finalResultGenerator']): this {
    this.config.finalResultGenerator = generator;
    return this;
  }

  build(): WorkflowConfig {
    if (!this.config.id) throw new Error('Workflow id is required');
    if (!this.config.name) throw new Error('Workflow name is required');
    if (this.config.agents!.length === 0) throw new Error('Workflow must have at least one agent');
    if (this.config.steps!.length === 0) throw new Error('Workflow must have at least one step');

    return {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description,
      agents: this.config.agents!,
      steps: this.config.steps!,
      entryStepId: this.config.entryStepId ?? this.config.steps![0].id,
      globalContext: this.config.globalContext,
      onBeforeStep: this.config.onBeforeStep,
      onAfterStep: this.config.onAfterStep,
      finalResultGenerator: this.config.finalResultGenerator,
    };
  }
}

// ============================================================================
// EXÉCUTEUR DE WORKFLOW CONFIGURABLE
// ============================================================================

/**
 * Exécuteur de workflow par défaut
 */
export class DefaultWorkflowExecutor implements WorkflowExecutor {
  private logger = getLogger();
  private messageBus: MessageBus;
  private observer?: SocietyObserver;

  constructor(observer?: SocietyObserver) {
    this.messageBus = new MessageBus();
    this.observer = observer;
  }

  /**
   * Crée le prompt complet pour un agent à une étape donnée
   */
  private buildAgentPrompt(
    agent: AgentConfig,
    step: WorkflowStep,
    context: WorkflowContext
  ): string {
    // Template par défaut si aucun n'est spécifié
    const defaultTemplate = '{systemPrompt}\n\n{instructions}\n\nInput: {input}\n\nContext: {context}';
    const template = step.promptTemplate ?? agent.role.promptTemplate ?? defaultTemplate;

    // Préparer les données de contexte
    const contextData: Record<string, string> = {
      systemPrompt: agent.role.systemPrompt,
      instructions: step.instructions ?? '',
      input: context.input,
      context: this.formatSharedData(context.sharedData),
      history: this.formatMessageHistory(context.messageHistory, agent.id),
      previousResults: this.formatPreviousResults(context.stepResults),
    };

    // Appliquer les capacités et contraintes
    if (agent.role.capabilities?.length) {
      contextData.capabilities = `Capabilities: ${agent.role.capabilities.join(', ')}`;
    }
    if (agent.role.constraints?.length) {
      contextData.constraints = `Constraints: ${agent.role.constraints.join(', ')}`;
    }

    // Remplacer les placeholders
    let prompt = template;
    for (const [key, value] of Object.entries(contextData)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return prompt;
  }

  private formatSharedData(data: Map<string, unknown>): string {
    if (data.size === 0) return '';
    const entries: string[] = [];
    for (const [key, value] of data) {
      entries.push(`${key}: ${JSON.stringify(value)}`);
    }
    return entries.join('\n');
  }

  private formatMessageHistory(messages: AgentMessage[], agentId: string): string {
    const relevant = messages.filter(
      (m) => m.from === agentId || m.to === agentId || m.to === 'broadcast'
    );
    if (relevant.length === 0) return '';
    return relevant.map((m) => `[${m.from} → ${m.to}]: ${m.content}`).join('\n');
  }

  private formatPreviousResults(results: Map<string, StepResult[]>): string {
    if (results.size === 0) return '';
    const formatted: string[] = [];
    for (const [stepId, stepResults] of results) {
      formatted.push(`--- Step: ${stepId} ---`);
      for (const result of stepResults) {
        if (result.success) {
          formatted.push(`[${result.agentId}]: ${result.content}`);
        }
      }
    }
    return formatted.join('\n');
  }

  /**
   * Exécute une étape séquentielle
   */
  private async executeSequential(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    for (const agentId of step.agentIds) {
      if (signal?.aborted) throw new Error('Operation cancelled');

      const agent = agents.get(agentId);
      if (!agent) {
        this.logger.error(`Agent ${agentId} not found`);
        continue;
      }

      const prompt = this.buildAgentPrompt(agent, step, context);
      this.logger.debug(`Agent ${agentId} processing step ${step.id}`);

      if (this.observer) {
        this.observer.onAgentStart(parseInt(agentId) || 0, agent.model.name(), prompt);
      }

      try {
        const content = await agent.model.process(prompt, signal);
        const result: StepResult = {
          agentId,
          stepId: step.id,
          content,
          timestamp: Date.now(),
          success: true,
        };
        results.push(result);

        // Mettre à jour le contexte partagé
        context.sharedData.set(`${step.id}_${agentId}_result`, content);

        if (this.observer) {
          this.observer.onAgentComplete(parseInt(agentId) || 0, agent.model.name(), content);
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        const result: StepResult = {
          agentId,
          stepId: step.id,
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error as Error,
        };
        results.push(result);

        if (this.observer) {
          this.observer.onAgentError(parseInt(agentId) || 0, agent.model.name(), error as Error);
        }
      }
    }

    return results;
  }

  /**
   * Exécute une étape en parallèle
   */
  private async executeParallel(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]> {
    const pool = new WorkerPool(step.agentIds.length, signal);
    const results: StepResult[] = [];

    const tasks = step.agentIds.map((agentId) => async () => {
      const agent = agents.get(agentId);
      if (!agent) {
        this.logger.error(`Agent ${agentId} not found`);
        return null;
      }

      const prompt = this.buildAgentPrompt(agent, step, context);
      this.logger.debug(`Agent ${agentId} processing step ${step.id} (parallel)`);

      if (this.observer) {
        this.observer.onAgentStart(parseInt(agentId) || 0, agent.model.name(), prompt);
      }

      try {
        const content = await agent.model.process(prompt, signal);
        const result: StepResult = {
          agentId,
          stepId: step.id,
          content,
          timestamp: Date.now(),
          success: true,
        };

        if (this.observer) {
          this.observer.onAgentComplete(parseInt(agentId) || 0, agent.model.name(), content);
        }

        return result;
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        if (this.observer) {
          this.observer.onAgentError(parseInt(agentId) || 0, agent.model.name(), error as Error);
        }

        return {
          agentId,
          stepId: step.id,
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error as Error,
        } as StepResult;
      }
    });

    const taskResults = await Promise.all(tasks.map((task) => pool.submit(task)));
    await pool.waitAll();

    for (const result of taskResults) {
      if (result) {
        results.push(result);
        if (result.success) {
          context.sharedData.set(`${step.id}_${result.agentId}_result`, result.content);
        }
      }
    }

    return results;
  }

  /**
   * Exécute une étape collaborative (avec échanges entre agents)
   */
  private async executeCollaborative(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]> {
    const maxIterations = step.maxIterations ?? 3;
    let allResults: StepResult[] = [];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (signal?.aborted) throw new Error('Operation cancelled');

      this.logger.info(`Collaborative step ${step.id} - iteration ${iteration + 1}/${maxIterations}`);

      // Chaque agent traite avec accès à l'historique des messages
      const iterationResults: StepResult[] = [];

      for (const agentId of step.agentIds) {
        const agent = agents.get(agentId);
        if (!agent) continue;

        // Enrichir le contexte avec les résultats de cette itération
        const enrichedContext = { ...context };
        enrichedContext.sharedData = new Map(context.sharedData);
        enrichedContext.sharedData.set('currentIteration', iteration);
        enrichedContext.sharedData.set('previousIterationResults', allResults);

        const prompt = this.buildAgentPrompt(agent, step, enrichedContext);

        try {
          const content = await agent.model.process(prompt, signal);
          const result: StepResult = {
            agentId,
            stepId: step.id,
            content,
            timestamp: Date.now(),
            success: true,
            iteration,
          };
          iterationResults.push(result);

          // Permettre à l'agent d'envoyer un message aux autres
          const message: AgentMessage = {
            from: agentId,
            to: 'broadcast',
            type: 'data',
            content: content,
            timestamp: Date.now(),
            messageId: `${agentId}-${step.id}-${iteration}-${Date.now()}`,
          };
          await this.messageBus.send(message);
          context.messageHistory.push(message);
        } catch (error) {
          if (signal?.aborted) {
            throw error;
          }
          iterationResults.push({
            agentId,
            stepId: step.id,
            content: '',
            timestamp: Date.now(),
            success: false,
            error: error as Error,
            iteration,
          });
        }
      }

      allResults = [...allResults, ...iterationResults];

      // Vérifier la condition de complétion
      if (step.completionCondition && step.completionCondition(allResults, iteration)) {
        this.logger.info(`Collaborative step ${step.id} completed at iteration ${iteration + 1}`);
        break;
      }
    }

    return allResults;
  }

  /**
   * Exécute une étape du workflow
   */
  async executeStep(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    signal?: AbortSignal
  ): Promise<StepResult[]> {
    this.logger.info(`Executing step: ${step.name} (${step.executionType})`);

    if (this.observer) {
      this.observer.onPhaseStart(step.name);
    }

    // Vérifier la condition si c'est une étape conditionnelle
    if (step.executionType === 'conditional' && step.condition) {
      if (!step.condition(context.stepResults)) {
        this.logger.info(`Step ${step.id} skipped (condition not met)`);
        if (this.observer) {
          this.observer.onPhaseComplete(step.name);
        }
        return [];
      }
    }

    let results: StepResult[];

    switch (step.executionType) {
      case 'parallel':
        results = await this.executeParallel(step, agents, context, signal);
        break;
      case 'collaborative':
        results = await this.executeCollaborative(step, agents, context, signal);
        break;
      case 'sequential':
      case 'conditional':
      default:
        results = await this.executeSequential(step, agents, context, signal);
        break;
    }

    // Appliquer le transformateur de résultats si défini
    if (step.resultTransformer && results.length > 0) {
      const transformedContent = step.resultTransformer(results);
      context.sharedData.set(`${step.id}_transformed`, transformedContent);
    }

    if (this.observer) {
      this.observer.onPhaseComplete(step.name);
    }

    return results;
  }

  /**
   * Exécute un workflow complet
   */
  async execute(
    workflow: WorkflowConfig,
    input: string,
    signal?: AbortSignal
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const errors: Error[] = [];

    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    this.logger.info(`Starting workflow: ${workflow.name}`);

    if (this.observer) {
      this.observer.onSocietyStart(input, workflow.agents.length);
    }

    // Créer la map des agents
    const agentsMap = new Map<string, AgentConfig>();
    for (const agent of workflow.agents) {
      agentsMap.set(agent.id, agent);
      // Abonner l'agent au bus de messages
      this.messageBus.subscribe(agent.id, (message) => {
        this.logger.debug(`Agent ${agent.id} received message from ${message.from}`);
      });
    }

    // Initialiser le contexte
    const context: WorkflowContext = {
      input,
      sharedData: new Map(Object.entries(workflow.globalContext ?? {})),
      stepResults: new Map(),
      messageHistory: [],
      metadata: {},
    };

    // Créer la map des étapes pour navigation
    const stepsMap = new Map<string, WorkflowStep>();
    for (const step of workflow.steps) {
      stepsMap.set(step.id, step);
    }

    // Exécuter les étapes
    let currentStepId: string | null = workflow.entryStepId ?? workflow.steps[0].id;

    while (currentStepId) {
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      const step = stepsMap.get(currentStepId);
      if (!step) {
        errors.push(new Error(`Step ${currentStepId} not found`));
        break;
      }

      // Hook avant l'étape
      if (workflow.onBeforeStep) {
        await workflow.onBeforeStep(step, context);
      }

      try {
        const stepResults = await this.executeStep(step, agentsMap, context, signal);
        context.stepResults.set(step.id, stepResults);

        // Remonter les erreurs au niveau workflow si un agent a échoué
        for (const stepResult of stepResults) {
          if (!stepResult.success && stepResult.error) {
            errors.push(stepResult.error);
          }
        }

        // Hook après l'étape
        if (workflow.onAfterStep) {
          await workflow.onAfterStep(step, stepResults, context);
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        errors.push(error as Error);
        this.logger.error(`Step ${step.id} failed: ${(error as Error).message}`);
      }

      // Déterminer l'étape suivante
      if (step.nextStepResolver) {
        currentStepId = step.nextStepResolver(context.stepResults.get(step.id) ?? []);
      } else if (step.nextSteps && step.nextSteps.length > 0) {
        currentStepId = step.nextSteps[0]; // Par défaut, prendre la première
      } else {
        // Trouver l'étape suivante dans l'ordre
        const currentIndex = workflow.steps.findIndex((s) => s.id === currentStepId);
        if (currentIndex >= 0 && currentIndex < workflow.steps.length - 1) {
          currentStepId = workflow.steps[currentIndex + 1].id;
        } else {
          currentStepId = null;
        }
      }
    }

    // Générer le résultat final
    let output: string;
    if (workflow.finalResultGenerator) {
      output = await workflow.finalResultGenerator(context.stepResults, context);
    } else {
      output = this.generateDefaultOutput(context.stepResults);
    }

    // Nettoyer
    for (const agent of workflow.agents) {
      this.messageBus.unsubscribe(agent.id);
    }

    const result: WorkflowResult = {
      success: errors.length === 0,
      output,
      stepResults: context.stepResults,
      messages: context.messageHistory,
      duration: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };

    if (this.observer) {
      this.observer.onSocietyComplete(output);
    }

    this.logger.info(`Workflow completed in ${result.duration}ms`);

    return result;
  }

  private generateDefaultOutput(stepResults: Map<string, StepResult[]>): string {
    const parts: string[] = [];
    for (const [stepId, results] of stepResults) {
      parts.push(`=== ${stepId} ===`);
      for (const result of results) {
        if (result.success) {
          parts.push(`[${result.agentId}]: ${result.content}`);
        }
      }
      parts.push('');
    }
    return parts.join('\n');
  }
}
