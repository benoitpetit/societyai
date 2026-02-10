import { SocietyConfig, SocietyResult, TaskResult, SocietyObserver } from '../core/types';
import { getLogger } from '../observability/logger';
import { InvalidWorkflowRoutingError } from '../core/errors';
import { JSONSchema } from '../capabilities/validation';
import {
  GraphBuilder,
  NodeType,
  GraphResult,
  GraphContext,
  ExecutionEngine,
} from '../execution/engine/execution-engine';
import { MiddlewareChain } from '../core/middleware';

// ============================================================================
// SOCIETY EXECUTOR
// ============================================================================

/**
 * Society Executor using the Graph Engine
 */
export class SocietyExecutor {
  private logger = getLogger();
  private observer?: SocietyObserver;

  constructor(observer?: SocietyObserver) {
    this.observer = observer;
  }

  /**
   * Builds the execution graph from the society configuration
   */
  buildExecutionGraph(society: SocietyConfig): ExecutionEngine {
    // 1. Convert Workflow to Graph
    const graphBuilder = GraphBuilder.create();

    // Always add bounds
    graphBuilder.addNode('start', NodeType.START);
    graphBuilder.addNode('end', NodeType.END);

    // Add nodes from tasks
    const tasks = society.tasks || [];
    for (const task of tasks) {
      let type = NodeType.AGENT;
      if (task.executionType === 'parallel') type = NodeType.PARALLEL;
      if (task.executionType === 'collaborative') type = NodeType.COLLABORATIVE;
      if (task.executionType === 'conditional') type = NodeType.CONDITION;
      if (task.executionType === 'human') type = NodeType.HUMAN;

      // Adapter for condition
      const conditionAdapter = task.condition
        ? (_result: string, ctx: GraphContext): boolean => {
            const prevResults = new Map<string, TaskResult[]>();
            for (const [nodeId, res] of ctx.nodeResults) {
              prevResults.set(nodeId, [
                {
                  agentId: res.agentId,
                  taskId: nodeId,
                  output: res.output,
                  success: res.success,
                  timestamp: Date.now(),
                },
              ]);
            }
            return task.condition!(prevResults);
          }
        : undefined;

      graphBuilder.addNode(task.id, type, {
        agentId: task.agentIds && task.agentIds.length > 0 ? task.agentIds[0] : undefined,
        agentIds: task.agentIds,
        maxIterations: task.maxIterations,
        completionCondition: task.completionCondition,
        condition: conditionAdapter,
        metadata: {
          name: task.name,
          instructions: task.instructions,
          promptTemplate: task.promptTemplate,
        },
        outputSchema: task.outputSchema as JSONSchema | undefined,
      });
    }

    // Add Edges (Séquentiel par défaut pour la compatibilité)
    const entryTaskId = society.entryTaskId || tasks[0]?.id;
    if (entryTaskId) {
      graphBuilder.addEdge('start', entryTaskId);
    } else {
      graphBuilder.addEdge('start', 'end');
    }

    // First pass: create normal edges (incoming)
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const isLastTask = i === tasks.length - 1;
      const hasNextResolver = !!task.nextTaskResolver;

      if (hasNextResolver) {
        // Create nothing here, the second pass will handle outgoing routing
        continue;
      }

      // Case 1: Explicit next steps handling (nextTasks defined)
      if (task.nextTasks && task.nextTasks.length > 0) {
        for (const nextId of task.nextTasks) {
          graphBuilder.addEdge(task.id, nextId);
        }
      }
      // Case 2: No explicitly defined next step
      else {
        // If it's the last step, naturally go to 'end'
        if (isLastTask) {
          graphBuilder.addEdge(task.id, 'end');
        }
        // If it's an intermediate step
        else {
          const nextTask = tasks[i + 1];

          if (society.strictRouting && !nextTask.nextTaskResolver) {
            throw new InvalidWorkflowRoutingError(
              `Task '${task.id}' (position ${i}) has no explicit nextTasks defined. ` +
                `In strict routing mode, all intermediate tasks must explicitly define their transitions. ` +
                `Use .withNextSteps([...]) or .thenGoto([...]) to define routing, or disable strict mode with .withStrictRouting(false).`
            );
          }

          graphBuilder.addEdge(task.id, nextTask.id);
          this.logger.debug(
            `Implicit routing: Task '${task.id}' -> '${nextTask.id}' ` +
              `(enable strictRouting to make this explicit)`
          );
        }
      }
    }

    // Second pass: Dynamic routing
    for (const task of tasks) {
      if (!task.nextTaskResolver) continue;

      const resolverNodeId = `${task.id}_resolver`;
      graphBuilder.addNode(resolverNodeId, NodeType.CONDITION, {
        condition: (_result: string, ctx: GraphContext): boolean => {
          const resultsArray: TaskResult[] = [];
          for (const [nodeId, res] of ctx.nodeResults) {
            resultsArray.push({
              agentId: res.agentId,
              taskId: nodeId,
              output: res.output,
              success: res.success,
              timestamp: res.timestamp || Date.now(),
            });
          }

          const nextTaskId = task.nextTaskResolver!(resultsArray);
          ctx.sharedData.set(`${resolverNodeId}_next`, nextTaskId);
          return true;
        },
      });

      graphBuilder.addEdge(task.id, resolverNodeId);

      const targets =
        task.possibleNextTasks && task.possibleNextTasks.length > 0
          ? tasks.filter((t) => task.possibleNextTasks!.includes(t.id))
          : tasks.filter((t) => t.id !== task.id);

      for (const potentialNextTask of targets) {
        graphBuilder.addEdge(resolverNodeId, potentialNextTask.id, {
          condition: (_result: string, ctx: GraphContext) => {
            const resolvedNext = ctx.sharedData.get(`${resolverNodeId}_next`);
            return resolvedNext === potentialNextTask.id;
          },
        });
      }

      graphBuilder.addEdge(resolverNodeId, 'end', {
        condition: (_result: string, ctx: GraphContext) => {
          const resolvedNext = ctx.sharedData.get(`${resolverNodeId}_next`);
          return resolvedNext === null || resolvedNext === undefined;
        },
      });
    }

    return graphBuilder.build();
  }

  /**
   * Executes a complete society by converting it to an ExecutionEngine (graph)
   */
  async execute(
    society: SocietyConfig,
    input: string,
    signal?: AbortSignal,
    middlewareChain?: MiddlewareChain
  ): Promise<SocietyResult> {
    const startTime = Date.now();
    this.logger.info(`Starting society: ${society.name} using ExecutionEngine`);

    if (this.observer) {
      this.observer.onSocietyStart(input, society.agents.length);
    }

    try {
      const graph = this.buildExecutionGraph(society);

      // 2. Execute with globalContext
      const result: GraphResult = await graph.execute(
        input,
        society.agents,
        signal,
        this.observer,
        middlewareChain,
        society.globalContext
      );

      // 3. Map Result back to SocietyResult
      const taskResults = new Map<string, TaskResult[]>();
      for (const [nodeId, res] of result.nodeResults) {
        const sr: TaskResult = {
          agentId: res.agentId,
          taskId: nodeId,
          output: res.output,
          success: res.success,
          timestamp: Date.now(),
        };
        if (!taskResults.has(nodeId)) {
          taskResults.set(nodeId, []);
        }
        taskResults.get(nodeId)!.push(sr);
      }

      const finalOutput = result.output;

      if (this.observer) {
        this.observer.onSocietyComplete(finalOutput);
      }

      this.logger.info(`Society completed in ${result.duration}ms`);

      return {
        success: result.success,
        output: finalOutput,
        taskResults,
        messages: result.messages || [],
        duration: result.duration,
        errors: result.errors,
      };
    } catch (error) {
      this.logger.error(`Society execution failed: ${(error as Error).message}`);
      return {
        success: false,
        output: '',
        taskResults: new Map(),
        duration: Date.now() - startTime,
        errors: [error as Error],
        messages: [],
      };
    }
  }
}
