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

      // For sequential tasks with multiple agents, create a chain of AGENT nodes
      // so every agent actually executes (#16). Without this, only agentIds[0] runs.
      if (type === NodeType.AGENT && task.agentIds && task.agentIds.length > 1) {
        for (let ai = 0; ai < task.agentIds.length; ai++) {
          const agentNodeId = ai === 0 ? task.id : `${task.id}_agent${ai}`;
          graphBuilder.addNode(agentNodeId, NodeType.AGENT, {
            agentId: task.agentIds[ai],
            maxIterations: task.maxIterations,
            metadata: {
              name: task.name,
              instructions: task.instructions,
              promptTemplate: task.promptTemplate,
            },
            outputSchema: task.outputSchema as JSONSchema | undefined,
          });
          // Wire each agent to the next in the chain
          if (ai > 0) {
            const prevNodeId = ai === 1 ? task.id : `${task.id}_agent${ai - 1}`;
            graphBuilder.addEdge(prevNodeId, agentNodeId);
          }
        }
        // The "task" node in the graph is the first agent node (task.id).
        // The "exit" node (last in chain) is `${task.id}_agent${agentIds.length - 1}`.
        // We store the exit node id so we can wire outgoing edges correctly.
        // We do this by overriding the task's nextTasks source later — handled below
        // by recording a synthetic alias.
      } else {
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
    }

    // Add Edges (Sequential by default for compatibility)
    const entryTaskId = society.entryTaskId || tasks[0]?.id;

    // Build a map from task ID to task for dependency lookups
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    // Helper: for multi-agent sequential chains, the actual graph exit node is
    // the last agent in the chain; for all other tasks it is task.id itself (#16).
    const exitNodeId = (task: (typeof tasks)[number]): string => {
      if (!task.executionType && task.agentIds && task.agentIds.length > 1) {
        return `${task.id}_agent${task.agentIds.length - 1}`;
      }
      return task.id;
    };

    // Wire the entry point
    if (entryTaskId) {
      graphBuilder.addEdge('start', entryTaskId);
    } else {
      graphBuilder.addEdge('start', 'end');
    }

    // First pass: create dependency edges from dependsOn() declarations
    // dependsOn('A') means: add edge A → thisTask
    for (const task of tasks) {
      const deps = task.dependencies;
      if (deps && deps.length > 0) {
        for (const depId of deps) {
          if (!taskMap.has(depId)) {
            throw new InvalidWorkflowRoutingError(
              `Task '${task.id}' declares a dependency on unknown task '${depId}'. ` +
                `Available tasks: ${Array.from(taskMap.keys()).join(', ')}.`
            );
          }
          graphBuilder.addEdge(depId, task.id);
          this.logger.debug(`Dependency edge: '${depId}' -> '${task.id}' (from dependsOn)`);
        }
      }
    }

    // Second pass: create normal sequential / explicit routing edges
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const isLastTask = i === tasks.length - 1;
      const hasNextResolver = !!task.nextTaskResolver;
      const hasDependencies = !!task.dependencies?.length;
      const src = exitNodeId(task); // may differ from task.id for multi-agent chains

      if (hasNextResolver) {
        // The dynamic-routing second pass (below) will handle outgoing edges.
        continue;
      }

      // Case 1: Explicit next steps defined via thenGoto() / withNextSteps()
      if (task.nextTasks && task.nextTasks.length > 0) {
        for (const nextId of task.nextTasks) {
          graphBuilder.addEdge(src, nextId);
        }
        continue;
      }

      // Case 2: This task has dependency declarations — its outgoing edge will be
      // handled either by an explicit nextTasks on the dependency target or by
      // implicit sequential wiring below for the tasks that follow it.
      // We still need to wire it to the next task or 'end' if it has no outgoing edges.

      // If it's the last task, go to 'end' unless it already has outgoing dep edges
      if (isLastTask) {
        // Only add edge to 'end' if no other task depends on this one as a predecessor
        // (i.e. this task hasn't already been wired forward via dependency edges)
        graphBuilder.addEdge(src, 'end');
        continue;
      }

      // Intermediate task with no explicit routing
      const nextTask = tasks[i + 1];

      // Skip implicit wiring if the next task already has an explicit dependency
      // on THIS task (to avoid duplicate edges)
      const nextTaskDeps = nextTask.dependencies;
      const nextAlreadyDependsOnThis = nextTaskDeps?.includes(task.id) ?? false;

      if (nextAlreadyDependsOnThis) {
        // Edge already created in the dependency pass above.
        continue;
      }

      // Skip implicit wiring for tasks that declare dependencies on other tasks —
      // their incoming edges come from those dependency declarations.
      if (hasDependencies) {
        // This task already has incoming edges from its dependencies.
        // We still need to wire it forward to the next task.
      }

      if (society.strictRouting) {
        throw new InvalidWorkflowRoutingError(
          `Task '${task.id}' (position ${i}) has no explicit nextTasks defined. ` +
            `In strict routing mode, all intermediate tasks must explicitly define their transitions. ` +
            `Use .withNextSteps([...]) or .thenGoto([...]) to define routing, or disable strict mode with .withStrictRouting(false).`
        );
      }

      graphBuilder.addEdge(src, nextTask.id);
      this.logger.debug(
        `Implicit routing: Task '${task.id}' -> '${nextTask.id}' ` +
          `(enable strictRouting to make this explicit)`
      );
    }

    // Third pass: Dynamic routing (nextTaskResolver)
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

      // Wire task exit node → resolver (#16: use exitNodeId for multi-agent chains)
      graphBuilder.addEdge(exitNodeId(task), resolverNodeId);

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
