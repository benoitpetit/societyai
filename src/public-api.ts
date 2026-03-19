/**
 * @fileoverview SocietyAI Public API - Essential exports only
 *
 * This module exports the essential types and classes for using SocietyAI.
 * For advanced use cases, import from specific submodules.
 *
 * @example
 * ```typescript
 * // Essential imports (recommended)
 * import { Society, Agent, TaskResult } from 'societyai';
 *
 * // Advanced imports (when needed)
 * import { ExecutionEngine, GraphBuilder } from 'societyai/advanced';
 * import { MemorySystem, MemoryBuilder } from 'societyai/memory';
 * ```
 */

// ============================================================================
// CORE TYPES (Essential only)
// ============================================================================

export type {
  AIModel,
  Agent,
  Role,
  Task,
  TaskResult,
  SocietyConfig,
  SocietyResult,
  ExecutionContext,
  Message,
  SocietyObserver,
} from './core/types';

// Agent execution mode is a string literal type, not a separate export
export type AgentExecutionMode = 'default' | 'isolated';

// ============================================================================
// ERRORS (All error types)
// ============================================================================

export {
  SocietyError,
  ModelNotSupportedError,
  ProcessingFailedError,
  InvalidAgentCountError,
  NoModelsSpecifiedError,
  SynthesisModelRequiredError,
  OperationCancelledError,
  ExecutionTimeoutError,
  InvalidConfigurationError,
  InvalidWorkflowRoutingError,
  NotImplementedError,
  AgentNotFoundError,
  CircularDependencyError,
  isAbortError,
  wrapError,
} from './core/errors';

// ============================================================================
// MAIN BUILDER API
// ============================================================================

export {
  Society,
  SocietyPatterns,
  AggregationStrategies,
  FluentRoleBuilder,
  FluentAgentBuilder,
  FluentTaskBuilder,
  FluentPipelineBuilder,
  FluentRoleBuilder as RoleBuilder,
  FluentAgentBuilder as AgentBuilder,
  FluentTaskBuilder as TaskBuilder,
  roleBuilder,
  agentBuilder,
} from './builders/builder';

export type { PipelineConfig, PipelinePattern } from './builders/builder';

// ============================================================================
// MIDDLEWARE (Essential)
// ============================================================================

export {
  MiddlewareChain,
  Middlewares,
  StepMiddlewares,
  InMemoryMetricsCollector,
  StreamMiddlewares,
  composeStreamingMiddleware,
  applyStreamingMiddleware,
} from './core/middleware';

export type {
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
  MetricsCollector,
  StreamingMiddleware,
  StreamingMiddlewareContext,
  StreamingMiddlewareFn,
} from './core/middleware';

// ============================================================================
// TOOLS
// ============================================================================

export { ToolRegistry, ToolBuilder, BuiltInTools } from './capabilities/tools';

export type { Tool, ToolCall, ToolResult, ToolContext } from './capabilities/tools';

// ============================================================================
// MEMORY (Essential)
// ============================================================================

export { MemorySystem, MemoryBuilder } from './capabilities/memory';

export type {
  MemoryEntry,
  MemoryQuery,
  MemoryRetrievalResult,
  MemoryPersistenceConfig,
} from './capabilities/memory';

// ============================================================================
// VALIDATION
// ============================================================================

export { StructuredOutputValidator, validateJSON, createSchema } from './capabilities/validation';

export type { JSONSchema, ValidationResult } from './capabilities/validation';

// ============================================================================
// PERSISTENCE
// ============================================================================

export { FileStorageAdapter } from './core/persistence';
export type { StorageAdapter, WorkflowState } from './core/persistence';

// ============================================================================
// ADAPTERS
// ============================================================================

export { ModelAdapters, isSerializableModelConfig } from './adapters';

export type { SerializableModelConfig, ModelAdapter } from './adapters';

// ============================================================================
// UTILS
// ============================================================================

export { withRetry } from './utils/retry';
export type { RetryOptions } from './core/config';

// ============================================================================
// OBSERVABILITY (Essential)
// ============================================================================

export { getLogger, setLogger, DefaultLogger as ConsoleLogger } from './observability/logger';

export type { Logger } from './core/config';

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '0.1.7';
