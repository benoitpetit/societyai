/**
 * @fileoverview Hierarchical Society Support - Engine as Model
 *
 * Allows an ExecutionEngine (entire society) to be used as an AIModel.
 * This enables composing societies within societies for hierarchical orchestration.
 *
 * @example
 * ```ts
 * // Inner Team: Specialized agents for code generation
 * const innerGraph = GraphBuilder.create()
 *   .addNode('start', NodeType.START)
 *   .addNode('coder', NodeType.AGENT, { agentId: 'coder' })
 *   .addNode('tester', NodeType.AGENT, { agentId: 'tester' })
 *   .addNode('end', NodeType.END)
 *   .addEdge('start', 'coder')
 *   .addEdge('coder', 'tester')
 *   .addEdge('tester', 'end')
 *   .build();
 *
 * // Wrap inner graph as a model
 * const codeTeamModel = new EngineAsModel(innerGraph, [coderAgent, testerAgent]);
 *
 * // Outer Manager: Uses the inner team as if it were a single agent
 * const managerSociety = Society.create()
 *   .addAgent(a => a
 *     .withId('manager')
 *     .withRole(managerRole)
 *     .withModel(codeTeamModel) // Inner society as model!
 *   )
 *   .addTask(t => t.withId('delegate').withAgents(['manager']).sequential())
 *   .execute('Build a REST API');
 * ```
 */

import { AIModel } from '../core/types';
import { ExecutionEngine } from './engine/execution-engine';
import { Agent } from '../core/types';
import { getLogger } from '../observability/logger';

/**
 * Configuration for EngineAsModel
 */
export interface EngineAsModelConfig {
  /** Execution engine (inner society graph) */
  engine: ExecutionEngine;
  /** Agents available to the inner society */
  agents: Agent[];
  /** Model name for display/logging */
  name?: string;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
  /** Error handling strategy */
  onError?: 'throw' | 'return-error-message';
}

/**
 * Adapter that wraps an ExecutionEngine as an AIModel
 *
 * This enables Hierarchical Societies: a complete multi-agent workflow
 * can be encapsulated and used as if it were a single AI model.
 *
 * Use Cases:
 * - Manager delegating to specialized sub-teams
 * - Multi-stage pipelines with nested workflows
 * - Domain-specific societies as reusable components
 * - Recursive problem decomposition
 *
 * Features:
 * - Transparent error handling
 * - Timeout support
 * - Execution context isolation
 * - Observer propagation (optional)
 *
 * @implements {AIModel}
 */
export class EngineAsModel implements AIModel {
  public readonly id: string;
  public readonly provider: string;
  private engine: ExecutionEngine;
  private agents: Agent[];
  private timeout: number;
  private onError: 'throw' | 'return-error-message';
  private logger = getLogger();

  constructor(config: EngineAsModelConfig) {
    this.engine = config.engine;
    this.agents = config.agents;
    this.id = config.name || 'engine-as-model';
    this.provider = 'societyai-hierarchical';
    this.timeout = config.timeout || 0;
    this.onError = config.onError || 'throw';
  }

  /**
   * Process input through the inner society
   *
   * @param prompt - Input to the inner society (can be string or structured)
   * @param signal - Abort signal for cancellation
   * @returns Final output of the inner society
   */
  async process(prompt: unknown, signal?: AbortSignal): Promise<string> {
    this.logger.debug(`[EngineAsModel] Processing input through inner society: ${this.id}`);

    try {
      // Convert prompt to string if needed
      const input = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

      // Create timeout signal if specified
      let timeoutId: NodeJS.Timeout | null = null;
      let combinedSignal = signal;

      if (this.timeout > 0) {
        const controller = new AbortController();

        // Combine with external signal if provided
        if (signal) {
          signal.addEventListener('abort', () => controller.abort());
        }

        combinedSignal = controller.signal;

        timeoutId = setTimeout(() => {
          controller.abort();
        }, this.timeout);
      }

      // Execute inner society
      const result = await this.engine.execute(
        input,
        this.agents,
        combinedSignal, // AbortSignal
        undefined, // observer
        undefined, // middlewareChain
        undefined, // initialContext
        undefined, // storageAdapter
        undefined // executionId
      );

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Handle execution result
      if (!result.success) {
        const errorMsg = result.errors?.map((e) => e.message).join('; ') || 'Unknown error';

        if (this.onError === 'throw') {
          throw new Error(`Inner society execution failed: ${errorMsg}`);
        } else {
          return `[ERROR] Inner society failed: ${errorMsg}`;
        }
      }

      this.logger.debug(`[EngineAsModel] Inner society completed successfully`);
      return result.output;
    } catch (error) {
      this.logger.error(`[EngineAsModel] Error in inner society: ${(error as Error).message}`);

      if (this.onError === 'throw') {
        throw error;
      } else {
        return `[ERROR] ${(error as Error).message}`;
      }
    }
  }

  /**
   * Streaming not supported for hierarchical societies
   */
  async *stream(prompt: unknown, signal?: AbortSignal): AsyncIterable<string> {
    // For now, we execute sync and yield the final result
    // Future enhancement: propagate streaming from inner agents
    const result = await this.process(prompt, signal);
    yield result;
  }

  /**
   * Returns the model name
   */
  name(): string {
    return this.id;
  }

  /**
   * Checks if the model supports a specific prompt type
   * Always returns true for flexibility
   */
  supportsPromptType(_promptType: string): boolean {
    return true;
  }

  /**
   * Checks if streaming is supported
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * Get the inner engine (for advanced use cases)
   */
  getEngine(): ExecutionEngine {
    return this.engine;
  }

  /**
   * Get the agents used by the inner society
   */
  getAgents(): Agent[] {
    return this.agents;
  }
}

/**
 * Helper function to create an EngineAsModel
 */
export function wrapEngineAsModel(
  engine: ExecutionEngine,
  agents: Agent[],
  options?: Partial<EngineAsModelConfig>
): EngineAsModel {
  return new EngineAsModel({
    engine,
    agents,
    ...options,
  });
}
