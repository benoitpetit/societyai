/**
 * @fileoverview Advanced Execution API
 *
 * Advanced execution engine and graph builder for complex workflows.
 * Use this submodule when you need fine-grained control over execution.
 *
 * @example
 * ```typescript
 * import { ExecutionEngine, GraphBuilder, NodeType } from 'societyai/advanced';
 *
 * const graph = GraphBuilder.create()
 *   .addNode('start', NodeType.START)
 *   .addNode('agent1', NodeType.AGENT, { agentId: 'a1' })
 *   .addNode('end', NodeType.END)
 *   .addEdge('start', 'agent1')
 *   .addEdge('agent1', 'end')
 *   .build();
 *
 * const result = await graph.execute({
 *   input: 'test',
 *   agents: [myAgent]
 * });
 * ```
 */

// Execution Engine
export {
  ExecutionEngine,
  GraphBuilder,
  NodeType,
  GraphNode,
  GraphEdge,
  ConditionalEdge,
  GraphContext,
  GraphResult,
  ExecutionEngineOptions,
} from './execution/engine/execution-engine';

export type { ExecuteOptions, ResumeOptions } from './execution/engine/execution-engine';

// Graph Visualization
export { GraphVisualizer } from './execution/graph-visualizer';

// Engine as Model (Hierarchical Societies)
export { EngineAsModel, wrapEngineAsModel } from './execution/engine-as-model';

export type { EngineAsModelConfig } from './execution/engine-as-model';

// Worker Pools
export { ConcurrencyLimiter, CpuWorkerPool } from './utils/worker-pool';

export { IsolatedWorkerPool } from './utils/isolated-worker-pool';
export { IsolatedWorkerRegistry } from './utils/isolated-worker';
