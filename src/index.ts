/**
 * @fileoverview SocietyAI - Model-Agnostic Multi-Agent Orchestration Framework
 *
 * SocietyAI is a TypeScript library for creating collaborative AI agent societies.
 * It provides a model-agnostic, domain-independent framework with zero runtime dependencies.
 *
 * Key Features:
 * - Fluent Builder API for configuring agents, roles, and workflows
 * - Composable Pipeline Patterns (chain, scatter-gather, router, etc.)
 * - Middleware System for cross-cutting concerns
 * - Pluggable Aggregation Strategies
 * - Type-safe Context Injection
 * - Event System for monitoring and debugging
 *
 * @example
 * ```typescript
 * import { Society, AggregationStrategies } from 'societyai';
 *
 * // Create a simple society
 * const result = await Society.create()
 *   .withName('Analysis Team')
 *   .addAgent(a => a
 *     .withId('analyst1')
 *     .withRole(r => r.withSystemPrompt('You are a data analyst'))
 *     .withModel(myModel))
 *   .addAgent(a => a
 *     .withId('analyst2')
 *     .withRole(r => r.withSystemPrompt('You are a reviewer'))
 *     .withModel(myModel))
 *   .usePipeline(p => p
 *     .scatterGather(['analyst1', 'analyst2'])
 *     .aggregate(AggregationStrategies.concat()))
 *   .execute('Analyze this data');
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// CORE TYPES AND INTERFACES
// ============================================================================

export * from './core/types';
export * from './core/config';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export * from './core/errors';

// ============================================================================
// LOGGING
// ============================================================================

export * from './observability/logger';

// ============================================================================
// RETRY MECHANISM
// ============================================================================

export * from './utils/retry';

// ============================================================================
// WORKER POOL (Parallel Execution)
// ============================================================================

export * from './utils/worker-pool';

// ============================================================================
// MODEL ADAPTERS
// ============================================================================

export * from './core/models';

// ============================================================================
// CORE SOCIETY (Main Logic)
// ============================================================================

// Export ciblé: on expose le système de workflow.
export { SocietyExecutor } from './agents/society-executor';

// ============================================================================
// FLUENT BUILDER API
// ============================================================================

export {
  // Main builder
  Society,
  SocietyPatterns,
  AggregationStrategies,
  // Fluent builders
  FluentRoleBuilder,
  FluentAgentBuilder,
  FluentTaskBuilder,
  FluentPipelineBuilder,
  // Aliases for better DX
  FluentRoleBuilder as RoleBuilder,
  FluentAgentBuilder as AgentBuilder,
  FluentTaskBuilder as TaskBuilder,
  // Quick helpers
  createRole,
  createAgent,
} from './builders/builder';

// Builder types
export type { PipelineConfig, PipelinePattern } from './builders/builder';

// ============================================================================
// MIDDLEWARE SYSTEM
// ============================================================================

export {
  // Middleware chain
  MiddlewareChain,
  ComposedMiddleware,
  MiddlewareWrappedModel,
  // Built-in middlewares
  Middlewares,
  // Step middlewares
  StepMiddlewares,
  // Metrics
  InMemoryMetricsCollector,
} from './core/middleware';

// Middleware types
export type {
  Middleware,
  MiddlewareFn,
  MiddlewareContext,
  MiddlewareResult,
  NextFunction,
  MetricsCollector,
  StepMiddleware,
  StepMiddlewareFn,
  StepMiddlewareContext,
} from './core/middleware';

// ============================================================================
// CONTEXT SYSTEM
// ============================================================================

export {
  // Context tokens
  createContextToken,
  isContextToken,
  // Context provider
  ContextProvider,
  ContextProviderBuilder,
  // Context scope
  ContextScope,
  // Common contexts
  CommonContexts,
  // Context utilities
  ContextStore,
  ContextMap,
  selectContext,
  fromObject,
  toObject,
  mergeContexts,
  // Agent context injection
  AgentContextInjector,
  ContextAwarePromptBuilder,
} from './core/context';

// Context types
export type { ContextToken, IContextProvider, IMutableContextProvider } from './core/context';

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export {
  // Event emitter
  SocietyEventEmitter,
  FilteredEventEmitter,
  // Progress tracking
  ProgressTracker,
  // Event logging
  EventLogger,
  // Event aggregation
  EventAggregator,
  // Factory functions
  createEventEmitter,
  createProgressTracker,
  createEventLogger,
} from './observability/events';

// Event types
export type {
  // Base event
  BaseEvent,
  SocietyEvent,
  SocietyEventMap,
  // Workflow events
  WorkflowStartEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  // Step events
  StepStartEvent,
  StepCompleteEvent,
  StepErrorEvent,
  StepSkippedEvent,
  // Agent events
  AgentStartEvent,
  AgentCompleteEvent,
  AgentErrorEvent,
  AgentRetryEvent,
  // Other events
  ProgressEvent,
  MessageSentEvent,
  MessageReceivedEvent,
  DebugEvent,
  CustomEvent,
  // Handler types
  EventHandler,
  EventFilter,
  EventTransformer,
  // Summary
  EventSummary,
} from './observability/events';

// ============================================================================
// EXECUTION ENGINE
// ============================================================================

export {
  // Core graph
  ExecutionEngine as SocietyGraph,
  ExecutionEngine,
  GraphBuilder,
  // Recursive engine model
  EngineAsModel,
  // Types
  NodeType,
  GraphNode,
  GraphEdge,
  ConditionalEdge,
  GraphContext,
  GraphResult,
} from './execution/engine/execution-engine';

// ============================================================================
// TOOL CALLING SYSTEM
// ============================================================================

export {
  // Core tools
  ToolRegistry,
  ToolExecutor,
  ToolBuilder,
  // Built-in tools
  BuiltInTools,
  // Types
  Tool,
  ToolCall,
  ToolResult,
  ToolContext,
  ToolParameterSchema,
} from './capabilities/tools';

// ============================================================================
// MEMORY SYSTEM
// ============================================================================

export {
  // Memory systems
  MemorySystem,
  MemoryBuilder,
  ShortTermMemory,
  LongTermMemory,
  EntityMemory,
  // Types
  MemoryEntry,
  MemoryQuery,
  MemoryRetrievalResult,
  VectorProvider,
  Entity,
} from './capabilities/memory';

// ============================================================================
// STRUCTURED OUTPUT VALIDATION
// ============================================================================

export {
  // Validator
  StructuredOutputValidator,
  StructuredOutputBuilder,
  // Helpers
  validateJSON,
  createSchema,
  // Types
  JSONSchema,
  ValidationError,
  ValidationResult,
} from './capabilities/validation';

// ============================================================================
// METRICS AND OBSERVABILITY
// ============================================================================
