/**
 * @fileoverview Execution Strategy Base Interface
 *
 * Defines the core interface for workflow execution strategies
 */

import { WorkflowStep, StepResult, WorkflowContext, AgentConfig } from '../../core/types';

/**
 * Interface for workflow execution strategies
 *
 * Different strategies can implement different execution patterns:
 * - Sequential: Execute agents one by one
 * - Parallel: Execute all agents simultaneously
 * - Collaborative: Execute with inter-agent communication
 */
export interface ExecutionStrategy {
  /**
   * Name identifier for this strategy
   */
  readonly name: string;

  /**
   * Execute a workflow step using this strategy
   *
   * @param step - The workflow step to execute
   * @param agents - Available agents for execution
   * @param context - Current workflow context
   * @param input - Input data for the step
   * @returns Array of results from agent executions
   */
  execute(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    input: string
  ): Promise<StepResult[]>;
}
