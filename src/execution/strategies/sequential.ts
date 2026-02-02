/**
 * @fileoverview Sequential Execution Strategy
 *
 * Executes agents one after another in order
 */

import { ExecutionStrategy } from './base';
import { WorkflowStep, StepResult, WorkflowContext, AgentConfig } from '../../core/types';
import { getLogger } from '../../observability/logger';

/**
 * Sequential execution strategy
 * Agents are executed one by one in the order specified
 */
export class SequentialStrategy implements ExecutionStrategy {
  readonly name = 'sequential';
  private logger = getLogger();

  /**
   * Execute agents sequentially
   */
  async execute(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    input: string
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    for (const agentId of step.agentIds) {
      const agent = agents.get(agentId);
      if (!agent) {
        this.logger.error(`Agent ${agentId} not found`);
        continue;
      }

      const prompt = this.buildPrompt(agent, step, context, input);
      this.logger.debug(`Agent ${agentId} processing step ${step.id}`);

      try {
        const content = await agent.model.process(prompt);
        const result: StepResult = {
          agentId,
          stepId: step.id,
          content,
          timestamp: Date.now(),
          success: true,
        };
        results.push(result);

        // Update shared context
        context.sharedData.set(`${step.id}_${agentId}_result`, content);
      } catch (error) {
        const result: StepResult = {
          agentId,
          stepId: step.id,
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error as Error,
        };
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Build the prompt for an agent
   */
  private buildPrompt(
    agent: AgentConfig,
    step: WorkflowStep,
    context: WorkflowContext,
    input: string
  ): string {
    const defaultTemplate =
      '{systemPrompt}\n\n{instructions}\n\nInput: {input}\n\nContext: {context}';
    const template = step.promptTemplate ?? agent.role.promptTemplate ?? defaultTemplate;

    const contextData: Record<string, string> = {
      systemPrompt: agent.role.systemPrompt,
      instructions: step.instructions ?? '',
      input: input,
      context: this.formatSharedData(context.sharedData),
      previousResults: this.formatPreviousResults(context.stepResults),
    };

    if (agent.role.capabilities?.length) {
      contextData.capabilities = `Capabilities: ${agent.role.capabilities.join(', ')}`;
    }
    if (agent.role.constraints?.length) {
      contextData.constraints = `Constraints: ${agent.role.constraints.join(', ')}`;
    }

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
}
