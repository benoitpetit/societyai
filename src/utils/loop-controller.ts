/**
 * LoopController - Manages execution iterations and exit conditions.
 */
import { LoopConfig, ExecutionContext } from '../core/types';
export { LoopConfig };

export class LoopController {
  private currentIteration: number = 0;

  constructor(private config: LoopConfig) {}

  /**
   * Increments iteration count and checks if execution should continue.
   * @throws Error if max iterations reached.
   */
  next(): boolean {
    this.currentIteration++;
    if (this.currentIteration > this.config.maxIterations) {
      return false;
    }
    return true;
  }

  /**
   * Checks if the exit condition is met.
   */
  shouldExit(result: string, context: ExecutionContext): boolean {
    if (this.config.exitCondition) {
      return this.config.exitCondition(result, context);
    }
    return false;
  }

  get iteration(): number {
    return this.currentIteration;
  }

  get isFirst(): boolean {
    return this.currentIteration === 1;
  }
}
