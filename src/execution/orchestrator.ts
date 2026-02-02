/**
 * @fileoverview Workflow Orchestrator
 *
 * Central orchestrator that delegates execution to strategy implementations
 */

import {
  WorkflowStep,
  StepResult,
  WorkflowContext,
  AgentConfig,
  WorkflowStepExecutionType,
} from '../core/types';
import { ExecutionStrategy } from './strategies/base';
import { SequentialStrategy } from './strategies/sequential';
import { ParallelStrategy } from './strategies/parallel';
import { Router } from './routing/router';
import { getLogger } from '../observability/logger';

/**
 * Orchestrator manages workflow execution by delegating to strategies
 * This provides a clean separation between orchestration logic and execution patterns
 *
 * @internal This class is currently not used by the main Society API.
 * It is reserved for future architectural convergence.
 */
export class Orchestrator {
  private logger = getLogger();
  private strategies: Map<WorkflowStepExecutionType, ExecutionStrategy>;
  private router?: Router;

  constructor(router?: Router) {
    // Register built-in strategies
    this.strategies = new Map();
    this.strategies.set('sequential', new SequentialStrategy());
    this.strategies.set('parallel', new ParallelStrategy());
    // 'collaborative' and 'conditional' will delegate to sequential for now
    this.strategies.set('collaborative', new SequentialStrategy());
    this.strategies.set('conditional', new SequentialStrategy());

    this.router = router;
  }

  /**
   * Register a custom execution strategy
   */
  registerStrategy(type: WorkflowStepExecutionType, strategy: ExecutionStrategy): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Set or update the router for conditional navigation
   */
  setRouter(router: Router): void {
    this.router = router;
  }

  /**
   * Execute a workflow step using the appropriate strategy
   */
  async executeStep(
    step: WorkflowStep,
    agents: Map<string, AgentConfig>,
    context: WorkflowContext,
    input: string
  ): Promise<StepResult[]> {
    const strategy = this.strategies.get(step.executionType);

    if (!strategy) {
      this.logger.error(`No strategy found for execution type: ${step.executionType}`);
      throw new Error(`Unsupported execution type: ${step.executionType}`);
    }

    this.logger.debug(`Executing step ${step.id} using ${strategy.name} strategy`);

    return await strategy.execute(step, agents, context, input);
  }

  /**
   * Determine the next step(s) to execute based on results
   * Uses the configured router if available
   */
  determineNextSteps(
    results: StepResult[],
    context?: Record<string, unknown>
  ): string | string[] | null {
    if (!this.router) {
      return null;
    }

    return this.router.route(results, context);
  }
}
