/**
 * @fileoverview Router Interface
 *
 * Defines the interface for conditional routing in workflows
 */

import { StepResult } from '../../core/types';

/**
 * Router interface for determining next step execution
 */
export interface Router {
  /**
   * Evaluate results and determine the next step(s) to execute
   *
   * @param results - Results from current step
   * @param context - Additional context for decision making
   * @returns ID(s) of next step(s) to execute, or null to stop
   */
  route(results: StepResult[], context?: Record<string, unknown>): string | string[] | null;
}

/**
 * Condition function type for routing decisions
 */
export type ConditionFn = (results: StepResult[], context?: Record<string, unknown>) => boolean;

/**
 * Route mapping for conditional routing
 */
export interface RouteMap {
  condition: ConditionFn;
  nextStep: string | string[];
}
