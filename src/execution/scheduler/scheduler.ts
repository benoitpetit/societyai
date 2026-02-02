/**
 * @fileoverview Scheduler for Workflow Execution
 *
 * Computes optimal execution order using topological sort
 */

import { DependencyGraph } from './dependency-graph';
import { InvalidConfigurationError } from '../../core/errors';

/**
 * Execution level - steps grouped by dependency level
 */
export interface ExecutionLevel {
  level: number;
  steps: string[];
}

/**
 * Scheduler computes execution order for workflow steps
 * Uses topological sort to determine the optimal order respecting dependencies
 */
export class Scheduler {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Compute topological sort order for all steps
   * Returns steps in an order where dependencies are always executed first
   */
  computeOrder(): string[] {
    this.graph.validate();

    const order: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (stepId: string): void => {
      if (visited.has(stepId)) return;

      visited.add(stepId);
      recursionStack.add(stepId);

      // Visit all dependencies first
      const dependencies = this.graph.getDependencies(stepId);
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          dfs(depId);
        }
      }

      recursionStack.delete(stepId);
      order.push(stepId);
    };

    // Visit all nodes
    const allSteps = this.graph.getAllSteps();
    for (const stepId of allSteps) {
      if (!visited.has(stepId)) {
        dfs(stepId);
      }
    }

    return order;
  }

  /**
   * Compute execution levels for parallel execution
   * Steps in the same level can be executed in parallel
   */
  computeLevels(): ExecutionLevel[] {
    this.graph.validate();

    const levels: ExecutionLevel[] = [];
    const completed = new Set<string>();
    let level = 0;

    while (completed.size < this.graph.getAllSteps().length) {
      const ready = this.graph.getReadySteps(completed);

      if (ready.length === 0 && completed.size < this.graph.getAllSteps().length) {
        throw new InvalidConfigurationError(
          'Cannot compute execution levels - possible circular dependency'
        );
      }

      if (ready.length > 0) {
        levels.push({
          level,
          steps: ready,
        });

        // Mark these steps as completed for next iteration
        for (const stepId of ready) {
          completed.add(stepId);
        }

        level++;
      }
    }

    return levels;
  }

  /**
   * Get the next steps that can be executed given completed steps
   */
  getNextSteps(completedSteps: Set<string>): string[] {
    return this.graph.getReadySteps(completedSteps);
  }

  /**
   * Check if a step can be executed given completed steps
   */
  canExecute(stepId: string, completedSteps: Set<string>): boolean {
    const dependencies = this.graph.getDependencies(stepId);
    return dependencies.every((dep) => completedSteps.has(dep));
  }

  /**
   * Get the critical path (longest path from start to end)
   * Useful for estimating minimum execution time
   */
  getCriticalPath(): string[] {
    const levels = this.computeLevels();
    if (levels.length === 0) return [];

    // For simplicity, return the first step from each level
    // In a real implementation, you might want to track actual execution times
    return levels.map((level) => level.steps[0]);
  }

  /**
   * Get statistics about the execution plan
   */
  getStatistics(): {
    totalSteps: number;
    totalLevels: number;
    maxParallelism: number;
    criticalPathLength: number;
  } {
    const levels = this.computeLevels();
    const maxParallelism = Math.max(...levels.map((l) => l.steps.length), 0);

    return {
      totalSteps: this.graph.getAllSteps().length,
      totalLevels: levels.length,
      maxParallelism,
      criticalPathLength: levels.length,
    };
  }
}
