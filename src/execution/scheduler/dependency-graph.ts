/**
 * @fileoverview Dependency Graph for Workflow Steps
 *
 * Manages dependencies between workflow steps as a Directed Acyclic Graph (DAG)
 */

import { InvalidConfigurationError } from '../../core/errors';

/**
 * Represents a node in the dependency graph
 */
export interface GraphNode {
  id: string;
  dependencies: Set<string>;
}

/**
 * Dependency Graph implementation
 * Manages step dependencies and validates DAG structure
 */
export class DependencyGraph {
  private nodes: Map<string, GraphNode>;

  constructor() {
    this.nodes = new Map();
  }

  /**
   * Add a step to the graph
   */
  addStep(stepId: string): void {
    if (!this.nodes.has(stepId)) {
      this.nodes.set(stepId, {
        id: stepId,
        dependencies: new Set(),
      });
    }
  }

  /**
   * Add a dependency: stepId depends on dependencyId
   * stepId will only execute after dependencyId completes
   */
  addDependency(stepId: string, dependencyId: string): void {
    // Ensure both nodes exist
    this.addStep(stepId);
    this.addStep(dependencyId);

    const node = this.nodes.get(stepId)!;
    node.dependencies.add(dependencyId);

    // Validate no cycles created
    if (this.hasCycle()) {
      node.dependencies.delete(dependencyId);
      throw new InvalidConfigurationError(
        `Adding dependency from ${stepId} to ${dependencyId} would create a cycle`
      );
    }
  }

  /**
   * Get all dependencies for a step
   */
  getDependencies(stepId: string): string[] {
    const node = this.nodes.get(stepId);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Get all steps that depend on this step
   */
  getDependents(stepId: string): string[] {
    const dependents: string[] = [];
    for (const [id, node] of this.nodes) {
      if (node.dependencies.has(stepId)) {
        dependents.push(id);
      }
    }
    return dependents;
  }

  /**
   * Check if the graph has cycles (which would be invalid)
   */
  private hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) return true;
          } else if (recursionStack.has(depId)) {
            return true; // Cycle detected
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Get steps that have no dependencies (can run immediately)
   */
  getRootSteps(): string[] {
    const roots: string[] = [];
    for (const [id, node] of this.nodes) {
      if (node.dependencies.size === 0) {
        roots.push(id);
      }
    }
    return roots;
  }

  /**
   * Get steps that can be executed given completed steps
   */
  getReadySteps(completedSteps: Set<string>): string[] {
    const ready: string[] = [];
    for (const [id, node] of this.nodes) {
      if (completedSteps.has(id)) continue; // Already completed

      // Check if all dependencies are completed
      const allDepsCompleted = Array.from(node.dependencies).every((dep) =>
        completedSteps.has(dep)
      );

      if (allDepsCompleted) {
        ready.push(id);
      }
    }
    return ready;
  }

  /**
   * Validate the graph structure
   */
  validate(): void {
    if (this.hasCycle()) {
      throw new InvalidConfigurationError('Dependency graph contains cycles');
    }

    // Check all referenced dependencies exist
    for (const [stepId, node] of this.nodes) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          throw new InvalidConfigurationError(
            `Step ${stepId} depends on non-existent step ${depId}`
          );
        }
      }
    }
  }

  /**
   * Get all step IDs in the graph
   */
  getAllSteps(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
  }
}
