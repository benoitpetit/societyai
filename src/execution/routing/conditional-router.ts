/**
 * @fileoverview Conditional Router Implementation
 *
 * Routes workflow based on conditions evaluated against results
 */

import { Router, RouteMap } from './router';
import { StepResult } from '../../core/types';
import { getLogger } from '../../observability/logger';

/**
 * Conditional router implementation
 * Evaluates conditions in order and routes to the first matching route
 */
export class ConditionalRouter implements Router {
  private routes: RouteMap[];
  private defaultRoute?: string | string[];
  private logger = getLogger();

  constructor(routes: RouteMap[], defaultRoute?: string | string[]) {
    this.routes = routes;
    this.defaultRoute = defaultRoute;
  }

  /**
   * Evaluate conditions and route to next step(s)
   */
  route(results: StepResult[], context?: Record<string, unknown>): string | string[] | null {
    // Try each route in order
    for (const route of this.routes) {
      try {
        if (route.condition(results, context)) {
          this.logger.debug(`Condition matched, routing to: ${route.nextStep}`);
          return route.nextStep;
        }
      } catch (error) {
        this.logger.error(`Error evaluating condition: ${error}`);
      }
    }

    // No condition matched, use default route
    if (this.defaultRoute !== undefined) {
      this.logger.debug(`No condition matched, using default route: ${this.defaultRoute}`);
      return this.defaultRoute;
    }

    // No route found
    this.logger.debug('No route matched and no default route defined');
    return null;
  }

  /**
   * Add a new route
   */
  addRoute(route: RouteMap): void {
    this.routes.push(route);
  }

  /**
   * Set the default route
   */
  setDefaultRoute(route: string | string[]): void {
    this.defaultRoute = route;
  }
}

/**
 * Builder for creating conditional routers
 */
export class ConditionalRouterBuilder {
  private routes: RouteMap[] = [];
  private defaultRoute?: string | string[];

  /**
   * Add a conditional route
   */
  when(
    condition: (results: StepResult[], context?: Record<string, unknown>) => boolean,
    nextStep: string | string[]
  ): this {
    this.routes.push({
      condition,
      nextStep,
    });
    return this;
  }

  /**
   * Set the default route (fallback)
   */
  otherwise(nextStep: string | string[]): this {
    this.defaultRoute = nextStep;
    return this;
  }

  /**
   * Build the router
   */
  build(): ConditionalRouter {
    return new ConditionalRouter(this.routes, this.defaultRoute);
  }
}

/**
 * Common routing conditions
 */
export const RouterConditions = {
  /**
   * All results successful
   */
  allSuccess: (results: StepResult[]): boolean => {
    return results.length > 0 && results.every((r) => r.success);
  },

  /**
   * Any result successful
   */
  anySuccess: (results: StepResult[]): boolean => {
    return results.some((r) => r.success);
  },

  /**
   * All results failed
   */
  allFailed: (results: StepResult[]): boolean => {
    return results.length > 0 && results.every((r) => !r.success);
  },

  /**
   * Any result failed
   */
  anyFailed: (results: StepResult[]): boolean => {
    return results.some((r) => !r.success);
  },

  /**
   * Result contains specific text
   */
  contains:
    (text: string) =>
    (results: StepResult[]): boolean => {
      return results.some((r) => r.success && r.content.includes(text));
    },

  /**
   * Result matches regex pattern
   */
  matches:
    (pattern: RegExp) =>
    (results: StepResult[]): boolean => {
      return results.some((r) => r.success && pattern.test(r.content));
    },

  /**
   * Custom condition based on result count
   */
  minSuccessCount:
    (min: number) =>
    (results: StepResult[]): boolean => {
      const successCount = results.filter((r) => r.success).length;
      return successCount >= min;
    },

  /**
   * Consensus: majority of results agree
   */
  consensus:
    (threshold = 0.5) =>
    (results: StepResult[]): boolean => {
      if (results.length === 0) return false;
      const successCount = results.filter((r) => r.success).length;
      return successCount / results.length >= threshold;
    },
};
